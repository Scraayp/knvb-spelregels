import { useCallback, useInsertionEffect, useRef } from "react";

/**
 * Returns a stable function identity that always calls the latest `fn`.
 * Lets effects depend on a handler without re-running every render
 * (a lightweight stand-in for the future `useEffectEvent`).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useCallbackRef<T extends (...args: any[]) => any>(fn: T): T {
  const ref = useRef(fn);
  useInsertionEffect(() => {
    ref.current = fn;
  });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useCallback(((...args) => ref.current(...args)) as T, []);
}
