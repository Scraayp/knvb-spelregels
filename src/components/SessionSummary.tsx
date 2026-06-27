import type { AnswerResult } from "../types";

interface Props {
  results: AnswerResult[];
  onRestart: () => void;
  onHome: () => void;
}

export function SessionSummary({ results, onRestart, onHome }: Props) {
  const total = results.length;
  const correct = results.filter((r) => r.correct).length;
  const accuracy = total ? Math.round((correct / total) * 100) : 0;
  const avgTime = total
    ? Math.round(results.reduce((s, r) => s + r.seconds, 0) / total)
    : 0;

  const stats = [
    { label: "Beantwoord", value: String(total) },
    { label: "Juist", value: `${correct}/${total}` },
    { label: "Score", value: `${accuracy}%` },
    { label: "Gem. tijd", value: `${avgTime}s` },
  ];

  const grade =
    accuracy >= 90 ? "Uitstekend!" : accuracy >= 70 ? "Goed bezig!" : "Blijf oefenen!";

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-10">
      <div className="animate-pop rounded-3xl bg-white p-7 shadow-xl shadow-black/5 dark:bg-white/5">
        <div className="mb-1 text-center text-5xl">
          {accuracy >= 70 ? "🎉" : "💪"}
        </div>
        <h1 className="text-center text-2xl font-bold">{grade}</h1>
        <p className="mb-6 mt-1 text-center text-sm text-zinc-500">
          Sessie afgerond
        </p>

        <div className="grid grid-cols-2 gap-3">
          {stats.map((s) => (
            <div
              key={s.label}
              className="rounded-2xl bg-pitch-50 p-4 text-center dark:bg-white/5"
            >
              <div className="text-2xl font-bold tabular-nums text-pitch-600 dark:text-pitch-400">
                {s.value}
              </div>
              <div className="text-xs font-medium text-zinc-500">{s.label}</div>
            </div>
          ))}
        </div>

        <button
          onClick={onRestart}
          className="mt-6 w-full rounded-xl bg-pitch-500 py-3.5 font-semibold text-white transition hover:bg-pitch-600 active:scale-[.99]"
        >
          Nieuwe sessie
        </button>
        <button
          onClick={onHome}
          className="mt-2 w-full rounded-xl py-3 font-medium text-zinc-500 transition hover:bg-black/5 dark:hover:bg-white/10"
        >
          Terug naar start
        </button>
      </div>
    </div>
  );
}
