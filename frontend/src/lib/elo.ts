/**
 * Client-side replica of backend/elo_service.py.
 *
 * The server only exposes final ratings; replaying the same algorithm here
 * gives us per-match history (charts, deltas) and lets us preview the Elo
 * swing of a match before it's submitted. Keep this in lockstep with the
 * backend — `runElo(...).ratings` must equal GET /elo.
 */
import { cleanName, parseApiTime, parseTeam } from "./format";
import type { Club, Match, Player } from "./types";

export const INITIAL_ELO = 1000;
/** Frontend fallback for clubs without a rating (matchmaking only). */
export const DEFAULT_CLUB_ELO = 500;

export function expectedScore(a: number, b: number): number {
  return 1 / (1 + 10 ** ((b - a) / 400));
}

/** Convex margin factor × upset bonus (mirrors m_upset_bonus). */
export function marginMultiplier(
  winnerElo: number,
  loserElo: number,
  margin: number,
  mMax = 3.0,
  power = 1.5,
  upsetScale = 0.5,
): number {
  const absMargin = Math.abs(margin);
  const marginFactor = 1 + (mMax - 1) * (absMargin / 15) ** power;
  let upsetBonus = 1;
  if (winnerElo < loserElo) {
    const gap = loserElo - winnerElo;
    upsetBonus = 1 + upsetScale * (gap / 400) * (absMargin / 15);
  }
  return marginFactor * upsetBonus;
}

export interface PlayerDelta {
  id: number;
  name: string;
  before: number;
  after: number;
  delta: number;
}

export interface MatchElo {
  matchId: number;
  teamA: PlayerDelta[];
  teamB: PlayerDelta[];
  /** Win expectancy for side A including the club adjustment. */
  expectedA: number;
  strengthA: number;
  strengthB: number;
  multiplier: number;
}

export interface EloPoint {
  matchId: number;
  time: Date;
  elo: number;
}

export interface EloEngine {
  k: number;
  ratings: Map<number, number>;
  history: Map<number, EloPoint[]>;
  perMatch: Map<number, MatchElo>;
  nameToId: Map<string, number>;
  /** Club ratings carried between matches (backend quirk, see resolveClubs). */
  carry: { a?: number; b?: number };
  clubElo: Map<string, number>;
}

interface StepInput {
  teamAIds: number[];
  teamBIds: number[];
  clubARating: number;
  clubBRating: number;
  scoreA: number;
  scoreB: number;
}

interface StepResult {
  expectedA: number;
  strengthA: number;
  strengthB: number;
  multiplier: number;
  deltaA: number;
  deltaB: number;
}

function teamAvg(ratings: Map<number, number>, ids: number[]): number {
  if (!ids.length) return INITIAL_ELO;
  return ids.reduce((s, id) => s + (ratings.get(id) ?? INITIAL_ELO), 0) / ids.length;
}

function step(ratings: Map<number, number>, k: number, input: StepInput): StepResult {
  const strengthA = teamAvg(ratings, input.teamAIds) + input.clubARating / 2;
  const strengthB = teamAvg(ratings, input.teamBIds) + input.clubBRating / 2;
  const expA = expectedScore(strengthA, strengthB);
  const expB = 1 - expA;

  let sA: number, sB: number, winner: number, loser: number, margin: number;
  if (input.scoreA > input.scoreB) {
    [sA, sB, winner, loser, margin] = [1, 0, strengthA, strengthB, input.scoreA - input.scoreB];
  } else if (input.scoreB > input.scoreA) {
    [sA, sB, winner, loser, margin] = [0, 1, strengthB, strengthA, input.scoreB - input.scoreA];
  } else {
    [sA, sB, winner, loser, margin] = [0.5, 0.5, strengthA, strengthB, 0];
  }
  const multiplier = margin > 0 ? marginMultiplier(winner, loser, margin) : 1;
  return {
    expectedA: expA,
    strengthA,
    strengthB,
    multiplier,
    deltaA: k * (sA - expA) * multiplier,
    deltaB: k * (sB - expB) * multiplier,
  };
}

/**
 * The backend scans clubs in id order with `if name == club_a … elif name == club_b`,
 * and the two rating variables persist across matches. So a club that isn't in the
 * table (custom name), or club_b == club_a, silently reuses the previous match's value.
 * Replicate that so our numbers match the server exactly.
 */
function resolveClubs(
  clubElo: Map<string, number>,
  carry: { a?: number; b?: number },
  clubA: string,
  clubB: string,
) {
  const a = clubElo.get(clubA);
  const b = clubElo.get(clubB);
  const next = { ...carry };
  if (a !== undefined) next.a = a;
  if (b !== undefined && clubB !== clubA) next.b = b;
  return {
    next,
    clubARating: next.a ?? DEFAULT_CLUB_ELO,
    clubBRating: next.b ?? DEFAULT_CLUB_ELO,
  };
}

export function buildClubEloMap(clubs: Club[]): Map<string, number> {
  const m = new Map<string, number>();
  [...clubs]
    .sort((x, y) => x.id - y.id)
    .forEach((c) => {
      if (!m.has(c.name)) m.set(c.name, c.elo ?? DEFAULT_CLUB_ELO);
    });
  return m;
}

