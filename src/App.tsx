import { useEffect, useState } from "react";
import type {
  AnswerResult,
  DailyState,
  Progress,
  Question,
  Settings,
} from "./types";
import {
  bumpDaily,
  clearAllProgress,
  loadDaily,
  loadProgress,
  loadSettings,
  saveDaily,
  saveProgress,
  saveSettings,
  answeredToday,
} from "./storage";
import { applyTheme } from "./theme";
import { buildSession } from "./selection";
import { useStopwatch } from "./useCountdown";
import { Home } from "./components/Home";
import { StudyScreen } from "./components/StudyScreen";
import { SessionSummary } from "./components/SessionSummary";

type View = "home" | "study" | "summary";

export default function App() {
  const [view, setView] = useState<View>("home");
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [progress, setProgress] = useState<Progress>(loadProgress);
  const [daily, setDaily] = useState<DailyState>(loadDaily);

  const [session, setSession] = useState<Question[]>([]);
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<AnswerResult[]>([]);

  // Session-wide budget timer (only meaningful when timeMode === "total").
  const { elapsedMs, reset: resetTotal } = useStopwatch(
    view === "study" && settings.timeMode === "total",
  );
  const totalRemaining =
    settings.timeMode === "total"
      ? Math.max(0, settings.totalSeconds - elapsedMs / 1000)
      : null;

  // Theme: apply now and react to OS changes while on "system".
  useEffect(() => {
    applyTheme(settings.theme);
    if (settings.theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyTheme("system");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [settings.theme]);

  // End the session when the total budget runs out.
  useEffect(() => {
    if (view === "study" && totalRemaining === 0) setView("summary");
  }, [view, totalRemaining]);

  const changeSettings = (patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  };

  const start = () => {
    const s = buildSession(settings, progress);
    if (s.length === 0) return;
    setSession(s);
    setIndex(0);
    setResults([]);
    resetTotal();
    setView("study");
  };

  const handleAnswer = (r: AnswerResult) => {
    setResults((prev) => [...prev, r]);
    setProgress((prev) => {
      const cur = prev[r.questionId] ?? { seen: 0, correct: 0, wrong: 0, lastSeen: null };
      const next: Progress = {
        ...prev,
        [r.questionId]: {
          seen: cur.seen + 1,
          correct: cur.correct + (r.correct ? 1 : 0),
          wrong: cur.wrong + (r.correct ? 0 : 1),
          lastSeen: new Date().toISOString(),
        },
      };
      saveProgress(next);
      return next;
    });
    setDaily((prev) => {
      const next = bumpDaily(prev);
      saveDaily(next);
      return next;
    });
  };

  const handleNext = () => {
    if (index + 1 >= session.length) setView("summary");
    else setIndex((i) => i + 1);
  };

  const quit = () => setView(results.length > 0 ? "summary" : "home");

  const resetProgress = () => {
    if (!confirm("Weet je het zeker? Alle voortgang wordt gewist.")) return;
    clearAllProgress();
    setProgress({});
    setDaily(loadDaily());
  };

  if (view === "study" && session[index]) {
    return (
      <StudyScreen
        question={session[index]}
        indexInSession={index}
        sessionTotal={session.length}
        answeredToday={answeredToday(daily)}
        settings={settings}
        totalRemaining={totalRemaining}
        onAnswer={handleAnswer}
        onNext={handleNext}
        onQuit={quit}
      />
    );
  }

  if (view === "summary") {
    return (
      <SessionSummary
        results={results}
        onRestart={start}
        onHome={() => setView("home")}
      />
    );
  }

  return (
    <Home
      settings={settings}
      progress={progress}
      daily={daily}
      onChangeSettings={changeSettings}
      onResetProgress={resetProgress}
      onStart={start}
    />
  );
}
