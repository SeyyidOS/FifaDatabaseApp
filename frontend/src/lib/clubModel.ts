/**
 * Club ratings from a game's cards (port of the fc27-elo study by our friend's developer).
 *
 * Every club fields its best 4-3-3 (plus a few substitutes) from its normal cards: an assignment
 * problem solved with the Hungarian algorithm. Players are scored by overall (optionally blended
 * with stats), positions are weighted, and the weighted squad score is mapped onto the previous
 * season's Elo scale with a least-squares fit, so a new game's ratings stay comparable to the old.
 *
 * Keep the arithmetic exactly as it is: clubModel.test.ts checks it against the original page.
 */

export const STATS = ["PAC", "SHO", "PAS", "DRI", "DEF", "PHY"] as const;
export type Stat = (typeof STATS)[number];

export type SlotKey = "GK" | "CB" | "FB" | "MID" | "ST" | "W";
export const SLOTS: { key: SlotKey; pos: string[] }[] = [
  { key: "GK", pos: ["GK"] },
  { key: "CB", pos: ["CB"] },
  { key: "FB", pos: ["LB", "RB", "LWB", "RWB"] },
  { key: "MID", pos: ["CDM", "CM", "CAM"] },
  { key: "ST", pos: ["ST", "CF"] },
  { key: "W", pos: ["LW", "RW", "LM", "RM"] },
];
const SLOT_OF: Record<string, SlotKey> = {};
SLOTS.forEach((s) => s.pos.forEach((p) => (SLOT_OF[p] = s.key)));

export interface Spot {
  id: string;
  g: SlotKey;
  /** 0 = attack (top of the pitch) … 3 = goalkeeper */
  row: number;
  side?: "L" | "R";
  label?: string;
}
/** 4-3-3, attack first. */
export const XI_SPOTS: Spot[] = [
  { id: "LW", g: "W", side: "L", row: 0 },
  { id: "ST", g: "ST", row: 0 },
  { id: "RW", g: "W", side: "R", row: 0 },
  { id: "LCM", g: "MID", row: 1, label: "CM" },
  { id: "CM", g: "MID", row: 1 },
  { id: "RCM", g: "MID", row: 1, label: "CM" },
  { id: "LB", g: "FB", side: "L", row: 2 },
  { id: "LCB", g: "CB", row: 2, label: "CB" },
  { id: "RCB", g: "CB", row: 2, label: "CB" },
  { id: "RB", g: "FB", side: "R", row: 2 },
  { id: "GK", g: "GK", row: 3 },
];
const SIDE_POS = { L: ["LB", "LWB", "LW", "LM"], R: ["RB", "RWB", "RW", "RM"] };

export interface Card {
  id: number;
  /** short name as printed on the card */
  name: string;
  fullName: string;
  ovr: number;
  pos: string;
  alt: string[];
  /** PAC SHO PAS DRI DEF PHY; null for goalkeepers */
  stats: (number | null)[] | null;
  age?: number;
  quality?: "gold" | "silver" | "bronze";
  rare?: boolean;
}

export interface CardClub {
  eaId: number;
  /** our name for the club (matches, crests) */
  name: string;
  /** what the game calls it (unlicensed names like "Lombardia FC") */
  gameName: string;
  league: string;
  cards: Card[];
}

export interface CardSet {
  game: string;
  source: string;
  fetchedAt: string;
  clubs: CardClub[];
}

export type AltMode = "free" | "gaps" | "off";

export interface ClubModel {
  v: 2;
  /** substitutes per slot group */
  bench: Record<SlotKey, number>;
  posW: Record<SlotKey, number>;
  /** share of the player score taken from each stat instead of the overall (sum ≤ 1) */
  statW: Record<Stat, number>;
  /** may players fill a slot of one of their alternative positions? */
  altMode: AltMode;
  missingPenalty: number;
  altPenalty: number;
  benchW: number;
  /** "fit": least squares onto the reference season; "fixed": base + k × (score − anchor) */
  scale: { mode: "fit" | "fixed"; base: number; k: number; anchor: number };
}

