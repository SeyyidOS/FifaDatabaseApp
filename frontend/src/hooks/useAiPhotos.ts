import { useSyncExternalStore } from "react";

/**
 * Whether this device's match photos may be read by the AI service that fills in the stats
 * (deploy/match-stats.py): asked before the first photo is picked (components/match/AiConsent.tsx) and
 * sent with every upload; null until asked. A photo without it is only kept.
 */
export type AiPhotos = boolean | null;

const KEY = "matchnight.aiPhotos";
const listeners = new Set<() => void>();

function stored(): AiPhotos {
  try {
    const v = localStorage.getItem(KEY);
    return v === "yes" ? true : v === "no" ? false : null;
  } catch {
    return null;
  }
}

let current = stored();

export function setAiPhotos(value: boolean) {
  try {
    localStorage.setItem(KEY, value ? "yes" : "no");
  } catch {
    // kept for this visit only
  }
  current = value;
  listeners.forEach((l) => l());
}

/** At upload time: the answer given when the photos were picked. */
export const aiPhotos = () => current === true;

export function useAiPhotos(): AiPhotos {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
  );
}
