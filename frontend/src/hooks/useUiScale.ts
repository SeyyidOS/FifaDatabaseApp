import { useSyncExternalStore } from "react";

/**
 * How big this device draws the whole interface: an experiment, to find out which size works best as the
 * default. It sets the root font size every rem is measured from, so text, spacing and cards shrink or grow
 * together and the layout reflows, much like zooming in a browser. index.html applies the saved size
 * before the app draws, so nothing jumps.
 */
export const UI_SCALES = { xs: 0.8125, s: 0.875, m: 1, l: 1.125 } as const;
export type UiScale = keyof typeof UI_SCALES;

const KEY = "matchnight.uiScale";
const listeners = new Set<() => void>();

const isScale = (v: string | null): v is UiScale => v !== null && v in UI_SCALES;

function stored(): UiScale {
  try {
    const v = localStorage.getItem(KEY);
    return isScale(v) ? v : "m";
  } catch {
    return "m";
  }
}

let current = stored();

export function setUiScale(scale: UiScale) {
  try {
    if (scale === "m") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, scale);
  } catch {
    // kept for this visit only
  }
  current = scale;
  document.documentElement.style.fontSize = scale === "m" ? "" : `${UI_SCALES[scale] * 100}%`;
  listeners.forEach((l) => l());
}

export function useUiScale(): UiScale {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
  );
}
