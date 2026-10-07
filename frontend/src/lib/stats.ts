import { duoKey, matchdayKey, parseApiTime, parseTeam } from "./format";
import type { Match, Outcome, Side } from "./types";

export interface ParsedMatch {
  id: number;
  date: Date;
  matchday: string;
  clubA: string;
  clubB: string;
  teamA: string[];
  teamB: string[];
  scoreA: number;
  scoreB: number;
  /** Winning side, or "D" for a draw. */
  result: Side | "D";
}

/** Newest first. */
export function parseMatches(matches: Match[]): ParsedMatch[] {
  return matches
    .map((m) => {
      const date = parseApiTime(m.time);
      const scoreA = Number(m.score_a) || 0;
      const scoreB = Number(m.score_b) || 0;
      return {
        id: m.id,
        date,
        matchday: matchdayKey(date),
        clubA: m.club_a,
        clubB: m.club_b,
        teamA: parseTeam(m.team_a),
        teamB: parseTeam(m.team_b),
        scoreA,
        scoreB,
        result: scoreA > scoreB ? "A" : scoreB > scoreA ? "B" : "D",
      } satisfies ParsedMatch;
    })
    .sort((a, b) => b.date.getTime() - a.date.getTime() || b.id - a.id);
}

export function sideOf(m: ParsedMatch, name: string): Side | null {
  if (m.teamA.includes(name)) return "A";
  if (m.teamB.includes(name)) return "B";
  return null;
}

export function outcomeForSide(m: ParsedMatch, side: Side): Outcome {
  if (m.result === "D") return "D";
  return m.result === side ? "W" : "L";
}

export function outcomeFor(m: ParsedMatch, name: string): Outcome | null {
  const side = sideOf(m, name);
  return side ? outcomeForSide(m, side) : null;
}

export interface Tally {
  played: number;
  wins: number;
  draws: number;
  losses: number;
  gf: number;
  ga: number;
}

export const emptyTally = (): Tally => ({ played: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0 });

export function addResult(r: Tally, o: Outcome, gf: number, ga: number) {
  r.played++;
  if (o === "W") r.wins++;
  else if (o === "D") r.draws++;
  else r.losses++;
  r.gf += gf;
  r.ga += ga;
}

export const winRate = (r: Pick<Tally, "played" | "wins">) =>
  r.played ? (r.wins / r.played) * 100 : 0;
export const points = (r: Pick<Tally, "wins" | "draws">) => r.wins * 3 + r.draws;

export interface Streak {
  type: Outcome;
  count: number;
}

export interface PlayerStats extends Tally {
  name: string;
  /** Most recent first. */
  outcomes: Outcome[];
  current: Streak | null;
  longestWin: number;
  longestUnbeaten: number;
  teammates: Map<string, Tally>;
  opponents: Map<string, Tally>;
  clubs: Map<string, Tally>;
  lastPlayed: Date | null;
  cleanSheets: number;
  biggestWin: ParsedMatch | null;
}

