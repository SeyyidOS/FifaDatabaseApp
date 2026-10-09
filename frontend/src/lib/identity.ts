/** Deterministic visual identity for players and clubs. */

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function playerGradient(name: string): [string, string] {
  const h = hash(name.toLowerCase());
  const hue = h % 360;
  const hue2 = (hue + 35 + (h >> 9) % 50) % 360;
  return [`oklch(0.72 0.16 ${hue})`, `oklch(0.52 0.18 ${hue2})`];
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.trim().charAt(0).toUpperCase();
}

/** [abbreviation, primary, secondary] */
const CLUBS: Record<string, [string, string, string]> = {
  arsenal: ["ARS", "#db0007", "#ffffff"],
  barcelona: ["BAR", "#a50044", "#004d98"],
  "bayern munich": ["FCB", "#dc052d", "#0066b2"],
  bournemouth: ["BOU", "#da291c", "#111111"],
  brentford: ["BRE", "#e30613", "#ffffff"],
  celtic: ["CEL", "#018749", "#ffffff"],
  como: ["COM", "#1c3f94", "#ffffff"],
  hoffenheim: ["TSG", "#1961b5", "#ffffff"],
  "inter milan": ["INT", "#0068a8", "#111111"],
  inter: ["INT", "#0068a8", "#111111"],
  "leeds united": ["LEE", "#1d428a", "#ffcd00"],
  liverpool: ["LIV", "#c8102e", "#00b2a9"],
  "manchester city": ["MCI", "#6cabdd", "#1c2c5b"],
  olympiacos: ["OLY", "#e2001a", "#ffffff"],
  "paris saint-germain": ["PSG", "#004170", "#da291c"],
  porto: ["POR", "#003d8f", "#ffffff"],
  "rayo vallecano": ["RAY", "#e53027", "#ffffff"],
  valencia: ["VAL", "#f18a00", "#111111"],
  "aston villa": ["AVL", "#670e36", "#95bfe5"],
  "atletico madrid": ["ATM", "#cb3524", "#272e61"],
  "bayer leverkusen": ["B04", "#e32221", "#111111"],
  chelsea: ["CHE", "#034694", "#ffffff"],
  "manchester united": ["MUN", "#da291c", "#fbe122"],
  "newcastle united": ["NEW", "#241f20", "#ffffff"],
  "tottenham hotspur": ["TOT", "#132257", "#ffffff"],
  "ac milan": ["MIL", "#e30a17", "#111111"],
  atalanta: ["ATA", "#1e71b8", "#111111"],
  "athletic bilbao": ["ATH", "#ee2523", "#ffffff"],
  benfica: ["SLB", "#e83030", "#ffffff"],
  "borussia dortmund": ["BVB", "#fde100", "#111111"],
  napoli: ["NAP", "#12a0d7", "#ffffff"],
  "nottingham forest": ["NFO", "#dd0000", "#ffffff"],
  psv: ["PSV", "#ed1c24", "#ffffff"],
  "rb leipzig": ["RBL", "#dd0741", "#001f47"],
  "sporting cp": ["SCP", "#008057", "#ffffff"],
  "as roma": ["ROM", "#8e1f2f", "#f0bc42"],
  "crystal palace": ["CRY", "#1b458f", "#c4122e"],
  "eintracht frankfurt": ["SGE", "#e1000f", "#111111"],
  "juventus fc": ["JUV", "#111111", "#ffffff"],
  juventus: ["JUV", "#111111", "#ffffff"],
  "olympique lyonnais": ["OL", "#14387f", "#da0812"],
  "real betis": ["BET", "#0bb363", "#ffffff"],
  "real sociedad": ["RSO", "#0067b1", "#ffffff"],
  "ss lazio": ["LAZ", "#87d8f7", "#15366f"],
  "villarreal cf": ["VIL", "#ffe667", "#005187"],
  "west ham united": ["WHU", "#7a263a", "#1bb1e7"],
  "olympique de marseille": ["OM", "#2faee0", "#ffffff"],
  "real madrid": ["RMA", "#febe10", "#00529f"],
};

const STOP = new Set(["fc", "cf", "ac", "as", "ss", "sc", "de", "the", "club"]);

function abbreviate(name: string): string {
  const words = name.split(/[\s-]+/).filter(Boolean);
  const core = words.filter((w) => !STOP.has(w.toLowerCase()));
  const use = core.length ? core : words;
  if (use.length === 1) return use[0].slice(0, 3).toUpperCase();
  return use
    .slice(0, 3)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

function luminance(hex: string): number {
  const v = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(v.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export interface ClubIdentity {
  abbr: string;
  primary: string;
  secondary: string;
  ink: string;
}

export function clubIdentity(name: string): ClubIdentity {
  const known = CLUBS[name.trim().toLowerCase()];
  if (known) {
    const [abbr, primary, secondary] = known;
    return { abbr, primary, secondary, ink: luminance(primary) > 0.45 ? "#0b0f17" : "#ffffff" };
  }
  const h = hash(name.toLowerCase());
  const hue = h % 360;
  return {
    abbr: abbreviate(name),
    primary: `hsl(${hue} 55% 38%)`,
    secondary: `hsl(${(hue + 40) % 360} 60% 60%)`,
    ink: "#ffffff",
  };
}