/** The settings the study settled on ("save for everyone" in the original page). */
export const DEFAULT_MODEL: ClubModel = {
  v: 2,
  bench: { GK: 0, CB: 0, FB: 0, MID: 1, ST: 1, W: 1 },
  posW: { GK: 0.5, CB: 1, FB: 1, MID: 1.5, ST: 1.2, W: 2 },
  statW: { PAC: 0.25, SHO: 0, PAS: 0, DRI: 0, DEF: 0, PHY: 0 },
  altMode: "free",
  missingPenalty: 50,
  altPenalty: 0,
  benchW: 0.5,
  scale: { mode: "fit", base: 1500, k: 50, anchor: 80 },
};

const clone = <T>(o: T): T => JSON.parse(JSON.stringify(o));
const finite = (v: unknown) => (typeof v === "number" || typeof v === "string") && Number.isFinite(Number(v));

/** Fill in and bound a stored or edited model; anything invalid falls back to the default. */
export function sanitizeModel(m: unknown, hasReference = true): ClubModel {
  const out = clone(DEFAULT_MODEL);
  const src = (m && typeof m === "object" ? m : {}) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  for (const s of SLOTS) {
    const c = Number(src.bench?.[s.key]);
    if (finite(src.bench?.[s.key]) && c >= 0 && c <= 5) out.bench[s.key] = Math.round(c);
    const w = Number(src.posW?.[s.key]);
    if (finite(src.posW?.[s.key]) && w >= 0 && w <= 10) out.posW[s.key] = w;
  }
  for (const k of STATS) {
    const w = Number(src.statW?.[k]);
    if (finite(src.statW?.[k]) && w >= 0 && w <= 1) out.statW[k] = w;
  }
  const sum = STATS.reduce((s, k) => s + out.statW[k], 0);
  if (sum > 1) STATS.forEach((k) => (out.statW[k] = +(out.statW[k] / sum).toFixed(3)));
  if (["free", "gaps", "off"].includes(src.altMode)) out.altMode = src.altMode;
  for (const k of ["missingPenalty", "altPenalty"] as const) {
    const v = Number(src[k]);
    if (finite(src[k]) && v >= 0 && v <= 2000) out[k] = v;
  }
  if (finite(src.benchW) && Number(src.benchW) >= 0 && Number(src.benchW) <= 5) out.benchW = Number(src.benchW);
  if (src.scale && typeof src.scale === "object") {
    if (["fit", "fixed"].includes(src.scale.mode)) out.scale.mode = src.scale.mode;
    for (const k of ["base", "k", "anchor"] as const) if (finite(src.scale[k])) out.scale[k] = Number(src.scale[k]);
  }
  if (!hasReference) out.scale.mode = "fixed";
  return out;
}

/* ------------------------------ squad selection ----------------------------- */

/** Minimum-cost assignment for a square cost matrix; returns the column of each row. */
export function hungarian(cost: number[][]): number[] {
  const n = cost.length;
  const INF = 1e15;
  const u = new Float64Array(n + 1);
  const v = new Float64Array(n + 1);
  const p = new Int32Array(n + 1);
  const way = new Int32Array(n + 1);
  for (let i = 1; i <= n; i++) {
    p[0] = i;
    let j0 = 0;
    const minv = new Float64Array(n + 1).fill(INF);
    const used = new Uint8Array(n + 1);
    do {
      used[j0] = 1;
      const i0 = p[j0];
      let delta = INF;
      let j1 = 0;
      for (let j = 1; j <= n; j++)
        if (!used[j]) {
          const cur = cost[i0 - 1][j - 1] - u[i0] - v[j];
          if (cur < minv[j]) {
            minv[j] = cur;
            way[j] = j0;
          }
          if (minv[j] < delta) {
            delta = minv[j];
            j1 = j;
          }
        }
      for (let j = 0; j <= n; j++) {
        if (used[j]) {
          u[p[j]] += delta;
          v[j] -= delta;
        } else minv[j] -= delta;
      }
      j0 = j1;
    } while (p[j0] !== 0);
    do {
      const j1 = way[j0];
      p[j0] = p[j1];
      j0 = j1;
    } while (j0);
  }
  const colOfRow = new Array<number>(n).fill(-1);
  for (let j = 1; j <= n; j++) if (p[j]) colOfRow[p[j] - 1] = j - 1;
  return colOfRow;
}

