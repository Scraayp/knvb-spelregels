import { useState } from "react";
import type { DailyState, Progress, Settings } from "../types";
import { DAILY_GOAL } from "../types";
import { QUESTIONS } from "../data";
import { filteredPool } from "../selection";
import { answeredToday } from "../storage";
import { ProgressRing } from "./ProgressRing";
import { SettingsPanel } from "./SettingsPanel";

interface Props {
  settings: Settings;
  progress: Progress;
  daily: DailyState;
  onChangeSettings: (patch: Partial<Settings>) => void;
  onResetProgress: () => void;
  onStart: () => void;
}

export function Home({
  settings,
  progress,
  daily,
  onChangeSettings,
  onResetProgress,
  onStart,
}: Props) {
  const [showSettings, setShowSettings] = useState(false);

  const seenIds = Object.keys(progress);
  const seen = seenIds.length;
  const totals = Object.values(progress).reduce(
    (acc, s) => {
      acc.correct += s.correct;
      acc.answered += s.correct + s.wrong;
      return acc;
    },
    { correct: 0, answered: 0 },
  );
  const accuracy = totals.answered
    ? Math.round((totals.correct / totals.answered) * 100)
    : 0;
  const poolSize = filteredPool(settings).length;
  const today = answeredToday(daily);

  return (
    <div className="min-h-dvh md:flex">
      {/* ── Main column ─────────────────────────────────────────── */}
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pb-10 pt-[max(env(safe-area-inset-top),2rem)] md:mx-0 md:min-h-dvh md:max-w-none md:flex-1 md:px-14 md:py-14">
        {/* brand */}
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-pitch-500 text-2xl shadow-lg shadow-pitch-500/30 md:h-14 md:w-14 md:text-3xl">
            ⚽
          </div>
          <div>
            <h1 className="text-xl font-extrabold leading-none md:text-2xl">Spelregels</h1>
            <p className="text-sm text-zinc-500">Veldvoetbal · oefenvragen</p>
          </div>
          {/* gear toggle: mobile only */}
          <button
            onClick={() => setShowSettings((v) => !v)}
            className="ml-auto rounded-xl p-2 text-xl text-zinc-500 transition hover:bg-black/5 dark:hover:bg-white/10 md:hidden"
            aria-label="Instellingen"
          >
            {showSettings ? "✕" : "⚙"}
          </button>
        </div>

        {/* mobile-only collapsible settings */}
        {showSettings && (
          <div className="mt-7 md:hidden">
            <SettingsPanel
              settings={settings}
              onChange={onChangeSettings}
              onResetProgress={onResetProgress}
            />
          </div>
        )}

        {/* main content — hidden on mobile when settings open, always shown on desktop */}
        <div className={`flex flex-1 flex-col ${showSettings ? "hidden md:flex" : ""}`}>
          {/* daily goal card */}
          <div className="mt-7 flex items-center gap-4 rounded-3xl bg-white p-5 shadow-lg shadow-black/5 dark:bg-white/5 md:gap-7 md:p-7">
            <ProgressRing value={today} goal={DAILY_GOAL} size={68} />
            <div>
              <p className="font-semibold md:text-lg">
                {today >= DAILY_GOAL
                  ? "Dagdoel gehaald! 🎉"
                  : `Nog ${DAILY_GOAL - today} voor je dagdoel`}
              </p>
              <p className="text-sm text-zinc-500">
                {daily.streak > 0
                  ? `🔥 ${daily.streak} dagen op rij`
                  : "Begin vandaag je reeks"}
              </p>
            </div>
          </div>

          {/* overall stats */}
          <div className="mt-3 grid grid-cols-3 gap-3 md:mt-4 md:gap-4">
            {[
              { label: "Gezien", value: `${seen}/${QUESTIONS.length}` },
              { label: "Score", value: totals.answered ? `${accuracy}%` : "–" },
              { label: "In set", value: String(poolSize) },
            ].map((s) => (
              <div
                key={s.label}
                className="rounded-2xl bg-white p-3 text-center shadow-sm shadow-black/5 dark:bg-white/5 md:rounded-3xl md:p-6"
              >
                <div className="text-lg font-bold tabular-nums md:text-3xl">{s.value}</div>
                <div className="text-xs text-zinc-500 md:mt-1 md:text-sm">{s.label}</div>
              </div>
            ))}
          </div>

          <div className="flex-1" />

          {/* active filters hint */}
          {(settings.ruleFilter != null || settings.tagFilter != null) && (
            <p className="mb-2 text-center text-sm text-zinc-500">
              Filter actief:{" "}
              {settings.ruleFilter != null && `Regel ${settings.ruleFilter}`}
              {settings.ruleFilter != null && settings.tagFilter != null && " · "}
              {settings.tagFilter != null && `#${settings.tagFilter}`}
            </p>
          )}

          <button
            onClick={onStart}
            disabled={poolSize === 0}
            className="mt-6 w-full rounded-2xl bg-pitch-500 py-4 text-lg font-bold text-white shadow-xl shadow-pitch-500/25 transition hover:bg-pitch-600 active:scale-[.99] disabled:opacity-50 md:max-w-xs md:rounded-2xl md:py-5 md:text-xl"
          >
            Start oefenen
          </button>
          <p className="mt-3 text-center text-xs text-zinc-400">
            {settings.selection === "weak"
              ? "Focus op je zwakke punten"
              : "Willekeurige vragen"}
            {" · "}
            {settings.sessionSize ? `${settings.sessionSize} vragen` : "onbeperkt"}
          </p>
        </div>
      </div>

      {/* ── Right sidebar: desktop only ─────────────────────────── */}
      <aside className="hidden md:flex md:w-80 md:shrink-0 md:flex-col md:border-l md:border-black/[.07] md:bg-white md:px-10 md:py-14 dark:md:border-white/[.07] dark:md:bg-white/3">
        <h2 className="mb-6 text-base font-bold text-zinc-700 dark:text-zinc-200">
          Instellingen
        </h2>
        <SettingsPanel
          settings={settings}
          onChange={onChangeSettings}
          onResetProgress={onResetProgress}
        />
      </aside>
    </div>
  );
}
