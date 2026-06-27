import type { Question, QuestionsFile } from "./types";
import raw from "../data/questions.json";

const file = raw as unknown as QuestionsFile;

/** All questions, bundled at build time (works fully offline). */
export const QUESTIONS: Question[] = file.questions;

export const QUESTIONS_BY_ID = new Map<number, Question>(
  QUESTIONS.map((q) => [q.id, q]),
);

/** Distinct rule numbers present in the data, sorted ascending. */
export const RULES: number[] = [
  ...new Set(QUESTIONS.map((q) => q.rule).filter((r): r is number => r != null)),
].sort((a, b) => a - b);

/** Distinct tags, sorted by frequency (most common first). */
export const TAGS: string[] = (() => {
  const counts = new Map<string, number>();
  for (const q of QUESTIONS)
    for (const t of q.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t);
})();

/** Dutch-friendly label for a rule number. */
export function ruleLabel(rule: number | null): string {
  return rule == null ? "Algemeen" : `Regel ${rule}`;
}
