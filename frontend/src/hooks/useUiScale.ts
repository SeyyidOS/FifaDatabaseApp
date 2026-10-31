import { useSyncExternalStore } from "react";

/**
 * How big this device draws the whole interface. It sets the root font size every rem is measured from, so
 * text, spacing and cards shrink or grow together and the layout reflows, much like zooming in a browser.
 * Phones start at the smallest size (index.css), everything else at normal; a size picked in the account
 * menu is kept on this device and wins. index.html applies it before the app draws, so nothing jumps.
 */
export const UI_SCALES = { xs: 0.8125, s: 0.875, m: 1, l: 1.125 } as const;
export type UiScale = keyof typeof UI_SCALES;

const KEY = "matchnight.uiScale";
// the same query as the phone size in index.css
const PHONE = "(max-width: 639px), (pointer: coarse) and (max-height: 639px)";
const listeners = new Set<() => void>();

const isScale = (v: string | null): v is UiScale => v !== null && v in UI_SCALES;

function picked(): UiScale | null {
  try {
    const v = localStorage.getItem(KEY);
    return isScale(v) ? v : null;
  } catch {
    return null;
  }
}

const phone = typeof matchMedia === "function" ? matchMedia(PHONE) : null;
const deviceSize = (): UiScale => (phone?.matches ? "xs" : "m");

let choice = picked();

export function setUiScale(scale: UiScale) {
  // the device's own size is not kept, so it keeps following the screen
  choice = scale === deviceSize() ? null : scale;
  try {
    if (choice) localStorage.setItem(KEY, choice);
    else localStorage.removeItem(KEY);
  } catch {
    // kept for this visit only
  }
  document.documentElement.style.fontSize = choice ? `${UI_SCALES[choice] * 100}%` : "";
  listeners.forEach((l) => l());
}

export function useUiScale(): UiScale {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      phone?.addEventListener("change", l);
      return () => {
        listeners.delete(l);
        phone?.removeEventListener("change", l);
      };
    },
    () => choice ?? deviceSize(),
  );
}
