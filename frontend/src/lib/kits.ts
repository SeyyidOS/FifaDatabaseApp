/**
 * Each club's home kit: its colours and their pattern. Where crests can't be used (the store edition,
 * src/lib/edition.ts) the app draws the club's shirt instead (components/ui/ClubKit.tsx). Colours and
 * stripes are nobody's to own; a crest is.
 */
import { clubKey } from "./crests";

export type KitPattern =
  | "plain"
  /** vertical stripes */
  | "stripes"
  /** horizontal hoops */
  | "hoops"
  /** left half, right half */
  | "halves"
  /** a body with sleeves of the second colour */
  | "sleeves"
  /** one wide vertical band down the middle */
  | "band"
  /** a diagonal sash from the left shoulder */
  | "sash"
  /** a ring round the chest */
  | "chest"
  /** split corner to corner */
  | "diagonal";

export interface Kit {
  /** the club's short name */
  abbr: string;
  pattern: KitPattern;
  /** the shirt's main colour */
  body: string;
  /** the pattern's colour */
  accent: string;
  /** collar and cuffs */
  trim: string;
  /** the thin edges either side of a band */
  edge?: string;
}

const W = "#ffffff";
const K = "#141414";

/** [abbr, pattern, body, accent, trim?, edge?]; trim defaults to the accent */
type Row = [string, KitPattern, string, string, string?, string?];

const KITS: Record<string, Row> = {
  "ac milan": ["MIL", "stripes", "#d0102b", K],
  ajax: ["AJA", "band", W, "#d2122e", "#d2122e"],
  arsenal: ["ARS", "sleeves", "#db0007", W, W],
  "as monaco": ["ASM", "diagonal", "#e51b22", W, W],
  "as roma": ["ROM", "plain", "#8e1f2f", "#f0bc42"],
  "aston villa": ["AVL", "sleeves", "#670e36", "#95bfe5", "#95bfe5"],
  atalanta: ["ATA", "stripes", "#1e71b8", K, K],
  "athletic bilbao": ["ATH", "stripes", "#ee2523", W, K],
  "atletico madrid": ["ATM", "stripes", "#cb3524", W, "#272e61"],
  barcelona: ["BAR", "stripes", "#a50044", "#004d98", "#edbb00"],
  basaksehir: ["BŞK", "plain", "#f26b21", "#13294b"],
  "bayer leverkusen": ["B04", "plain", "#e32221", K],
  "bayern munich": ["FCB", "plain", "#dc052d", W],
  benfica: ["SLB", "plain", "#e83030", W],
  besiktas: ["BJK", "stripes", K, W, K],
  "borussia dortmund": ["BVB", "plain", "#fde100", K],
  bournemouth: ["BOU", "stripes", "#da291c", K, K],
  brentford: ["BRE", "stripes", "#e30613", W, K],
  "brighton & hove albion": ["BHA", "stripes", "#0057b8", W, "#0057b8"],
  celtic: ["CEL", "hoops", "#018749", W, W],
  chelsea: ["CHE", "plain", "#034694", W],
  "club brugge": ["BRU", "stripes", "#0a4aa0", K, K],
  como: ["COM", "plain", "#1c3f94", W],
  "corum fk": ["ÇOR", "stripes", "#d71920", K, K],
  "crystal palace": ["CRY", "stripes", "#c4122e", "#1b458f", "#1b458f"],
  "eintracht frankfurt": ["SGE", "plain", K, "#e1000f"],
  everton: ["EVE", "plain", "#003399", W],
  fenerbahce: ["FB", "stripes", "#ffed00", "#002d72", "#002d72"],
  feyenoord: ["FEY", "halves", "#e3001b", W, K],
  fiorentina: ["FIO", "plain", "#5b2a86", W],
  galatasaray: ["GS", "halves", "#fdb912", "#a90432", "#a90432"],
  hoffenheim: ["TSG", "plain", "#1961b5", W],
  "inter milan": ["INT", "stripes", "#0068a8", K, K],
  "juventus fc": ["JUV", "stripes", K, W, K],
  "leeds united": ["LEE", "plain", W, "#1d428a", "#1d428a"],
  lille: ["LIL", "plain", "#e01e13", "#1c2e57"],
  liverpool: ["LIV", "plain", "#c8102e", W],
  "manchester city": ["MCI", "plain", "#6cabdd", "#1c2c5b"],
  "manchester united": ["MUN", "plain", "#da291c", K],
  napoli: ["NAP", "plain", "#12a0d7", W],
  "newcastle united": ["NEW", "stripes", K, W, K],
  "nottingham forest": ["NFO", "plain", "#dd0000", W],
  olympiacos: ["OLY", "stripes", "#e2001a", W, "#e2001a"],
  "olympique de marseille": ["OM", "plain", W, "#2faee0"],
  "olympique lyonnais": ["OL", "plain", W, "#14387f"],
  panathinaikos: ["PAO", "plain", "#007a3d", W],
  paok: ["PAOK", "stripes", K, W, K],
  "paris saint-germain": ["PSG", "band", "#004170", "#da291c", "#004170", W],
  porto: ["POR", "stripes", "#003d8f", W, "#003d8f"],
  psv: ["PSV", "stripes", "#ed1c24", W, "#ed1c24"],
  "rayo vallecano": ["RAY", "sash", W, "#e53027", "#e53027"],
  "rb leipzig": ["RBL", "plain", W, "#dd0741"],
  "real betis": ["BET", "stripes", "#0bb363", W, "#0bb363"],
  "real madrid": ["RMA", "plain", W, "#febe10"],
  "real sociedad": ["RSO", "stripes", "#0067b1", W, "#0067b1"],
  rennes: ["REN", "plain", "#e13327", K],
  sevilla: ["SEV", "plain", W, "#d71a28"],
  "sporting cp": ["SCP", "hoops", "#008057", W, "#008057"],
  "ss lazio": ["LAZ", "plain", "#87d8f7", W],
  strasbourg: ["RCS", "plain", "#0069b4", W],
  "tottenham hotspur": ["TOT", "plain", W, "#132257"],
  trabzonspor: ["TS", "stripes", "#8b1538", "#00a3e0", "#8b1538"],
  valencia: ["VAL", "plain", W, K],
  "vfb stuttgart": ["VFB", "chest", W, "#e32219", "#e32219"],
  "villarreal cf": ["VIL", "plain", "#ffe667", "#005187"],
  "west ham united": ["WHU", "sleeves", "#7a263a", "#1bb1e7", "#1bb1e7"],
  "wolverhampton wanderers": ["WOL", "plain", "#fdb913", K],
};