export function playerScore(p: Card, slot: SlotKey, alt: boolean, m: ClubModel): number {
  if (slot === "GK" || p.pos === "GK") return p.ovr; // goalkeepers: overall only
  const sumW = STATS.reduce((s, k) => s + m.statW[k], 0);
  let v = (1 - sumW) * p.ovr;
  STATS.forEach((k, i) => {
    if (m.statW[k]) v += m.statW[k] * (p.stats?.[i] ?? p.ovr);
  });
  return v - (alt ? m.altPenalty : 0);
}

const sideFit = (p: Card, side: "L" | "R") =>
  SIDE_POS[side].includes(p.pos) ? 2 : p.alt.some((a) => SIDE_POS[side].includes(a)) ? 1 : 0;
const canPlay = (p: Card, g: SlotKey) =>
  SLOT_OF[p.pos] === g ? "primary" : p.alt.some((a) => SLOT_OF[a] === g) ? "alt" : null;

interface Pick {
  g: SlotKey;
  p: Card | null;
  alt: boolean;
}

/** Fill as many slots as possible, then with the highest overalls; ties favour natural positions. */
function assign(players: Card[], groups: SlotKey[], m: ClubModel) {
  const picks: Pick[] = groups.map((g) => ({ g, p: null, alt: false }));
  const used = new Set<Card>();
  if (!groups.length || !players.length) return { picks, used };
  const fit = (p: Card, g: SlotKey) => {
    const k = canPlay(p, g);
    if (!k || (k === "alt" && m.altMode === "off")) return null;
    const alt = k === "alt";
    return { alt, w: 10000 + p.ovr + (alt ? (m.altMode === "gaps" ? -200 : 0) : 0.05) + playerScore(p, g, alt, m) * 1e-3 };
  };
  const n = Math.max(players.length, groups.length);
  const cost = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => {
      if (i >= players.length || j >= groups.length) return 0;
      const f = fit(players[i], groups[j]);
      return f ? -f.w : 0;
    }),
  );
  hungarian(cost).forEach((j, i) => {
    if (i < players.length && j >= 0 && j < groups.length) {
      const f = fit(players[i], groups[j]);
      if (f) {
        picks[j] = { g: groups[j], p: players[i], alt: f.alt };
        used.add(players[i]);
      }
    }
  });
  return { picks, used };
}

export interface XiPlace {
  spot: Spot;
  p: Card | null;
  alt?: boolean;
  score?: number;
}

/** Lay the eleven out: the CDM in the middle, full-backs and wingers on their own side. */
function placeXI(picks: Pick[], m: ClubModel): XiPlace[] {
  const by: Partial<Record<SlotKey, Pick[]>> = {};
  picks.filter((x) => x.p).forEach((x) => (by[x.g] ||= []).push(x));
  Object.values(by).forEach((l) => l!.sort((a, b) => b.p!.ovr - a.p!.ovr));
  const place: Record<string, Pick> = {};
  const put = (id: string, e?: Pick) => {
    if (e) place[id] = e;
  };
  put("GK", by.GK?.[0]);
  put("ST", by.ST?.[0]);
  put("LCB", by.CB?.[0]);
  put("RCB", by.CB?.[1]);
  const mids = (by.MID || []).slice();
  if (mids.length) {
    let c = mids.findIndex((e) => e.p!.pos === "CDM");
    if (c < 0) c = mids.findIndex((e) => e.p!.alt.includes("CDM"));
    put("CM", mids.splice(c >= 0 ? c : 0, 1)[0]);
    put("LCM", mids[0]);
    put("RCM", mids[1]);
  }
  const pair = (list: Pick[] = [], l: string, r: string) => {
    if (list.length === 1) {
      if (sideFit(list[0].p!, "R") > sideFit(list[0].p!, "L")) put(r, list[0]);
      else put(l, list[0]);
      return;
    }
    if (list.length < 2) return;
    const [x, y] = list;
    const keep = sideFit(x.p!, "L") + sideFit(y.p!, "R") >= sideFit(y.p!, "L") + sideFit(x.p!, "R");
    put(l, keep ? x : y);
    put(r, keep ? y : x);
  };
  pair(by.FB, "LB", "RB");
  pair(by.W, "LW", "RW");
  return XI_SPOTS.map((sp) => {
    const e = place[sp.id];
    return e ? { spot: sp, p: e.p, alt: e.alt, score: playerScore(e.p!, sp.g, e.alt, m) } : { spot: sp, p: null };
  });
}

