/**
 * The app's two editions: "classic", the app as the original group knows it, and "store", which leaves
 * out what isn't ours to publish (for the App Store app and a public site).
 *
 * The store app is built as store (VITE_EDITION=store) and stays so. The web runs what its server says:
 * /edition.js (nginx, from EDITION in secrets.env) sets it before the app starts, so nothing from the other
 * edition ever flashes up. Anything but "store" is classic. The backend gates the same things (edition.py).
 *
 * Code asks has("realCrests"), never which edition it is: one switch per thing, so a single one can be
 * moved later without touching the rest.
 */

export type Edition = "classic" | "store";

export const FEATURES = {
  /** the clubs' real crests (public/crests); otherwise a badge drawn from the club's kit (ClubBadge) */
  realCrests: { classic: true, store: false },
  /** club ratings from the game's cards, and where they came from; otherwise stars an admin gives */
  cardRatings: { classic: true, store: false },
  /** the cards' squads and players' faces (Clubs, compare the squads) */
  squads: { classic: true, store: false },
  /** rating a season with the card model (admins, Settings) */
  cardImport: { classic: true, store: false },
  /** the game's names for seasons, e.g. "FC27" */
  gameNames: { classic: true, store: false },
  /** "not affiliated with EA" */
  independenceNote: { classic: false, store: true },
} as const satisfies Record<string, Record<Edition, boolean>>;

export type Feature = keyof typeof FEATURES;

declare global {
  interface Window {
    MATCHNIGHT_EDITION?: string;
  }
}

/** Which edition from the build's setting, the server's (and a device's preview): store if any says so. */
export function editionOf(...settings: (string | null | undefined)[]): Edition {
  return settings.some((v) => v?.trim().toLowerCase() === "store") ? "store" : "classic";
}

// A device can try the store edition on a classic site (Settings, for a league's owner). Only that device
// changes, and only towards store, like the server's setting.
const PREVIEW = "matchnight.preview";

function previewed(): string | null {
  try {
    return localStorage.getItem(PREVIEW);
  } catch {
    return null;
  }
}

const browser = typeof window !== "undefined";
/** What the site runs, whatever this device previews. */
export const SITE_EDITION: Edition = editionOf(import.meta.env.VITE_EDITION, browser ? window.MATCHNIGHT_EDITION : undefined);
export const EDITION: Edition = editionOf(SITE_EDITION, browser ? previewed() : null);
/** This device is trying the store edition on a classic site. */
export const PREVIEWING = EDITION !== SITE_EDITION;

/** Starts or ends this device's preview of the store edition; the app starts again in it. */
export function setStorePreview(on: boolean) {
  try {
    if (on) localStorage.setItem(PREVIEW, "store");
    else localStorage.removeItem(PREVIEW);
  } catch {
    return;
  }
  window.location.reload();
}

export const featureOn = (feature: Feature, edition: Edition) => FEATURES[feature][edition];

/** Whether this app shows a feature. */
export const has = (feature: Feature) => featureOn(feature, EDITION);
