# Data build pipeline

Turns the KNVB **Spelregelvragen Veldvoetbal** PDF into a clean, validated
`data/questions.json` that the front-end app consumes. Run this once per
season — KNVB swaps ~50 questions each September.

## How correct answers are recovered

The PDF's plain text does **not** say which answer is correct. The correct
option is rendered in an *italic* font (`Arial-ItalicMT`); every other option
uses regular `ArialMT`. `parse_pdf.py` reads the PDF at the character level and
detects the italic option per question. Correctness is structural: each
option lives inside its question object, so the answer can never drift away
from its question.

## Usage

```bash
pip install -r scripts/requirements.txt
python scripts/parse_pdf.py
```

Options:

- `--pdf PATH`   source PDF (default `rulebook.pdf`)
- `--out PATH`   output JSON (default `data/questions.json`)
- `--allow-warnings`  write output even if some answers couldn't be detected
  unambiguously (structural errors still fail the build)

The build **fails loudly** (non-zero exit) unless it finds exactly 300
questions, each with options a–d and exactly one detectable correct answer.

## Reviewing answers (optional but recommended)

Generate a self-contained review page and eyeball the detected answers:

```bash
python scripts/build_review.py     # writes review.html at the repo root
```

Open `review.html` directly in a browser (the data is baked in — no server
needed). Needs-review questions float to the top. Click any option to override
the correct answer; your work is saved in the browser. When done, click
**Download corrections.json** and drop it in `data/`, then re-run the parser:

```bash
python scripts/parse_pdf.py        # applies data/corrections.json
```

Corrected questions become `verified: true` and stick across future re-builds.
`corrections.json` is version-controlled (human-verified data); `review.html`
is a regenerable artifact and is git-ignored.

## Output schema (`data/questions.json`)

```jsonc
{
  "meta": { "source": "rulebook.pdf", "count": 300, "needsReview": 0 },
  "questions": [
    {
      "id": 1,                       // stable 1..300
      "rule": 3,                     // 1..17, or null if only cross-rule tags
      "tags": ["wisselspeler", ...], // KNVB #hashtags (without the #)
      "questionText": "...",
      "options": [ { "letter": "a", "text": "..." }, ... ],
      "correctLetter": "d",
      "confidence": "high",          // "high" | "needs-review"
      "verified": false              // true once confirmed via corrections.json
    }
  ]
}
```

## Notes on the 2025–2026 source

- 300 questions, numbered 1–300.
- Rule numbers are derived from the front-matter tag→rule glossary (the
  question body has no per-question rule headers). 29 questions carry only
  cross-rule general tags and therefore have `rule: null`; filter by tag instead.
- KNVB layers edited text ("wijzigingen in kleur weergegeven"). One question
  (276) had an overlapping duplicate option line; the parser drops re-stated
  option letters so this no longer pollutes the text or the answer detection.
