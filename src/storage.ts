import type { DailyState, Progress, Settings } from "./types";

const KEYS = {
  progress: "knvb.progress",
  settings: "knvb.settings",
  daily: "knvb.daily",
} as const;

export const DEFAULT_SETTINGS: Settings = {
  sessionSize: 15,
  timeMode: "none",
  perQuestionSeconds: 30,
  totalSeconds: 600,
  selection: "random",
  ruleFilter: null,
  tagFilter: null,
  theme: "system",
};

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...(JSON.parse(raw) as T) } : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or unavailable — progress is best-effort */
  }
}

export const loadSettings = (): Settings => read(KEYS.settings, DEFAULT_SETTINGS);
export const saveSettings = (s: Settings): void => write(KEYS.settings, s);

export const loadProgress = (): Progress => read<Progress>(KEYS.progress, {});
export const saveProgress = (p: Progress): void => write(KEYS.progress, p);

export const loadDaily = (): DailyState =>
  read<DailyState>(KEYS.daily, {
    lastActiveDate: null,
    streak: 0,
    todayCount: 0,
  });
export const saveDaily = (d: DailyState): void => write(KEYS.daily, d);

export function clearAllProgress(): void {
  for (const k of [KEYS.progress, KEYS.daily]) {
    try {
      localStorage.removeItem(k);
    } catch {
      /* ignore */
    }
  }
}

/** Local yyyy-mm-dd (not UTC) so "today" matches the user's calendar. */
export function todayKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function daysBetween(a: string, b: string): number {
  const ms = new Date(b + "T00:00").getTime() - new Date(a + "T00:00").getTime();
  return Math.round(ms / 86_400_000);
}

/**
 * Fold one answered question into the daily streak/count, resetting the
 * day counter when the calendar date rolls over and breaking the streak
 * after a skipped day.
 */
export function bumpDaily(d: DailyState): DailyState {
  const today = todayKey();
  if (d.lastActiveDate === today) {
    return { ...d, todayCount: d.todayCount + 1 };
  }
  const gap = d.lastActiveDate ? daysBetween(d.lastActiveDate, today) : Infinity;
  const streak = gap === 1 ? d.streak + 1 : 1;
  return { lastActiveDate: today, streak, todayCount: 1 };
}

/** todayCount is only valid if lastActiveDate is actually today. */
export function answeredToday(d: DailyState): number {
  return d.lastActiveDate === todayKey() ? d.todayCount : 0;
}
