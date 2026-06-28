import { useEffect, useMemo, useState } from "react";
import { useCallbackRef } from "../useCallbackRef";
import type { AnswerResult, Question, Settings } from "../types";
import { DAILY_GOAL } from "../types";
import { ruleLabel } from "../data";
import { shuffle } from "../selection";
import { useStopwatch, formatClock } from "../useCountdown";
import { ProgressRing } from "./ProgressRing";

interface Props {
  question: Question;
  indexInSession: number;
  sessionTotal: number;
  answeredToday: number;
  settings: Settings;
  /** Remaining seconds for the whole session, when timeMode === "total". */
  totalRemaining: number | null;
  onAnswer: (result: AnswerResult) => void;
  onNext: () => void;
  onBack: () => void;
  onQuit: () => void;
}

const DISPLAY_LABELS = ["a", "b", "c", "d"];

export function StudyScreen({
  question,
  indexInSession,
  sessionTotal,
  answeredToday,
  settings,
  totalRemaining,
  onAnswer,
  onNext,
  onBack,
  onQuit,
}: Props) {
  const [chosen, setChosen] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const { elapsedMs, reset } = useStopwatch(!revealed);
  const elapsedSec = elapsedMs / 1000;

  // Shuffle options once per question. `chosen` and `correctLetter` continue
  // to use the original option.letter from the data as the stable key.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const shuffledOptions = useMemo(() => shuffle(question.options), [question.id]);

  // Display label (a/b/c/d) of the correct answer in the shuffled layout.
  const correctDisplayLabel =
    DISPLAY_LABELS[shuffledOptions.findIndex((o) => o.letter === question.correctLetter)];

  // Fresh state for each new question.
  useEffect(() => {
    setChosen(null);
    setRevealed(false);
    reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question.id]);

  const answer = useCallbackRef((letter: string | null) => {
    if (revealed) return;
    setChosen(letter);
    setRevealed(true);
    onAnswer({
      questionId: question.id,
      chosen: letter,
      correct: letter === question.correctLetter,
      seconds: Math.round(elapsedSec),
    });
  });

  const perQuestionLimit =
    settings.timeMode === "perQuestion" ? settings.perQuestionSeconds : null;
  const remaining =
    perQuestionLimit != null ? Math.max(0, perQuestionLimit - elapsedSec) : null;

  // Auto-submit when the per-question limit runs out.
  useEffect(() => {
    if (remaining === 0 && !revealed) answer(null);
  }, [remaining, revealed, answer]);

  // Keyboard: a–d / 1–4 select by display position in the shuffled order.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!revealed) {
        if (e.key === "ArrowLeft" && indexInSession > 0) {
          e.preventDefault();
          onBack();
          return;
        }
        const byLabel = DISPLAY_LABELS.indexOf(e.key.toLowerCase());
        const byNum = "1234".indexOf(e.key);
        const idx = byLabel >= 0 ? byLabel : byNum >= 0 ? byNum : -1;
        if (idx >= 0 && idx < shuffledOptions.length)
          answer(shuffledOptions[idx].letter);
      } else if (e.key === "Enter" || e.key === " " || e.key === "ArrowRight") {
        e.preventDefault();
        onNext();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [revealed, answer, onNext, onBack, indexInSession, shuffledOptions]);

  const isLast = indexInSession + 1 >= sessionTotal;
  const showClock = settings.timeMode !== "none";
  const clockSeconds =
    settings.timeMode === "perQuestion"
      ? (remaining ?? 0)
      : settings.timeMode === "total"
        ? (totalRemaining ?? 0)
        : elapsedSec;
  const clockWarning = showClock && settings.timeMode !== "none" && clockSeconds <= 5;

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col px-4 pb-8 pt-[max(env(safe-area-inset-top),1rem)]">
      {/* top bar */}
      <header className="flex items-center gap-3 py-3">
        <button
          onClick={onQuit}
          className="rounded-lg px-2 py-1 text-sm text-zinc-500 transition hover:bg-black/5 dark:hover:bg-white/10"
          aria-label="Stoppen"
        >
          ✕ Stop
        </button>
        {indexInSession > 0 && !revealed && (
          <button
            onClick={onBack}
            className="rounded-lg px-2 py-1 text-sm text-zinc-500 transition hover:bg-black/5 dark:hover:bg-white/10"
            aria-label="Vorige vraag"
          >
            ← Vorige
          </button>
        )}
        <div className="flex-1">
          <div className="mb-1 flex justify-between text-xs font-medium text-zinc-500">
            <span>
              Vraag {indexInSession + 1} / {sessionTotal}
            </span>
            {showClock && (
              <span
                className={
                  "tabular-nums " +
                  (clockWarning ? "font-bold text-red-500" : "text-zinc-500")
                }
              >
                ⏱ {formatClock(clockSeconds)}
              </span>
            )}
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-pitch-100 dark:bg-white/10">
            <div
              className="h-full rounded-full bg-pitch-500 transition-[width] duration-300"
              style={{ width: `${((indexInSession + 1) / sessionTotal) * 100}%` }}
            />
          </div>
        </div>
        <ProgressRing value={answeredToday} goal={DAILY_GOAL} />
      </header>

      {/* question */}
      <main className="flex flex-1 flex-col justify-center py-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-pitch-500/10 px-2.5 py-1 text-xs font-semibold text-pitch-600 dark:text-pitch-400">
            {ruleLabel(question.rule)}
          </span>
          {question.tags.slice(0, 4).map((t) => (
            <span key={t} className="text-xs text-zinc-400">
              #{t}
            </span>
          ))}
        </div>

        <h1 className="text-lg font-semibold leading-snug sm:text-xl">
          {question.questionText}
        </h1>

        <div className="mt-5 grid gap-2.5">
          {shuffledOptions.map((opt, i) => {
            const displayLabel = DISPLAY_LABELS[i];
            const isCorrect = opt.letter === question.correctLetter;
            const isChosen = opt.letter === chosen;
            let cls =
              "border-zinc-200 bg-white hover:border-pitch-400 dark:border-white/10 dark:bg-white/5";
            if (revealed) {
              if (isCorrect)
                cls = "border-emerald-500 bg-emerald-50 dark:bg-emerald-500/15";
              else if (isChosen)
                cls = "border-red-500 bg-red-50 dark:bg-red-500/15";
              else
                cls =
                  "border-zinc-200 bg-white opacity-50 dark:border-white/10 dark:bg-white/5";
            }
            return (
              <button
                key={opt.letter}
                disabled={revealed}
                onClick={() => answer(opt.letter)}
                className={
                  "flex items-start gap-3 rounded-xl border-2 p-3.5 text-left transition " +
                  (revealed ? "cursor-default " : "active:scale-[.99] ") +
                  cls
                }
              >
                <span
                  className={
                    "grid h-7 w-7 shrink-0 place-items-center rounded-lg text-sm font-bold uppercase " +
                    (revealed && isCorrect
                      ? "bg-emerald-500 text-white"
                      : revealed && isChosen
                        ? "bg-red-500 text-white"
                        : "bg-pitch-500/10 text-pitch-600 dark:text-pitch-400")
                  }
                >
                  {displayLabel}
                </span>
                <span className="pt-0.5 text-[15px] leading-snug">{opt.text}</span>
              </button>
            );
          })}
        </div>

        {/* feedback / why */}
        {revealed && (
          <div className="animate-pop mt-5">
            <div
              className={
                "rounded-xl p-4 " +
                (chosen === question.correctLetter
                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                  : "bg-red-500/10 text-red-700 dark:text-red-300")
              }
            >
              <p className="font-semibold">
                {chosen === null
                  ? "⏱ Tijd voorbij"
                  : chosen === question.correctLetter
                    ? "✓ Goed!"
                    : "✗ Helaas"}
                <span className="ml-1 font-normal">
                  Het juiste antwoord is{" "}
                  <b className="uppercase">{correctDisplayLabel}</b>.
                </span>
              </p>
              <p className="mt-1 text-sm opacity-80">
                {ruleLabel(question.rule)}
                {question.tags.length > 0 &&
                  " · " + question.tags.map((t) => "#" + t).join(" ")}
              </p>
            </div>
            <button
              onClick={onNext}
              autoFocus
              className="mt-4 w-full rounded-xl bg-pitch-500 py-3.5 font-semibold text-white shadow-sm transition hover:bg-pitch-600 active:scale-[.99]"
            >
              {isLast ? "Afronden" : "Volgende"} →
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
