export interface Option {
  letter: string;
  text: string;
}

export interface Question {
  id: number;
  rule: number | null;
  tags: string[];
  questionText: string;
  options: Option[];
  correctLetter: string;
  confidence: "high" | "needs-review";
  verified: boolean;
}

export interface QuestionsFile {
  meta: { source: string; count: number; needsReview: number };
  questions: Question[];
}

/** Per-question learning history, persisted in localStorage. */
export interface QuestionStat {
  seen: number;
  correct: number;
  wrong: number;
  /** ISO date string of the last time it was answered. */
  lastSeen: string | null;
}

export type Progress = Record<number, QuestionStat>;

export type TimeMode = "none" | "perQuestion" | "total";
export type SelectionMode = "random" | "weak";
export type ThemePref = "system" | "light" | "dark";

export interface Settings {
  /** null = unlimited questions in a session. */
  sessionSize: number | null;
  timeMode: TimeMode;
  /** Seconds allowed per question (timeMode === "perQuestion"). */
  perQuestionSeconds: number;
  /** Seconds allowed for the whole session (timeMode === "total"). */
  totalSeconds: number;
  selection: SelectionMode;
  /** Restrict to a single rule (1–17) or null for all. */
  ruleFilter: number | null;
  /** Restrict to a single tag or null for all. */
  tagFilter: string | null;
  theme: ThemePref;
}

/** Daily streak / activity tracking. */
export interface DailyState {
  /** ISO date (yyyy-mm-dd) of the most recent answered question. */
  lastActiveDate: string | null;
  /** Consecutive-day streak ending on lastActiveDate. */
  streak: number;
  /** Questions answered today. */
  todayCount: number;
}

/** The result of answering one question within a session. */
export interface AnswerResult {
  questionId: number;
  chosen: string | null; // null = timed out without answering
  correct: boolean;
  seconds: number;
}

export const DAILY_GOAL = 15;
