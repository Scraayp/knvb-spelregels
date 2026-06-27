# Spelregels Trainer — KNVB Veldvoetbal

A self-learning trainer for the KNVB football-rules exam (*spelregelvragen
veldvoetbal*). 300 official multiple-choice questions, answered one at a time
with instant feedback, a stopwatch, progress tracking and a daily goal.

No accounts, no backend, no database — everything runs in the browser and all
progress stays in `localStorage`. It works fully offline and hosts on any
static host (GitHub Pages / Netlify / Vercel) for free.

## Two phases

### 1. Data build (run occasionally)

The questions live in the KNVB PDF (`rulebook.pdf`), where the **correct answer
is encoded as an italic font**, not as text. A Python script recovers that and
emits a validated `data/questions.json`. Re-run it each September when KNVB
swaps ~50 questions.

```bash
pip install -r scripts/requirements.txt
python scripts/parse_pdf.py          # -> data/questions.json (fails loudly if broken)
python scripts/build_review.py       # -> review.html (optional: eyeball/fix answers)
```

See [scripts/README.md](scripts/README.md) for the parser, the review screen
and the human-correction loop.

### 2. The app (what users touch)

A Vite + React + TypeScript single-page app. `data/questions.json` is bundled
at build time, so the app needs no network at runtime.

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # -> dist/  (static, deploy anywhere)
```

For project-page hosting under a sub-path (e.g. GitHub Pages):

```bash
VITE_BASE=/knvb-spelregels/ npm run build
```

## Features

- **Study flow** — one question at a time, four large tappable answer cards,
  red/green feedback, the rule + tags shown as the "why", then next.
- **Timing** — neutral count-up stopwatch by default; optional per-question or
  whole-session time limit with a warning near zero.
- **Smart selection** — pure random (default) or "focus on weak spots", which
  weights toward unseen and previously-wrong questions while still feeling
  random. Filter by rule (1–17) or by KNVB topic tag.
- **Progress** — per-question history, overall accuracy, a daily goal ring and
  a day streak, all persisted locally.
- **Design** — responsive phone → desktop, KNVB-orange accent, light/dark/system
  theme. The home screen has a labelled placeholder for the official logo.

## Project layout

```
rulebook.pdf            source PDF (KNVB)
scripts/                Python data pipeline (parser + review-screen generator)
data/questions.json     built question bank (the bridge between phases)
src/                    React app
  components/           Home, StudyScreen, SessionSummary, SettingsPanel, …
  selection.ts          random / weak-spot session building
  storage.ts            localStorage: settings, progress, daily streak
  data.ts types.ts      bundled data + the schema
```

## Correctness guarantee

Each option lives **inside** its question object alongside `correctLetter`, so
the answer can never drift away from its question — even when the UI shuffles
the order. The parser also enforces structural invariants (exactly 300
questions, 4 options each, one detectable answer) and fails the build otherwise.

## Branding note

The orange/whistle styling is original. Drop the official KNVB logo into the
placeholder on the home screen only once you have permission to use it.
