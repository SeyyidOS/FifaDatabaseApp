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
  /** the clubs' real crests (public/crests); otherwise a badge from the club's colours and initials */
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

/** Which edition from the build's setting and the server's: store if either says so. */
export function editionOf(build: string | undefined, server: string | undefined): Edition {
  return [build, server].some((v) => v?.trim().toLowerCase() === "store") ? "store" : "classic";
}

export const EDITION: Edition = editionOf(
  import.meta.env.VITE_EDITION,
  typeof window === "undefined" ? undefined : window.MATCHNIGHT_EDITION,
);

export const featureOn = (feature: Feature, edition: Edition) => FEATURES[feature][edition];

/** Whether this app shows a feature. */
export const has = (feature: Feature) => featureOn(feature, EDITION);
