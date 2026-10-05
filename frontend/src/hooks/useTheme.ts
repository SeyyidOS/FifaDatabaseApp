import { useCallback, useSyncExternalStore } from "react";

export type Theme = "dark" | "light";
const KEY = "fm-theme";

const listeners = new Set<() => void>();
const read = (): Theme =>
  document.documentElement.dataset.theme === "light" ? "light" : "dark";

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, read, () => "dark" as Theme);
  const setTheme = useCallback((t: Theme) => {
    document.documentElement.dataset.theme = t;
    try {
      localStorage.setItem(KEY, t);
    } catch {
      /* storage unavailable */
    }
    listeners.forEach((l) => l());
  }, []);
  const toggle = useCallback(() => setTheme(read() === "dark" ? "light" : "dark"), [setTheme]);
  return { theme, setTheme, toggle };
}
