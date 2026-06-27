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
    <div className="mx-auto flex min-h-dvh max-w-md flex-col px-5 pb-10 pt-[max(env(safe-area-inset-top),2rem)]">
      {/* brand */}
      <div className="flex items-center gap-3">
        {/* Placeholder for the official KNVB logo (drops in here if licensed). */}
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-pitch-500 text-2xl shadow-lg shadow-pitch-500/30">
          ⚽
        </div>
        <div>
          <h1 className="text-xl font-extrabold leading-none">Spelregels</h1>
          <p className="text-sm text-zinc-500">Veldvoetbal · oefenvragen</p>
        </div>
        <button
          onClick={() => setShowSettings((v) => !v)}
          className="ml-auto rounded-xl p-2 text-xl text-zinc-500 transition hover:bg-black/5 dark:hover:bg-white/10"
          aria-label="Instellingen"
        >
          {showSettings ? "✕" : "⚙"}
        </button>
      </div>

      {showSettings ? (
        <div className="mt-7">
          <SettingsPanel
            settings={settings}
            onChange={onChangeSettings}
            onResetProgress={onResetProgress}
          />
        </div>
      ) : (
        <>
          {/* daily goal card */}
          <div className="mt-7 flex items-center gap-4 rounded-3xl bg-white p-5 shadow-lg shadow-black/5 dark:bg-white/5">
            <ProgressRing value={today} goal={DAILY_GOAL} size={68} />
            <div>
              <p className="font-semibold">
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
          <div className="mt-3 grid grid-cols-3 gap-3">
            {[
              { label: "Gezien", value: `${seen}/${QUESTIONS.length}` },
              { label: "Score", value: totals.answered ? `${accuracy}%` : "–" },
              { label: "In set", value: String(poolSize) },
            ].map((s) => (
              <div
                key={s.label}
                className="rounded-2xl bg-white p-3 text-center shadow-sm shadow-black/5 dark:bg-white/5"
              >
                <div className="text-lg font-bold tabular-nums">{s.value}</div>
                <div className="text-xs text-zinc-500">{s.label}</div>
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
            className="mt-6 w-full rounded-2xl bg-pitch-500 py-4 text-lg font-bold text-white shadow-xl shadow-pitch-500/25 transition hover:bg-pitch-600 active:scale-[.99] disabled:opacity-50"
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
        </>
      )}
    </div>
  );
}