function longestRun(outcomes: Outcome[], ok: (o: Outcome) => boolean): number {
  let best = 0;
  let run = 0;
  for (const o of outcomes) {
    run = ok(o) ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return best;
}

export function computePlayerStats(parsed: ParsedMatch[]): Map<string, PlayerStats> {
  const map = new Map<string, PlayerStats>();
  const get = (name: string) => {
    let s = map.get(name);
    if (!s) {
      s = {
        name,
        ...emptyTally(),
        outcomes: [],
        current: null,
        longestWin: 0,
        longestUnbeaten: 0,
        teammates: new Map(),
        opponents: new Map(),
        clubs: new Map(),
        lastPlayed: null,
        cleanSheets: 0,
        biggestWin: null,
      };
      map.set(name, s);
    }
    return s;
  };
  const bump = (m: Map<string, Tally>, key: string, o: Outcome, gf: number, ga: number) => {
    let r = m.get(key);
    if (!r) m.set(key, (r = emptyTally()));
    addResult(r, o, gf, ga);
  };

  for (const m of parsed) {
    for (const side of ["A", "B"] as Side[]) {
      const team = side === "A" ? m.teamA : m.teamB;
      const opp = side === "A" ? m.teamB : m.teamA;
      const gf = side === "A" ? m.scoreA : m.scoreB;
      const ga = side === "A" ? m.scoreB : m.scoreA;
      const club = side === "A" ? m.clubA : m.clubB;
      const o = outcomeForSide(m, side);
      for (const name of team) {
        const s = get(name);
        addResult(s, o, gf, ga);
        s.outcomes.push(o);
        if (!s.lastPlayed) s.lastPlayed = m.date;
        if (ga === 0) s.cleanSheets++;
        if (o === "W") {
          const margin = gf - ga;
          const best = s.biggestWin;
          const bestMargin = best ? Math.abs(best.scoreA - best.scoreB) : -1;
          if (margin > bestMargin) s.biggestWin = m;
        }
        team.filter((t) => t !== name).forEach((t) => bump(s.teammates, t, o, gf, ga));
        opp.forEach((t) => bump(s.opponents, t, o, gf, ga));
        bump(s.clubs, club, o, gf, ga);
      }
    }
  }

  for (const s of map.values()) {
    if (s.outcomes.length) {
      const first = s.outcomes[0];
      let count = 0;
      while (count < s.outcomes.length && s.outcomes[count] === first) count++;
      s.current = { type: first, count };
    }
    const chrono = [...s.outcomes].reverse();
    s.longestWin = longestRun(chrono, (o) => o === "W");
    s.longestUnbeaten = longestRun(chrono, (o) => o !== "L");
  }
  return map;
}

export interface Matchday {
  key: string;
  matches: ParsedMatch[];
  goals: number;
}

export function groupMatchdays(parsed: ParsedMatch[]): Matchday[] {
  const days: Matchday[] = [];
  for (const m of parsed) {
    let d = days[days.length - 1];
    if (!d || d.key !== m.matchday) {
      d = { key: m.matchday, matches: [], goals: 0 };
      days.push(d);
    }
    d.matches.push(m);
    d.goals += m.scoreA + m.scoreB;
  }
  return days;
}

export interface HeadToHead {
  rivals: { played: number; aWins: number; bWins: number; draws: number; aGoals: number; bGoals: number; matches: ParsedMatch[] };
  partners: Tally & { matches: ParsedMatch[] };
}

export function headToHead(parsed: ParsedMatch[], a: string, b: string): HeadToHead {
  const rivals = { played: 0, aWins: 0, bWins: 0, draws: 0, aGoals: 0, bGoals: 0, matches: [] as ParsedMatch[] };
  const partners = { ...emptyTally(), matches: [] as ParsedMatch[] };
  for (const m of parsed) {
    const sa = sideOf(m, a);
    const sb = sideOf(m, b);
    if (!sa || !sb) continue;
    const goalsFor = (s: Side) => (s === "A" ? m.scoreA : m.scoreB);
    if (sa === sb) {
      addResult(partners, outcomeForSide(m, sa), goalsFor(sa), goalsFor(sa === "A" ? "B" : "A"));
      partners.matches.push(m);
    } else {
      rivals.played++;
      rivals.aGoals += goalsFor(sa);
      rivals.bGoals += goalsFor(sb);
      const o = outcomeForSide(m, sa);
      if (o === "W") rivals.aWins++;
      else if (o === "L") rivals.bWins++;
      else rivals.draws++;
      rivals.matches.push(m);
    }
  }
  return { rivals, partners };
}

export interface DuoStats extends Tally {
  key: string;
  names: string[];
}

export function computeDuos(parsed: ParsedMatch[]): DuoStats[] {
  const map = new Map<string, DuoStats>();
  for (const m of parsed) {
    for (const side of ["A", "B"] as Side[]) {
      const team = side === "A" ? m.teamA : m.teamB;
      if (team.length < 2) continue;
      const key = duoKey(team);
      let d = map.get(key);
      if (!d) map.set(key, (d = { key, names: [...team].sort(), ...emptyTally() }));
      addResult(d, outcomeForSide(m, side), side === "A" ? m.scoreA : m.scoreB, side === "A" ? m.scoreB : m.scoreA);
    }
  }
  return [...map.values()];
}

export interface Records {
  biggestWin: ParsedMatch | null;
  goalFest: ParsedMatch | null;
  longestWinStreak: { name: string; count: number } | null;
  longestUnbeaten: { name: string; count: number } | null;
  bestDuo: DuoStats | null;
  mostPlayedDuo: DuoStats | null;
  busiestNight: Matchday | null;
}

export function computeRecords(
  parsed: ParsedMatch[],
  stats: Map<string, PlayerStats>,
  minDuoGames = 5,
): Records {
  let biggestWin: ParsedMatch | null = null;
  let goalFest: ParsedMatch | null = null;
  for (const m of parsed) {
    const margin = Math.abs(m.scoreA - m.scoreB);
    if (!biggestWin || margin > Math.abs(biggestWin.scoreA - biggestWin.scoreB)) biggestWin = m;
    if (!goalFest || m.scoreA + m.scoreB > goalFest.scoreA + goalFest.scoreB) goalFest = m;
  }
  let longestWinStreak: Records["longestWinStreak"] = null;
  let longestUnbeaten: Records["longestUnbeaten"] = null;
  for (const s of stats.values()) {
    if (!longestWinStreak || s.longestWin > longestWinStreak.count)
      longestWinStreak = { name: s.name, count: s.longestWin };
    if (!longestUnbeaten || s.longestUnbeaten > longestUnbeaten.count)
      longestUnbeaten = { name: s.name, count: s.longestUnbeaten };
  }
  const duos = computeDuos(parsed);
  const eligible = duos.filter((d) => d.played >= minDuoGames);
  const bestDuo =
    eligible.sort((a, b) => winRate(b) - winRate(a) || b.played - a.played)[0] ?? null;
  const mostPlayedDuo = [...duos].sort((a, b) => b.played - a.played)[0] ?? null;
  const busiestNight =
    [...groupMatchdays(parsed)].sort((a, b) => b.matches.length - a.matches.length)[0] ?? null;
  return { biggestWin, goalFest, longestWinStreak, longestUnbeaten, bestDuo, mostPlayedDuo, busiestNight };
}
