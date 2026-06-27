import type { ThemePref } from "./types";

/** Apply the chosen theme to <html>, following the OS when set to "system". */
export function applyTheme(pref: ThemePref): void {
  const prefersDark =
    pref === "dark" ||
    (pref === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", prefersDark);
}
