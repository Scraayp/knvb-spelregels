import { QUESTIONS } from "./data";
import type { Progress, Question, Settings } from "./types";

/** Fisher–Yates shuffle (returns a new array). */
export function shuffle<T>(arr: readonly T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Apply rule/tag filters to produce the pool a session draws from. */
export function filteredPool(settings: Settings): Question[] {
  return QUESTIONS.filter((q) => {
    if (settings.ruleFilter != null && q.rule !== settings.ruleFilter) return false;
    if (settings.tagFilter != null && !q.tags.includes(settings.tagFilter)) return false;
    return true;
  });
}

/**
 * Weight a question for "prioritise weak spots": never-seen questions rank
 * highest, then ones answered wrong, with a recency nudge so freshly-correct
 * ones drift to the back. Always > 0 so everything stays reachable.
 */
function weight(q: Question, progress: Progress): number {
  const stat = progress[q.id];
  if (!stat || stat.seen === 0) return 6;
  const wrongRate = stat.wrong / Math.max(1, stat.correct + stat.wrong);
  let w = 1 + wrongRate * 4; // 1 (always right) … 5 (always wrong)
  if (stat.lastSeen) {
    const days = (Date.now() - new Date(stat.lastSeen).getTime()) / 86_400_000;
    w += Math.min(days, 14) / 14; // up to +1 for staleness
  }
  return w;
}

/** Weighted sampling without replacement. */
function weightedSample(pool: Question[], progress: Progress, n: number): Question[] {
  const items = pool.map((q) => ({ q, w: weight(q, progress) }));
  const picked: Question[] = [];
  while (picked.length < n && items.length > 0) {
    const total = items.reduce((s, it) => s + it.w, 0);
    let r = Math.random() * total;
    let idx = 0;
    for (; idx < items.length; idx++) {
      r -= items[idx].w;
      if (r <= 0) break;
    }
    const [chosen] = items.splice(Math.min(idx, items.length - 1), 1);
    picked.push(chosen.q);
  }
  return picked;
}

/**
 * Build the ordered list of questions for one session, honouring the
 * selection mode, filters and session size. Order always feels random.
 */
export function buildSession(settings: Settings, progress: Progress): Question[] {
  const pool = filteredPool(settings);
  const size = settings.sessionSize ?? pool.length;
  const n = Math.min(size, pool.length);

  if (settings.selection === "weak") {
    return weightedSample(pool, progress, n);
  }
  return shuffle(pool).slice(0, n);
}
