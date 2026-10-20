import { useSyncExternalStore } from "react";
import { has } from "../lib/edition";
import { BADGE_STYLES, type BadgeStyle } from "../lib/kits";

/** How clubs are shown: their real crests (the classic edition only) or a badge drawn from their kit. */
export type CrestStyle = "real" | BadgeStyle;

/** the store edition's badge */
export const STORE_BADGE: BadgeStyle = "kit";

// a device can try another look (Settings, CrestLook); nobody else sees it
const KEY = "matchnight.crestStyle";
const fallback = (): CrestStyle => (has("realCrests") ? "real" : STORE_BADGE);

const allowed = (v: string | null): v is CrestStyle =>
  v === "real" ? has("realCrests") : (BADGE_STYLES as readonly string[]).includes(v ?? "");

function stored(): CrestStyle {
  try {
    const v = localStorage.getItem(KEY);
    if (allowed(v)) return v;
  } catch {
    // no storage (a private window): the edition's own look
  }
  return fallback();
}

let current = stored();
const listeners = new Set<() => void>();

/** Show clubs this way on this device; null goes back to the edition's own look. */
export function setCrestStyle(style: CrestStyle | null) {
  try {
    if (style) localStorage.setItem(KEY, style);
    else localStorage.removeItem(KEY);
  } catch {
    // kept for this visit only
  }
  current = style ?? fallback();
  listeners.forEach((l) => l());
}

export const crestStyleChosen = () => current !== fallback();

export function useCrestStyle(): CrestStyle {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
  );
}
