#!/usr/bin/env python3
"""
Generate a self-contained review.html for eyeballing answer correctness.

It bakes data/questions.json straight into the page, so it opens directly in a
browser (no server, no CORS hassle). You page through the questions, the
detected correct answer is highlighted, and you can click any option to
override it. Hit "Download corrections.json", drop the file in data/, and
re-run parse_pdf.py to bake the fixes in permanently.

    python scripts/build_review.py     # writes review.html at the repo root
"""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_IN = ROOT / "data" / "questions.json"
DEFAULT_OUT = ROOT / "review.html"

TEMPLATE = r"""<!doctype html>
<html lang="nl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Spelregels — Answer Review</title>
<style>
  :root {
    --bg: #f4f5f7; --card: #ffffff; --ink: #1a1d21; --muted: #6b7280;
    --line: #e3e6ea; --accent: #ff6a00; --ok: #19a974; --ok-bg: #e7f7ef;
    --warn: #d9480f; --override: #1d72d8; --override-bg: #e8f1fc;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #15171b; --card: #1e2127; --ink: #e8eaed; --muted: #9aa3ad;
      --line: #2c313a; --ok-bg: #15302440; --override-bg: #16263e;
    }
  }
  * { box-sizing: border-box; }
  body { margin: 0; font: 15px/1.5 system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
         background: var(--bg); color: var(--ink); }
  header { position: sticky; top: 0; z-index: 5; background: var(--card);
           border-bottom: 1px solid var(--line); padding: 12px 20px;
           display: flex; gap: 14px; align-items: center; flex-wrap: wrap; }
  header h1 { font-size: 16px; margin: 0; }
  header h1 .dot { color: var(--accent); }
  .stat { font-size: 13px; color: var(--muted); }
  .stat b { color: var(--ink); }
  .grow { flex: 1; }
  input, select, button { font: inherit; padding: 7px 10px; border-radius: 8px;
           border: 1px solid var(--line); background: var(--card); color: var(--ink); }
  button { cursor: pointer; }
  button.primary { background: var(--accent); color: #fff; border-color: var(--accent); font-weight: 600; }
  button.primary:disabled { opacity: .5; cursor: not-allowed; }
  main { max-width: 860px; margin: 0 auto; padding: 20px; }
  .q { background: var(--card); border: 1px solid var(--line); border-radius: 14px;
       padding: 18px 20px; margin-bottom: 16px; }
  .q.flag { border-color: var(--warn); box-shadow: 0 0 0 1px var(--warn); }
  .q-top { display: flex; gap: 10px; align-items: baseline; flex-wrap: wrap; margin-bottom: 8px; }
  .q-id { font-weight: 700; color: var(--accent); }
  .pill { font-size: 11px; padding: 2px 8px; border-radius: 999px; background: var(--bg);
          color: var(--muted); border: 1px solid var(--line); }
  .pill.review { background: #fff3e6; color: var(--warn); border-color: var(--warn); }
  .pill.verified { background: var(--ok-bg); color: var(--ok); border-color: var(--ok); }
  .pill.override { background: var(--override-bg); color: var(--override); border-color: var(--override); }
  .tags { color: var(--muted); font-size: 12px; }
  .stem { margin: 6px 0 12px; }
  .opt { display: flex; gap: 10px; align-items: flex-start; padding: 9px 12px;
         border: 1px solid var(--line); border-radius: 9px; margin: 6px 0; cursor: pointer; }
  .opt:hover { border-color: var(--accent); }
  .opt .let { font-weight: 700; text-transform: uppercase; min-width: 18px; }
  .opt.correct { background: var(--ok-bg); border-color: var(--ok); }
  .opt.correct .let { color: var(--ok); }
  .opt.overridden { background: var(--override-bg); border-color: var(--override); }
  .opt.overridden .let { color: var(--override); }
  .opt .check { margin-left: auto; font-weight: 700; }
  .hint { font-size: 12px; color: var(--muted); margin-top: 8px; }
  .empty { text-align: center; color: var(--muted); padding: 60px 0; }
  kbd { background: var(--bg); border: 1px solid var(--line); border-bottom-width: 2px;
        border-radius: 5px; padding: 1px 6px; font: 12px monospace; }
</style>
</head>
<body>
<header>
  <h1>Spelregels <span class="dot">●</span> Answer Review</h1>
  <span class="stat" id="stat"></span>
  <span class="grow"></span>
  <input id="search" placeholder="Search id / text / tag…" style="min-width:200px">
  <select id="filter">
    <option value="all">All</option>
    <option value="review">Needs review</option>
    <option value="override">Overridden</option>
    <option value="unverified">Unverified</option>
  </select>
  <button id="download" class="primary" disabled>Download corrections.json</button>
  <button id="reset">Reset overrides</button>
</header>
<main id="list"></main>

<script type="application/json" id="data">__DATA__</script>
<script>
const DATA = JSON.parse(document.getElementById('data').textContent);
const QUESTIONS = DATA.questions;
const LS_OVR = 'knvb-review-overrides';
const LS_DONE = 'knvb-review-done';
let overrides = JSON.parse(localStorage.getItem(LS_OVR) || '{}');   // {id: letter}
let done = new Set(JSON.parse(localStorage.getItem(LS_DONE) || '[]')); // reviewed ids

const $ = s => document.querySelector(s);
const list = $('#list'), search = $('#search'), filter = $('#filter');

function save() {
  localStorage.setItem(LS_OVR, JSON.stringify(overrides));
  localStorage.setItem(LS_DONE, JSON.stringify([...done]));
}
function effectiveCorrect(q) { return overrides[q.id] || q.correctLetter; }
function isOverridden(q) { return overrides[q.id] && overrides[q.id] !== q.correctLetter; }

function matches(q) {
  const f = filter.value;
  if (f === 'review' && q.confidence !== 'needs-review') return false;
  if (f === 'override' && !isOverridden(q)) return false;
  if (f === 'unverified' && (done.has(q.id) || q.verified)) return false;
  const term = search.value.trim().toLowerCase();
  if (!term) return true;
  if (String(q.id) === term) return true;
  if (q.questionText.toLowerCase().includes(term)) return true;
  if (q.tags.some(t => t.toLowerCase().includes(term))) return true;
  return q.options.some(o => o.text.toLowerCase().includes(term));
}

function render() {
  const ovrCount = Object.keys(overrides).length;
  $('#stat').innerHTML =
    `<b>${QUESTIONS.length}</b> questions · reviewed <b>${done.size}</b> · ` +
    `overrides <b>${ovrCount}</b> · needs-review <b>${QUESTIONS.filter(q=>q.confidence==='needs-review').length}</b>`;
  $('#download').disabled = ovrCount === 0;

  // needs-review first, then by id
  const rows = QUESTIONS.filter(matches).sort((a,b) =>
    (a.confidence==='needs-review'?0:1) - (b.confidence==='needs-review'?0:1) || a.id-b.id);

  if (!rows.length) { list.innerHTML = '<div class="empty">No questions match.</div>'; return; }

  list.innerHTML = rows.map(q => {
    const eff = effectiveCorrect(q);
    const flags = [];
    if (q.confidence === 'needs-review') flags.push('<span class="pill review">needs review</span>');
    if (q.verified) flags.push('<span class="pill verified">verified in build</span>');
    if (done.has(q.id)) flags.push('<span class="pill verified">✓ reviewed</span>');
    if (isOverridden(q)) flags.push(`<span class="pill override">override: ${q.correctLetter}→${eff}</span>`);
    const rule = q.rule ? `Regel ${q.rule}` : 'no rule';
    return `<div class="q ${q.confidence==='needs-review'?'flag':''}" data-id="${q.id}">
      <div class="q-top">
        <span class="q-id">${q.id}.</span>
        <span class="pill">${rule}</span>
        ${flags.join('')}
        <span class="grow"></span>
        <span class="tags">${q.tags.map(t=>'#'+t).join(' ')}</span>
      </div>
      <div class="stem">${esc(q.questionText)}</div>
      ${q.options.map(o => {
        const cls = o.letter===eff ? (isOverridden(q)?'opt overridden':'opt correct') : 'opt';
        return `<div class="${cls}" data-id="${q.id}" data-letter="${o.letter}">
          <span class="let">${o.letter}</span><span>${esc(o.text)}</span>
          ${o.letter===eff?'<span class="check">✓</span>':''}</div>`;
      }).join('')}
      <div class="hint">Click an option to set the correct answer. Detected by parser: <b>${q.correctLetter}</b>.</div>
    </div>`;
  }).join('');
}

function esc(s){ return s.replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])); }

list.addEventListener('click', e => {
  const opt = e.target.closest('.opt'); if (!opt) return;
  const id = +opt.dataset.id, letter = opt.dataset.letter;
  const q = QUESTIONS.find(x => x.id === id);
  if (letter === q.correctLetter) delete overrides[id];   // clicking detected clears override
  else overrides[id] = letter;
  done.add(id);
  save(); render();
});

search.addEventListener('input', render);
filter.addEventListener('change', render);

$('#download').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(overrides, null, 2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'corrections.json'; a.click();
});

$('#reset').addEventListener('click', () => {
  if (!confirm('Clear all local overrides and review marks?')) return;
  overrides = {}; done = new Set(); save(); render();
});

render();
</script>
</body>
</html>
"""


def main() -> int:
    if not DEFAULT_IN.exists():
        print(f"ERROR: {DEFAULT_IN} not found. Run parse_pdf.py first.")
        return 2
    payload = json.loads(DEFAULT_IN.read_text(encoding="utf-8"))
    data_json = json.dumps(payload, ensure_ascii=False).replace("</", "<\\/")
    html = TEMPLATE.replace("__DATA__", data_json)
    DEFAULT_OUT.write_text(html, encoding="utf-8")
    n = len(payload["questions"])
    print(f"Wrote {DEFAULT_OUT.relative_to(ROOT)} ({n} questions baked in).")
    print("Open it in a browser, review, then Download corrections.json into data/.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