const mean = (a: number[]) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);

export interface BenchPlace {
  slot: SlotKey;
  p: Card | null;
  alt: boolean;
  score: number | null;
}

export interface ClubEvaluation {
  club: CardClub;
  xi: XiPlace[];
  bench: BenchPlace[];
  /** cards outside the matchday squad */
  outside: Card[];
  score: number | null;
  xiScore: number | null;
  benchScore: number | null;
  /** average overall of the eleven */
  ovr: number | null;
  slotAvg: Record<SlotKey, number | null>;
  /** outfield averages of the eleven */
  stats: Record<Stat, number | null>;
  age: number | null;
  missing: number;
  missingBy: Partial<Record<SlotKey, number>>;
  /** players used in one of their alternative positions */
  altUsed: { p: Card; slot: SlotKey }[];
}

export function evaluateClub(club: CardClub, m: ClubModel): ClubEvaluation {
  const P = club.cards;
  const xiA = assign(P, XI_SPOTS.map((sp) => sp.g), m);
  const rest = P.filter((p) => !xiA.used.has(p));
  const benchGroups: SlotKey[] = [];
  SLOTS.forEach((sl) => {
    for (let i = 0; i < m.bench[sl.key]; i++) benchGroups.push(sl.key);
  });
  const bA = assign(rest, benchGroups, m);
  const xi = placeXI(xiA.picks, m);
  const order = Object.fromEntries(SLOTS.map((sl, i) => [sl.key, i])) as Record<SlotKey, number>;
  const bench: BenchPlace[] = bA.picks
    .map((x) => ({ slot: x.g, p: x.p, alt: x.alt, score: x.p ? playerScore(x.p, x.g, x.alt, m) : null }))
    .sort((x, y) => order[x.slot] - order[y.slot] || (y.p ? y.p.ovr : -1) - (x.p ? x.p.ovr : -1));
  const outside = rest.filter((p) => !bA.used.has(p));
  const xiP = xi.filter((e) => e.p);
  const benchP = bench.filter((x) => x.p);
  const xiSum = xiP.reduce((t, e) => t + m.posW[e.spot.g] * e.score!, 0);
  const xiW = xiP.reduce((t, e) => t + m.posW[e.spot.g], 0);
  const bSum = benchP.reduce((t, x) => t + m.posW[x.slot] * x.score!, 0);
  const bW = benchP.reduce((t, x) => t + m.posW[x.slot], 0);
  const totW = xiW + m.benchW * bW;
  const outfield = xiP.filter((e) => e.p!.pos !== "GK").map((e) => e.p!);
  const missingBy: Partial<Record<SlotKey, number>> = {};
  [...xi.filter((e) => !e.p).map((e) => e.spot.g), ...bench.filter((x) => !x.p).map((x) => x.slot)].forEach(
    (g) => (missingBy[g] = (missingBy[g] || 0) + 1),
  );
  const altUsed = [
    ...xiP.filter((e) => e.alt).map((e) => ({ p: e.p!, slot: e.spot.g })),
    ...benchP.filter((x) => x.alt).map((x) => ({ p: x.p!, slot: x.slot })),
  ];
  return {
    club,
    xi,
    bench,
    outside,
    score: totW ? (xiSum + m.benchW * bSum) / totW : null,
    xiScore: xiW ? xiSum / xiW : null,
    benchScore: bW ? bSum / bW : null,
    ovr: mean(xiP.map((e) => e.p!.ovr)),
    slotAvg: Object.fromEntries(
      SLOTS.map((sl) => [sl.key, mean(xiP.filter((e) => e.spot.g === sl.key).map((e) => e.p!.ovr))]),
    ) as Record<SlotKey, number | null>,
    stats: Object.fromEntries(
      STATS.map((k, i) => [k, mean(outfield.map((p) => p.stats?.[i] ?? null).filter((v): v is number => v != null))]),
    ) as Record<Stat, number | null>,
    age: mean(xiP.map((e) => e.p!.age ?? 0).filter(Boolean)),
    missing: Object.values(missingBy).reduce((t, c) => t + c, 0),
    missingBy,
    altUsed,
  };
}

