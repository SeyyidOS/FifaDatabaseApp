import { DEFAULT_CLUB_ELO, INITIAL_ELO } from "./elo";
import { cleanName } from "./format";
import type { ParsedMatch } from "./stats";
import type { Club } from "./types";

export type TeamMode = "1v1" | "2v2" | "1v2";

export const TEAM_SIZES: Record<TeamMode, [number, number]> = {
  "1v1": [1, 1],
  "2v2": [2, 2],
  "1v2": [1, 2],
};

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Each player's teammates from their most recent match. */
export function lastTeammates(parsed: ParsedMatch[]): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  for (const m of parsed) {
    for (const team of [m.teamA, m.teamB]) {
      for (const p of team) {
        if (!out.has(p)) out.set(p, new Set(team.filter((x) => x !== p)));
      }
    }
  }
  return out;
}

export function teamAverage(names: string[], eloByName: Map<string, number>): number {
  const vals = names
    .map((n) => eloByName.get(cleanName(n)))
    .filter((v): v is number => typeof v === "number");
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : INITIAL_ELO;
}

export type TeamsResult =
  | { ok: true; teamA: string[]; teamB: string[]; diff: number }
  | { ok: false; reason: string };

/**
 * Random teams that never reunite last match's partners. With `balance`, try many
 * splits and keep the one with the closest average Elo.
 */
export function generateTeams(opts: {
  pool: string[];
  mode: TeamMode;
  balance: boolean;
  eloByName: Map<string, number>;
  recentPartners: Map<string, Set<string>>;
  tries?: number;
}): TeamsResult {
  const [sizeA, sizeB] = TEAM_SIZES[opts.mode];
  const needed = sizeA + sizeB;
  if (opts.pool.length < needed) {
    return { ok: false, reason: `Pick at least ${needed} players for ${opts.mode}.` };
  }
  const valid = (names: string[]) => {
    for (let i = 0; i < names.length; i++) {
      for (let j = i + 1; j < names.length; j++) {
        const a = cleanName(names[i]);
        const b = cleanName(names[j]);
        if (opts.recentPartners.get(a)?.has(b) || opts.recentPartners.get(b)?.has(a)) return false;
      }
    }
    return true;
  };

  let best: { teamA: string[]; teamB: string[]; diff: number } | null = null;
  const tries = opts.tries ?? 1200;
  for (let t = 0; t < tries; t++) {
    const pick = shuffle(opts.pool).slice(0, needed);
    const teamA = pick.slice(0, sizeA);
    const teamB = pick.slice(sizeA, needed);
    if (!valid(teamA) || !valid(teamB)) continue;
    const diff = Math.abs(teamAverage(teamA, opts.eloByName) - teamAverage(teamB, opts.eloByName));
    if (!opts.balance) return { ok: true, teamA, teamB, diff };
    if (!best || diff < best.diff) {
      best = { teamA, teamB, diff };
      if (diff === 0) break;
    }
  }
  if (best) return { ok: true, ...best };
  return {
    ok: false,
    reason: "Every split reunites last match's partners. Add more players or change the mode.",
  };
}

export interface ClubPick {
  a: Club;
  b: Club;
  diff: number;
  withinMargin: boolean;
  candidates: number;
}

/**
 * Pick a club pairing so that (team avg + club Elo / 2) is as even as possible.
 * Picks randomly among pairs within `margin`, else the closest pair.
 */
export function pickBalancedClubs(
  clubs: Club[],
  avgA: number,
  avgB: number,
  margin: number,
  exclude?: { a?: number; b?: number },
): ClubPick | null {
  if (clubs.length < 2) return null;
  const elo = (c: Club) => (typeof c.elo === "number" ? c.elo : DEFAULT_CLUB_ELO);
  let best: ClubPick | null = null;
  const within: ClubPick[] = [];
  for (let i = 0; i < clubs.length; i++) {
    for (let j = i + 1; j < clubs.length; j++) {
      const c1 = clubs[i];
      const c2 = clubs[j];
      const d1 = Math.abs(avgA + elo(c1) / 2 - (avgB + elo(c2) / 2));
      const d2 = Math.abs(avgA + elo(c2) / 2 - (avgB + elo(c1) / 2));
      const swap = d2 < d1;
      const cand: ClubPick = {
        a: swap ? c2 : c1,
        b: swap ? c1 : c2,
        diff: swap ? d2 : d1,
        withinMargin: false,
        candidates: 0,
      };
      if (exclude && cand.a.id === exclude.a && cand.b.id === exclude.b) continue;
      if (cand.diff <= margin) within.push({ ...cand, withinMargin: true });
      if (!best || cand.diff < best.diff) best = cand;
    }
  }
  const pick = within.length ? within[Math.floor(Math.random() * within.length)] : best;
  return pick ? { ...pick, candidates: within.length } : null;
}
