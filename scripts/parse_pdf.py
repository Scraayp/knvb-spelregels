#!/usr/bin/env python3
"""
Parse the KNVB 'Spelregelvragen Veldvoetbal' PDF into a clean questions.json.

The correct answer for each question is NOT present in the plain text: it is
encoded by rendering the correct option in an *italic* font (Arial-ItalicMT)
while every other option uses regular Arial (ArialMT). This script recovers
that signal at the character level.

Run once per season (KNVB swaps ~50 questions each September):

    pip install -r scripts/requirements.txt
    python scripts/parse_pdf.py

Output: data/questions.json  (validated, UTF-8)

The build FAILS LOUDLY (non-zero exit) if the data does not satisfy the
structural invariants (300 questions, 4 options each, one detectable answer),
unless --allow-warnings is passed. Questions whose answer could not be
detected unambiguously are emitted with confidence="needs-review" so the
review screen can surface them first.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

import pdfplumber

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_PDF = ROOT / "rulebook.pdf"
DEFAULT_OUT = ROOT / "data" / "questions.json"
# Human-verified answer overrides produced by the review screen (review.html).
# Shape: { "12": "b", "276": "d" }  (question id -> correct letter).
DEFAULT_CORRECTIONS = ROOT / "data" / "corrections.json"

EXPECTED_QUESTION_COUNT = 300
OPTION_LETTERS = ("a", "b", "c", "d")

# A line is considered italic-dominant (i.e. part of the correct answer) when
# this fraction of its non-space characters are rendered in an italic font.
ITALIC_LINE_THRESHOLD = 0.6
# An option (its first line + continuations) counts as "the correct one" when
# this fraction of its non-space characters are italic.
ITALIC_OPTION_THRESHOLD = 0.5

# Lines we never treat as content.
HEADER_RE = re.compile(r"SPELREGELVRAGEN VELDVOETBAL", re.IGNORECASE)
RUNNING_DATE_RE = re.compile(r"^Laatst gewijzigd", re.IGNORECASE)
PAGE_NUMBER_RE = re.compile(r"^\d{1,3}$")

QUESTION_RE = re.compile(r"^(\d+)\.\s+(.*)$", re.DOTALL)
OPTION_RE = re.compile(r"^([a-d])\.\s+(.*)$", re.DOTALL)
TAG_RE = re.compile(r"#[^\s#]+")
RULE_HEADER_RE = re.compile(r"^Regel\s+(\d+)\s*:\s*(.*)$")


# --------------------------------------------------------------------------- #
# Low-level: turn a page into lines that carry font / italic information.
# --------------------------------------------------------------------------- #
class Line:
    __slots__ = ("text", "italic_ratio", "top")

    def __init__(self, text: str, italic_ratio: float, top: float):
        self.text = text
        self.italic_ratio = italic_ratio
        self.top = top

    @property
    def stripped(self) -> str:
        return self.text.strip()


def _is_italic_font(fontname: str) -> bool:
    f = fontname.lower()
    return "italic" in f or "oblique" in f


def page_lines(page, y_tol: float = 3.0) -> list[Line]:
    """Cluster characters into visual lines, preserving an italic ratio."""
    chars = sorted(page.chars, key=lambda c: (round(c["top"]), c["x0"]))
    clusters: list[list[dict]] = []
    for c in chars:
        if clusters and abs(c["top"] - clusters[-1][0]["top"]) <= y_tol:
            clusters[-1].append(c)
        else:
            clusters.append([c])

    lines: list[Line] = []
    for cluster in clusters:
        cluster.sort(key=lambda c: c["x0"])
        text = "".join(c["text"] for c in cluster)
        non_space = [c for c in cluster if not c["text"].isspace()]
        if non_space:
            italic = sum(1 for c in non_space if _is_italic_font(c["fontname"]))
            ratio = italic / len(non_space)
        else:
            ratio = 0.0
        lines.append(Line(text=text, italic_ratio=ratio, top=cluster[0]["top"]))
    return lines


def is_noise(line: Line) -> bool:
    s = line.stripped
    if not s:
        return True
    if HEADER_RE.search(s):
        return True
    if RUNNING_DATE_RE.match(s):
        return True
    if PAGE_NUMBER_RE.match(s):
        return True
    return False


# --------------------------------------------------------------------------- #
# Tag -> rule mapping (built from the glossary page near the front).
# --------------------------------------------------------------------------- #
def build_tag_rule_map(pages) -> dict[str, int]:
    """
    The front matter lists, per rule, the hashtags that belong to it, e.g.

        Regel 11: #buitenspel #beïnvloeden
        Regel 12: #onbehoorlijkgedrag #geelrood ...
                  #(in)direct #hands ...        <- continuation line

    Returns {tag_without_hash: rule_number}.
    """
    tag_to_rule: dict[str, int] = {}
    current_rule: int | None = None
    in_mapping = False

    for page in pages[:6]:  # mapping lives in the first few pages
        for line in page_lines(page):
            if is_noise(line):
                continue
            s = line.stripped
            m = RULE_HEADER_RE.match(s)
            if m:
                in_mapping = True
                current_rule = int(m.group(1))
                for tag in TAG_RE.findall(m.group(2)):
                    tag_to_rule[tag.lstrip("#")] = current_rule
                continue
            if in_mapping and s.startswith("#") and current_rule is not None:
                # continuation line of the current rule's tag list
                for tag in TAG_RE.findall(s):
                    tag_to_rule[tag.lstrip("#")] = current_rule
                continue
            if in_mapping and not s.startswith("#"):
                # We've fallen out of the mapping block (e.g. first question).
                if QUESTION_RE.match(s):
                    return tag_to_rule
    return tag_to_rule


def rule_for_tags(tags: list[str], tag_to_rule: dict[str, int]) -> int | None:
    for t in tags:
        if t in tag_to_rule:
            return tag_to_rule[t]
    return None


# --------------------------------------------------------------------------- #
# Main parse: state machine over the content lines of every page.
# --------------------------------------------------------------------------- #
class RawOption:
    def __init__(self, letter: str):
        self.letter = letter
        self.text_parts: list[str] = []
        self.italic_hits = 0.0
        self.italic_total = 0.0

    def add_line(self, text: str, italic_ratio: float):
        self.text_parts.append(text.strip())
        n = len(text.strip())
        self.italic_total += n
        self.italic_hits += n * italic_ratio

    @property
    def text(self) -> str:
        return " ".join(p for p in self.text_parts if p).strip()

    @property
    def italic_ratio(self) -> float:
        return self.italic_hits / self.italic_total if self.italic_total else 0.0


class RawQuestion:
    def __init__(self, number: int, tags: list[str]):
        self.number = number
        self.tags = tags
        self.stem_parts: list[str] = []
        self.options: list[RawOption] = []

    def add_stem(self, text: str):
        if text.strip():
            self.stem_parts.append(text.strip())

    @property
    def stem(self) -> str:
        return " ".join(self.stem_parts).strip()


def parse_questions(pages, start_page: int) -> list[RawQuestion]:
    questions: list[RawQuestion] = []
    pending_tags: list[str] = []
    cur: RawQuestion | None = None
    cur_option: RawOption | None = None

    def expected_next() -> int:
        return len(questions) + 1

    for page in pages[start_page:]:
        for line in page_lines(page):
            if is_noise(line):
                continue
            s = line.stripped

            # Tag line -> belongs to the *next* question.
            if s.startswith("#"):
                pending_tags.extend(t.lstrip("#") for t in TAG_RE.findall(s))
                continue

            qm = QUESTION_RE.match(s)
            if qm and int(qm.group(1)) == expected_next():
                cur = RawQuestion(number=int(qm.group(1)), tags=pending_tags)
                pending_tags = []
                cur.add_stem(qm.group(2))
                cur_option = None
                questions.append(cur)
                continue

            if cur is None:
                continue  # still in front matter

            om = OPTION_RE.match(s)
            expects_option = len(cur.options) < len(OPTION_LETTERS)
            if om and expects_option and om.group(1) == OPTION_LETTERS[len(cur.options)]:
                cur_option = RawOption(om.group(1))
                cur_option.add_line(om.group(2), line.italic_ratio)
                cur.options.append(cur_option)
                continue

            # Overlapping tracked-change layer: a line that re-states an option
            # we already captured (KNVB layers edited text over the original,
            # see Q276). Drop it so it neither pollutes the text nor dilutes
            # the italic ratio used for answer detection.
            if om and any(o.letter == om.group(1) for o in cur.options):
                continue

            # Continuation line: of the current option, or of the stem.
            if cur_option is not None:
                cur_option.add_line(s, line.italic_ratio)
            else:
                cur.add_stem(s)

    return questions


# --------------------------------------------------------------------------- #
# Build final records + validation.
# --------------------------------------------------------------------------- #
def finalize(raw: list[RawQuestion], tag_to_rule: dict[str, int]):
    records = []
    problems: list[str] = []

    for q in raw:
        letters = [o.letter for o in q.options]
        italic_opts = [o for o in q.options if o.italic_ratio >= ITALIC_OPTION_THRESHOLD]

        confidence = "high"
        reasons = []
        if list(letters) != list(OPTION_LETTERS):
            confidence = "needs-review"
            reasons.append(f"options={letters!r}")
        if len(italic_opts) == 1:
            correct = italic_opts[0].letter
        elif len(italic_opts) == 0:
            correct = max(q.options, key=lambda o: o.italic_ratio).letter if q.options else None
            confidence = "needs-review"
            reasons.append("no italic option detected")
        else:
            correct = max(italic_opts, key=lambda o: o.italic_ratio).letter
            confidence = "needs-review"
            reasons.append(f"{len(italic_opts)} italic options")

        if confidence == "needs-review":
            problems.append(f"  Q{q.number}: {', '.join(reasons)}")

        records.append(
            {
                "id": q.number,
                "rule": rule_for_tags(q.tags, tag_to_rule),
                "tags": q.tags,
                "questionText": q.stem,
                "options": [{"letter": o.letter, "text": o.text} for o in q.options],
                "correctLetter": correct,
                "confidence": confidence,
                "verified": False,
            }
        )
    return records, problems


def apply_corrections(records: list[dict], path: Path) -> int:
    """Apply human-verified answer overrides from the review screen.

    A correction sets the correct letter and marks the question verified +
    high-confidence, so it survives future re-builds. Returns the count applied.
    """
    if not path.exists():
        return 0
    overrides = json.loads(path.read_text(encoding="utf-8"))
    by_id = {r["id"]: r for r in records}
    applied = 0
    for raw_id, letter in overrides.items():
        rid = int(raw_id)
        letter = str(letter).strip().lower()
        rec = by_id.get(rid)
        if rec is None:
            print(f"  correction for unknown id {rid} ignored", file=sys.stderr)
            continue
        if letter not in OPTION_LETTERS:
            print(f"  correction for Q{rid} has bad letter {letter!r}", file=sys.stderr)
            continue
        rec["correctLetter"] = letter
        rec["confidence"] = "high"
        rec["verified"] = True
        applied += 1
    return applied


def validate(records: list[dict]) -> list[str]:
    errors: list[str] = []
    if len(records) != EXPECTED_QUESTION_COUNT:
        errors.append(
            f"Expected {EXPECTED_QUESTION_COUNT} questions, parsed {len(records)}."
        )
    seen_ids = set()
    for r in records:
        rid = r["id"]
        if rid in seen_ids:
            errors.append(f"Duplicate id {rid}.")
        seen_ids.add(rid)
        letters = [o["letter"] for o in r["options"]]
        if letters != list(OPTION_LETTERS):
            errors.append(f"Q{rid}: options are {letters}, expected a-d.")
        if r["correctLetter"] not in OPTION_LETTERS:
            errors.append(f"Q{rid}: no correct answer ({r['correctLetter']!r}).")
        if not r["questionText"].strip():
            errors.append(f"Q{rid}: empty question text.")
        for o in r["options"]:
            if not o["text"].strip():
                errors.append(f"Q{rid}: empty option {o['letter']}.")
    return errors


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--pdf", type=Path, default=DEFAULT_PDF)
    ap.add_argument("--out", type=Path, default=DEFAULT_OUT)
    ap.add_argument("--corrections", type=Path, default=DEFAULT_CORRECTIONS)
    ap.add_argument(
        "--allow-warnings",
        action="store_true",
        help="Write output even if some answers need review (structural errors still fail).",
    )
    args = ap.parse_args()

    if not args.pdf.exists():
        print(f"ERROR: PDF not found at {args.pdf}", file=sys.stderr)
        return 2

    with pdfplumber.open(str(args.pdf)) as pdf:
        pages = pdf.pages

        # Find the first page that actually contains question 1.
        start_page = 0
        for i, page in enumerate(pages):
            if any(
                QUESTION_RE.match(l.stripped) and l.stripped.startswith("1.")
                for l in page_lines(page)
                if not is_noise(l)
            ):
                start_page = i
                break

        # Build the tag->rule glossary from the front matter ONLY, so the rule
        # list can't bleed onto the first question page's tag line.
        tag_to_rule = build_tag_rule_map(pages[:start_page])

        raw = parse_questions(pages, start_page)

    records, problems = finalize(raw, tag_to_rule)
    corrected = apply_corrections(records, args.corrections)
    errors = validate(records)

    # --- report -----------------------------------------------------------
    needs_review = sum(1 for r in records if r["confidence"] == "needs-review")
    no_rule = sum(1 for r in records if r["rule"] is None)
    by_rule = defaultdict(int)
    for r in records:
        by_rule[r["rule"]] += 1

    verified = sum(1 for r in records if r.get("verified"))
    print(f"Parsed {len(records)} questions from {args.pdf.name}")
    print(f"  tag->rule map: {len(tag_to_rule)} tags")
    print(f"  corrections applied : {corrected} (verified total: {verified})")
    print(f"  high confidence : {len(records) - needs_review}")
    print(f"  needs-review    : {needs_review}")
    print(f"  without a rule  : {no_rule}")
    if problems:
        print("Needs-review detail:")
        print("\n".join(problems))

    if errors:
        print("\nVALIDATION ERRORS:", file=sys.stderr)
        for e in errors:
            print("  " + e, file=sys.stderr)
        print(f"\nBuild FAILED with {len(errors)} structural error(s).", file=sys.stderr)
        return 1

    if needs_review and not args.allow_warnings:
        print(
            f"\n{needs_review} question(s) need review. "
            "Re-run with --allow-warnings to write output anyway, "
            "or fix them in the review screen.",
            file=sys.stderr,
        )
        return 1

    args.out.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "meta": {
            "source": args.pdf.name,
            "count": len(records),
            "needsReview": needs_review,
        },
        "questions": records,
    }
    args.out.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"\nWrote {args.out.relative_to(ROOT)} ({len(records)} questions).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