export function runElo(players: Player[], clubs: Club[], matches: Match[], k: number): EloEngine {
  const nameToId = new Map<string, number>();
  [...players].sort((a, b) => a.id - b.id).forEach((p) => nameToId.set(cleanName(p.name), p.id));

  const ratings = new Map<number, number>();
  const history = new Map<number, EloPoint[]>();
  players.forEach((p) => {
    ratings.set(p.id, INITIAL_ELO);
    history.set(p.id, []);
  });

  const clubElo = buildClubEloMap(clubs);
  const perMatch = new Map<number, MatchElo>();
  let carry: { a?: number; b?: number } = {};

  const ordered = matches
    .map((m) => ({ m, t: parseApiTime(m.time) }))
    .sort((x, y) => x.t.getTime() - y.t.getTime() || x.m.id - y.m.id);

  for (const { m, t } of ordered) {
    const ids = (team: string) =>
      parseTeam(team)
        .map((n) => nameToId.get(n))
        .filter((id): id is number => id !== undefined);
    const teamAIds = ids(m.team_a);
    const teamBIds = ids(m.team_b);
    if (!teamAIds.length || !teamBIds.length) continue;

    const resolved = resolveClubs(clubElo, carry, m.club_a, m.club_b);
    carry = resolved.next;

    const before = new Map(ratings);
    const r = step(ratings, k, {
      teamAIds,
      teamBIds,
      clubARating: resolved.clubARating,
      clubBRating: resolved.clubBRating,
      scoreA: Number(m.score_a) || 0,
      scoreB: Number(m.score_b) || 0,
    });
    teamAIds.forEach((id) => ratings.set(id, (ratings.get(id) ?? INITIAL_ELO) + r.deltaA));
    teamBIds.forEach((id) => ratings.set(id, (ratings.get(id) ?? INITIAL_ELO) + r.deltaB));

    const idToName = (id: number) =>
      players.find((p) => p.id === id)?.name ?? String(id);
    const deltas = (list: number[]): PlayerDelta[] =>
      [...new Set(list)].map((id) => ({
        id,
        name: idToName(id),
        before: before.get(id) ?? INITIAL_ELO,
        after: ratings.get(id) ?? INITIAL_ELO,
        delta: (ratings.get(id) ?? INITIAL_ELO) - (before.get(id) ?? INITIAL_ELO),
      }));

    perMatch.set(m.id, {
      matchId: m.id,
      teamA: deltas(teamAIds),
      teamB: deltas(teamBIds),
      expectedA: r.expectedA,
      strengthA: r.strengthA,
      strengthB: r.strengthB,
      multiplier: r.multiplier,
    });
    new Set([...teamAIds, ...teamBIds]).forEach((id) =>
      history.get(id)?.push({ matchId: m.id, time: t, elo: ratings.get(id) ?? INITIAL_ELO }),
    );
  }

  return { k, ratings, history, perMatch, nameToId, carry, clubElo };
}

export interface MatchPreview {
  expectedA: number;
  strengthA: number;
  strengthB: number;
  /** Elo change per player of side A / B for the given score (null if no score yet). */
  deltaA: number | null;
  deltaB: number | null;
  multiplier: number;
}

/** What would happen if this match were submitted now? */
export function previewMatch(
  engine: EloEngine,
  opts: {
    teamA: string[];
    teamB: string[];
    clubA?: string;
    clubB?: string;
    scoreA?: number | null;
    scoreB?: number | null;
  },
): MatchPreview {
  const ids = (names: string[]) =>
    names.map((n) => engine.nameToId.get(cleanName(n))).filter((id): id is number => id !== undefined);
  const teamAIds = ids(opts.teamA);
  const teamBIds = ids(opts.teamB);

  // Without clubs chosen yet, compare the squads on equal footing.
  let clubARating = 0;
  let clubBRating = 0;
  if (opts.clubA && opts.clubB) {
    const r = resolveClubs(engine.clubElo, engine.carry, opts.clubA, opts.clubB);
    clubARating = r.clubARating;
    clubBRating = r.clubBRating;
  }
  const hasScore =
    opts.scoreA !== null && opts.scoreA !== undefined && opts.scoreB !== null && opts.scoreB !== undefined;
  const r = step(engine.ratings, engine.k, {
    teamAIds,
    teamBIds,
    clubARating,
    clubBRating,
    scoreA: opts.scoreA ?? 0,
    scoreB: opts.scoreB ?? 0,
  });
  return {
    expectedA: r.expectedA,
    strengthA: r.strengthA,
    strengthB: r.strengthB,
    multiplier: r.multiplier,
    deltaA: hasScore && teamAIds.length && teamBIds.length ? r.deltaA : null,
    deltaB: hasScore && teamAIds.length && teamBIds.length ? r.deltaB : null,
  };
}

/** FIFA-style star rating (0.5–5) from club Elo. */
export function clubStars(elo: number | null | undefined): number {
  const v = elo ?? DEFAULT_CLUB_ELO;
  return Math.min(5, Math.max(0.5, Math.round((v / 1200) * 10) / 2));
}
