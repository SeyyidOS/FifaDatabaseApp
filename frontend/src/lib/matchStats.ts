/**
 * Match stats from the game's summary screen ("Özet"): what each number is, and what they add up to
 * for a player. A side's numbers count for every player on that side, like its goals.
 */
import type { ParsedMatch } from "./stats";
import type { Side, SideStats } from "./types";

export type StatKey = keyof SideStats;

export interface StatDef {
  key: StatKey;
  kind: "pct" | "count" | "xg" | "seconds";
  /** which value is the better one for its side; null when neither is */
  better: "high" | "low" | null;
}

/** In the order of the game's summary screen; the three rings (percentages) come last. */
export const STAT_DEFS: StatDef[] = [
  { key: "possession", kind: "pct", better: "high" },
  { key: "recoveryTime", kind: "seconds", better: "low" },
  { key: "shots", kind: "count", better: "high" },
  { key: "xg", kind: "xg", better: "high" },
  { key: "passes", kind: "count", better: "high" },
  { key: "tackles", kind: "count", better: "high" },
  { key: "tacklesWon", kind: "count", better: "high" },
  { key: "interceptions", kind: "count", better: "high" },
  { key: "saves", kind: "count", better: null },
  { key: "fouls", kind: "count", better: "low" },
  { key: "offsides", kind: "count", better: "low" },
  { key: "corners", kind: "count", better: "high" },
  { key: "freeKicks", kind: "count", better: null },
  { key: "penalties", kind: "count", better: "high" },
  { key: "yellowCards", kind: "count", better: "low" },
  { key: "redCards", kind: "count", better: "low" },
  { key: "dribbleSuccess", kind: "pct", better: "high" },
  { key: "shotAccuracy", kind: "pct", better: "high" },
  { key: "passAccuracy", kind: "pct", better: "high" },
];

export const formatStat = (kind: StatDef["kind"], v: number | undefined) =>
  v === undefined ? "–" : kind === "xg" ? v.toFixed(2) : kind === "pct" ? `${v}%` : String(v);

/** The side whose value is better, or null for a tie, a missing value or a neutral stat. */
export function betterSide(def: StatDef, a: number | undefined, b: number | undefined): Side | null {
  if (a === undefined || b === undefined || a === b || !def.better) return null;
  return (a > b) === (def.better === "high") ? "A" : "B";
}

/* --------------------------------- Players --------------------------------- */

interface Sum {
  total: number;
  n: number;
}

/** Everything a player's sides did in the matches that have stats. */
export interface PlayerStatLine {
  name: string;
  /** matches with stats */
  matches: number;
  goalsFor: number;
  goalsAgainst: number;
  own: Partial<Record<StatKey, Sum>>;
  opp: Partial<Record<StatKey, Sum>>;
  /** goals and xG of the matches where xG is known, for and against */
  xgGoalsFor: number;
  xgGoalsAgainst: number;
}

function add(to: Partial<Record<StatKey, Sum>>, stats: SideStats) {
  for (const [key, value] of Object.entries(stats) as [StatKey, number | undefined][]) {
    if (value === undefined || value === null) continue;
    const s = (to[key] ??= { total: 0, n: 0 });
    s.total += value;
    s.n++;
  }
}

export function playerStatLines(parsed: ParsedMatch[]): Map<string, PlayerStatLine> {
  const lines = new Map<string, PlayerStatLine>();
  for (const m of parsed) {
    if (!m.stats) continue;
    for (const side of ["A", "B"] as Side[]) {
      const own = m.stats[side];
      const opp = m.stats[side === "A" ? "B" : "A"];
      const gf = side === "A" ? m.scoreA : m.scoreB;
      const ga = side === "A" ? m.scoreB : m.scoreA;
      for (const name of side === "A" ? m.teamA : m.teamB) {
        const line = lines.get(name) ?? {
          name,
          matches: 0,
          goalsFor: 0,
          goalsAgainst: 0,
          own: {},
          opp: {},
          xgGoalsFor: 0,
          xgGoalsAgainst: 0,
        };
        line.matches++;
        line.goalsFor += gf;
        line.goalsAgainst += ga;
        if (own.xg !== undefined) line.xgGoalsFor += gf;
        if (opp.xg !== undefined) line.xgGoalsAgainst += ga;
        add(line.own, own);
        add(line.opp, opp);
        lines.set(name, line);
      }
    }
  }
  return lines;
}

/* --------------------------------- Metrics --------------------------------- */

export type MetricKey =
  | "possession"
  | "xg"
  | "xga"
  | "finishing"
  | "keeping"
  | "shots"
  | "shotAccuracy"
  | "passAccuracy"
  | "dribbleSuccess"
  | "passes"
  | "tacklesWon"
  | "interceptions"
  | "fouls"
  | "cards";

export interface MetricDef {
  key: MetricKey;
  better: "high" | "low";
  digits: number;
  /** shown with a + for positive values */
  signed?: boolean;
  pct?: boolean;
}

/** What the analyses show, each a per-match figure. */
export const METRICS: MetricDef[] = [
  { key: "xg", better: "high", digits: 2 },
  { key: "xga", better: "low", digits: 2 },
  { key: "finishing", better: "high", digits: 2, signed: true },
  { key: "keeping", better: "high", digits: 2, signed: true },
  { key: "possession", better: "high", digits: 0, pct: true },
  { key: "shots", better: "high", digits: 1 },
  { key: "shotAccuracy", better: "high", digits: 0, pct: true },
  { key: "passAccuracy", better: "high", digits: 0, pct: true },
  { key: "dribbleSuccess", better: "high", digits: 0, pct: true },
  { key: "passes", better: "high", digits: 0 },
  { key: "tacklesWon", better: "high", digits: 1 },
  { key: "interceptions", better: "high", digits: 1 },
  { key: "fouls", better: "low", digits: 1 },
  { key: "cards", better: "low", digits: 2 },
];

const avg = (s: Sum | undefined) => (s && s.n ? s.total / s.n : null);

export function metricValue(line: PlayerStatLine, key: MetricKey): number | null {
  switch (key) {
    case "xg":
      return avg(line.own.xg);
    case "xga":
      return avg(line.opp.xg);
    // goals scored above the chances' worth; above zero is clinical finishing
    case "finishing":
      return line.own.xg?.n ? (line.xgGoalsFor - line.own.xg.total) / line.own.xg.n : null;
    // goals let in below the chances' worth; above zero is good keeping (or luck)
    case "keeping":
      return line.opp.xg?.n ? (line.opp.xg.total - line.xgGoalsAgainst) / line.opp.xg.n : null;
    case "cards": {
      const y = line.own.yellowCards;
      if (!y?.n) return null;
      return (y.total + 2 * (line.own.redCards?.total ?? 0)) / y.n;
    }
    default:
      return avg(line.own[key]);
  }
}

export const formatMetric = (def: MetricDef, v: number | null) =>
  v === null ? "–" : `${def.signed && v > 0 ? "+" : ""}${v.toFixed(def.digits)}${def.pct ? "%" : ""}`;

/** The whole group's average of a metric, each player's matches counted once per player. */
export function groupAverage(lines: PlayerStatLine[], key: MetricKey): number | null {
  const values = lines.map((l) => metricValue(l, key)).filter((v): v is number => v !== null);
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}