/** Kit colours for clubs the table doesn't know, so an invented one still looks like a real kit. */
const PALETTE = ["#d0102b", "#0a4aa0", "#0b2f6b", "#5fb4e8", "#0a8a4a", "#f7d000", K, W, "#7a1f3a", "#f07a00", "#5b2a86"];
const PATTERNS: KitPattern[] = ["plain", "plain", "stripes", "hoops", "sleeves", "halves", "band"];

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const STOP = new Set(["fc", "cf", "ac", "as", "ss", "sc", "sk", "fk", "de", "the", "club"]);

function abbreviate(name: string): string {
  const words = name.split(/[\s-]+/).filter(Boolean);
  const core = words.filter((w) => !STOP.has(w.toLowerCase()));
  const use = core.length ? core : words;
  if (use.length === 1) return use[0].slice(0, 3).toLocaleUpperCase("tr");
  return use
    .slice(0, 3)
    .map((w) => w[0])
    .join("")
    .toLocaleUpperCase("tr");
}

/** Relative luminance, 0 (black) to 1 (white), of a #rrggbb colour. */
export function luminance(hex: string): number {
  const v = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(v.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function kitFor(name: string): Kit {
  const key = clubKey(name, KITS);
  if (key) {
    const [abbr, pattern, body, accent, trim, edge] = KITS[key];
    return { abbr, pattern, body, accent, trim: trim ?? accent, edge };
  }
  const h = hash(name.trim().toLowerCase());
  const body = PALETTE[h % PALETTE.length];
  // a second colour that stands apart from the first
  const others = PALETTE.filter((c) => Math.abs(luminance(c) - luminance(body)) > 0.25);
  const accent = others[(h >>> 8) % others.length];
  return { abbr: abbreviate(name), pattern: PATTERNS[(h >>> 16) % PATTERNS.length], body, accent, trim: accent };
}
