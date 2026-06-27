import { useEffect, useRef, useState } from "react";

/**
 * A monotonic stopwatch. `elapsedMs` ticks while `running` is true; `reset`
 * zeroes it. Uses performance.now so it stays accurate across tab throttling.
 */
export function useStopwatch(running: boolean) {
  const [elapsedMs, setElapsed] = useState(0);
  const startRef = useRef<number>(0);
  const baseRef = useRef<number>(0);

  useEffect(() => {
    if (!running) return;
    startRef.current = performance.now();
    const tick = () =>
      setElapsed(baseRef.current + (performance.now() - startRef.current));
    tick();
    const id = setInterval(tick, 200);
    return () => {
      baseRef.current += performance.now() - startRef.current;
      clearInterval(id);
    };
  }, [running]);

  const reset = () => {
    baseRef.current = 0;
    startRef.current = performance.now();
    setElapsed(0);
  };

  return { elapsedMs, reset };
}

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}