/* --------------------------------- ratings --------------------------------- */

export interface RatedClub extends ClubEvaluation {
  /** unrounded model Elo */
  elo: number;
  rank: number;
  /** the club's rating in the reference season (the previous game), if it was there */
  reference: number | null;
  referenceRank: number | null;
}

export interface ModelResult {
  model: ClubModel;
  rows: RatedClub[];
  /** Elo = a + b × score − missingPenalty × missing slots */
  a: number;
  b: number;
  /** how well the fit explains the reference ratings */
  fit: { r2: number } | null;
  /** rank agreement with the reference season */
  agree: { rho: number; mad: number } | null;
}

function spearman(xs: number[], ys: number[]): number | null {
  const rk = (a: number[]) => {
    const idx = a.map((v, i) => [v, i]).sort((p, q) => q[0] - p[0]);
    const r = new Array<number>(a.length);
    for (let i = 0; i < idx.length; ) {
      let j = i;
      while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
      for (let k = i; k <= j; k++) r[idx[k][1]] = (i + j) / 2 + 1;
      i = j + 1;
    }
    return r;
  };
  const a = rk(xs);
  const b = rk(ys);
  const ma = mean(a)!;
  const mb = mean(b)!;
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < a.length; i++) {
    num += (a[i] - ma) * (b[i] - mb);
    da += (a[i] - ma) ** 2;
    db += (b[i] - mb) ** 2;
  }
  return da && db ? num / Math.sqrt(da * db) : null;
}

/**
 * Rate every club. `reference` gives a club's rating in the previous season (matched by EA id,
 * then by name); with mode "fit" the scores are mapped onto that scale.
 */
export function rateClubs(
  cards: CardSet,
  model: ClubModel,
  reference: (club: CardClub) => number | null,
): ModelResult {
  const m = model;
  const rows = cards.clubs
    .map((c) => evaluateClub(c, m))
    .filter((r) => r.score != null)
    .map((r) => ({ ...r, elo: 0, rank: 0, reference: reference(r.club), referenceRank: null as number | null }));
  const refRank = new Map(
    rows
      .filter((r) => r.reference != null)
      .sort((a, b) => b.reference! - a.reference!)
      .map((r, i) => [r.club.eaId, i + 1]),
  );
  let a: number;
  let b: number;
  let fit: { r2: number } | null = null;
  const withRef = rows.filter((r) => r.reference != null);
  if (m.scale.mode === "fit" && withRef.length >= 3) {
    const xs = withRef.map((r) => r.score!);
    const ys = withRef.map((r) => r.reference!);
    const mx = mean(xs)!;
    const my = mean(ys)!;
    const sxx = xs.reduce((s, x) => s + (x - mx) ** 2, 0);
    const sxy = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0);
    b = sxx ? sxy / sxx : 0;
    a = my - b * mx;
    const ssr = ys.reduce((s, y, i) => s + (y - (a + b * xs[i])) ** 2, 0);
    const sst = ys.reduce((s, y) => s + (y - my) ** 2, 0);
    fit = { r2: sst ? 1 - ssr / sst : 0 };
    if (!(b > 0)) {
      a = m.scale.base - m.scale.k * m.scale.anchor;
      b = m.scale.k;
      fit = null;
    }
  } else {
    b = m.scale.k;
    a = m.scale.base - m.scale.k * m.scale.anchor;
  }
  rows.forEach((r) => (r.elo = a + b * r.score! - m.missingPenalty * r.missing));
  rows.sort((x, y) => y.elo - x.elo);
  rows.forEach((r, i) => {
    r.rank = i + 1;
    r.referenceRank = refRank.get(r.club.eaId) ?? null;
  });
  const ro = rows.filter((r) => r.reference != null);
  const rho = ro.length >= 3 ? spearman(ro.map((r) => r.elo), ro.map((r) => r.reference!)) : null;
  const agree = rho != null ? { rho, mad: mean(ro.map((r) => Math.abs(r.rank - r.referenceRank!)))! } : null;
  return { model: m, rows, a, b, fit, agree };
}
