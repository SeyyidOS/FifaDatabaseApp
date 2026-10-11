/**
 * The night report: one matchday told as awards, headlines and numbers. Everything is worked out from
 * the board's data, so a match added or deleted later changes the report too.
 */
import type { Appearance } from "./analysis";
import type { EloEngine } from "./elo";
import type { Matchday, ParsedMatch } from "./stats";
import type { Side } from "./types";

/** The night on show and until when (temporary: the 10 October 2026 night). */
export const NIGHT_RECAP = { night: "2026-10-10", until: new Date("2026-10-14T06:00:00+03:00") };

export const nightRecapOn = (now = new Date()) => now < NIGHT_RECAP.until;

/** The winner had less than this chance going in. */
const UPSET_AT = 0.35;
/** A side below this chance was the underdog, above 1 − this the favourite. */
const UNDERDOG_AT = 0.45;

export interface PlayerNight {
  name: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  gf: number;
  ga: number;
  /** Elo won or lost over the night */
  delta: number;
  /** most matches in a row without a loss */
  unbeaten: number;
  /** wins and losses with the odds against or for them */
  underdogWins: number;
  favouriteLosses: number;
  /** matches after midnight and the points from them (3 a win, 1 a draw) */
  lateGames: number;
  latePoints: number;
}

export interface DuoNight {
  pair: [string, string];
  played: number;
  wins: number;
  draws: number;
  losses: number;
  gf: number;
  ga: number;
}

export interface ClubNight {
  club: string;
  elo: number;
  /** rated below the night's typical club */
  underdog?: boolean;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  gf: number;
  ga: number;
}

export interface MatchMoment {
  match: ParsedMatch;
  winner: Side;
  /** the winners' chance before kick-off */
  chance: number;
}

export type NightAwardKey =
  | "king"
  | "giantSlayer"
  | "unbeaten"
  | "machine"
  | "wall"
  | "nightOwl"
  | "diplomat"
  | "ironMan"
  | "cursed"
  | "sieve"
  | "tomorrow"
  | "chinUp";

export interface NightAward {
  key: NightAwardKey;
  winner: PlayerNight;
  /** the number the award is about */
  value: number;
  runnerUp?: { name: string; value: number };
  /** a roast rather than an honour */
  roast?: boolean;
}

export interface NightRecap {
  key: string;
  /** oldest first */
  matches: ParsedMatch[];
  goals: number;
  draws: number;
  upsets: number;
  start: Date;
  end: Date;
  /** best Elo night first */
  players: PlayerNight[];
  awards: NightAward[];
  biggestUpset: MatchMoment | null;
  goalFest: ParsedMatch | null;
  club: ClubNight | null;
  dreamDuo: DuoNight | null;
  nightmareDuo: DuoNight | null;
  /** the night's last match, if someone won it */
  lastWord: MatchMoment | null;
  photos: number;
}

const points = (d: { wins: number; draws: number }) => d.wins * 3 + d.draws;
const goalDiff = (d: { gf: number; ga: number }) => d.gf - d.ga;

function winnerChance(m: ParsedMatch, engine: EloEngine): MatchMoment | null {
  const elo = engine.perMatch.get(m.id);
  if (!elo || m.result === "D") return null;
  return { match: m, winner: m.result, chance: m.result === "A" ? elo.expectedA : 1 - elo.expectedA };
}

function playerNight(name: string, apps: Appearance[]): PlayerNight {
  const p: PlayerNight = {
    name,
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    gf: 0,
    ga: 0,
    delta: 0,
    unbeaten: 0,
    underdogWins: 0,
    favouriteLosses: 0,
    lateGames: 0,
    latePoints: 0,
  };
  let run = 0;
  for (const a of apps) {
    p.played++;
    p.gf += a.gf;
    p.ga += a.ga;
    p.delta += a.delta;
    if (a.outcome === "W") p.wins++;
    else if (a.outcome === "D") p.draws++;
    else p.losses++;
    run = a.outcome === "L" ? 0 : run + 1;
    p.unbeaten = Math.max(p.unbeaten, run);
    if (a.outcome === "W" && a.expected < UNDERDOG_AT) p.underdogWins++;
    if (a.outcome === "L" && a.expected > 1 - UNDERDOG_AT) p.favouriteLosses++;
    if (a.afterMidnight) {
      p.lateGames++;
      p.latePoints += a.outcome === "W" ? 3 : a.outcome === "D" ? 1 : 0;
    }
  }
  return p;
}

/**
 * The player with the highest `value` among those it counts for (null = not eligible), with the
 * runner-up; ties go to `tie`, then to fewer matches played (did it in less time).
 */
function best(
  players: PlayerNight[],
  value: (p: PlayerNight) => number | null,
  tie: (p: PlayerNight) => number = () => 0,
): { winner: PlayerNight; value: number; runnerUp?: { name: string; value: number } } | null {
  const ranked = players
    .map((p) => ({ p, v: value(p) }))
    .filter((r): r is { p: PlayerNight; v: number } => r.v !== null)
    .sort((a, b) => b.v - a.v || tie(b.p) - tie(a.p) || a.p.played - b.p.played);
  if (!ranked.length) return null;
  const [first, second] = ranked;
  return { winner: first.p, value: first.v, runnerUp: second && { name: second.p.name, value: second.v } };
}

function duos(night: Map<string, Appearance[]>): DuoNight[] {
  const map = new Map<string, DuoNight>();
  for (const [name, apps] of night) {
    for (const a of apps) {
      const [partner] = a.partners;
      // count each pair once: from the player whose name sorts first
      if (a.partners.length !== 1 || partner < name) continue;
      const key = `${name}|${partner}`;
      const d = map.get(key) ?? { pair: [name, partner], played: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0 };
      d.played++;
      d.gf += a.gf;
      d.ga += a.ga;
      if (a.outcome === "W") d.wins++;
      else if (a.outcome === "D") d.draws++;
      else d.losses++;
      map.set(key, d);
    }
  }
  return [...map.values()];
}

function clubs(matches: ParsedMatch[]): ClubNight[] {
  const map = new Map<string, ClubNight>();
  for (const m of matches) {
    for (const side of ["A", "B"] as Side[]) {
      const club = side === "A" ? m.clubA : m.clubB;
      const c = map.get(club) ?? {
        club,
        elo: side === "A" ? m.clubAElo : m.clubBElo,
        played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        gf: 0,
        ga: 0,
      };
      c.played++;
      c.gf += side === "A" ? m.scoreA : m.scoreB;
      c.ga += side === "A" ? m.scoreB : m.scoreA;
      if (m.result === "D") c.draws++;
      else if (m.result === side) c.wins++;
      else c.losses++;
      map.set(club, c);
    }
  }
  return [...map.values()];
}

export function nightRecap(day: Matchday, engine: EloEngine, appearances: Map<string, Appearance[]>): NightRecap {
  const matches = [...day.matches].sort((a, b) => a.date.getTime() - b.date.getTime() || a.id - b.id);
  const night = new Map<string, Appearance[]>();
  for (const [name, apps] of appearances) {
    const tonight = apps.filter((a) => a.match.matchday === day.key);
    if (tonight.length) night.set(name, tonight);
  }
  const players = [...night].map(([name, apps]) => playerNight(name, apps)).sort((a, b) => b.delta - a.delta);
  const regulars = players.filter((p) => p.played >= 3);

  const moments = matches.map((m) => winnerChance(m, engine)).filter((x): x is MatchMoment => x !== null);
  const upsets = moments.filter((x) => x.chance < UPSET_AT);
  const biggestUpset = [...upsets].sort((a, b) => a.chance - b.chance)[0] ?? null;
  const goalsOf = (m: ParsedMatch) => m.scoreA + m.scoreB;
  // the most goals; of equals, the latest
  const goalFest = matches.reduce<ParsedMatch | null>((top, m) => (!top || goalsOf(m) >= goalsOf(top) ? m : top), null);

  const allClubs = clubs(matches);
  const ratings = allClubs.map((c) => c.elo).sort((a, b) => a - b);
  const median = ratings[Math.floor(ratings.length / 2)] ?? 0;
  // the club that did most with least: points, then goal difference, then the lower rating
  const top = allClubs
    .filter((c) => c.played >= 2 && c.wins > 0)
    .sort((a, b) => points(b) - points(a) || goalDiff(b) - goalDiff(a) || a.elo - b.elo)[0];
  const club = top ? { ...top, underdog: top.elo < median } : null;

  const pairs = duos(night).filter((d) => d.played >= 2);
  const byForm = (a: DuoNight, b: DuoNight) => points(b) / b.played - points(a) / a.played || goalDiff(b) - goalDiff(a) || a.ga - b.ga;
  const sorted = [...pairs].sort(byForm);
  const dreamDuo = sorted.find((d) => d.wins > 0) ?? null;
  const nightmare = sorted.at(-1);
  const nightmareDuo = nightmare && nightmare !== dreamDuo && nightmare.wins === 0 ? nightmare : null;

  const last = matches.at(-1);
  const lastWord = last ? winnerChance(last, engine) : null;

  const awards: NightAward[] = [];
  const roasted = new Set<string>();
  const add = (key: NightAwardKey, r: ReturnType<typeof best>, roast = false) => {
    if (!r) return;
    // one roast per player is enough for one night
    if (roast && roasted.has(r.winner.name)) return;
    if (roast) roasted.add(r.winner.name);
    awards.push({ key, winner: r.winner, value: r.value, runnerUp: r.runnerUp, roast });
  };
  add("king", best(players, (p) => (p.delta > 0 ? Math.round(p.delta) : null)));
  add("giantSlayer", best(players, (p) => (p.underdogWins >= 2 ? p.underdogWins : null), (p) => p.wins));
  add("unbeaten", best(players, (p) => (p.unbeaten >= 3 ? p.unbeaten : null), (p) => p.wins));
  add("machine", best(regulars, (p) => p.gf / p.played));
  add("wall", best(regulars, (p) => -p.ga / p.played));
  add("nightOwl", best(players, (p) => (p.lateGames >= 3 && p.latePoints > 0 ? p.latePoints : null), (p) => -p.lateGames));
  add("diplomat", best(players, (p) => (p.draws >= 2 ? p.draws : null)));
  add("ironMan", best(players, (p) => p.played));
  add("cursed", best(players, (p) => (p.favouriteLosses >= 2 ? p.favouriteLosses : null)), true);
  add("sieve", best(regulars, (p) => p.ga / p.played), true);
  add("tomorrow", best(players, (p) => (p.delta < 0 ? -Math.round(p.delta) : null)), true);
  // the fewest points a match, for whoever no roast above went to
  add("chinUp", best(regulars.filter((p) => !roasted.has(p.name)), (p) => -points(p) / p.played), true);

  return {
    key: day.key,
    matches,
    goals: day.goals,
    draws: matches.filter((m) => m.result === "D").length,
    upsets: upsets.length,
    start: matches[0]?.date ?? new Date(),
    end: matches.at(-1)?.date ?? new Date(),
    players,
    awards,
    biggestUpset,
    goalFest,
    club,
    dreamDuo,
    nightmareDuo,
    lastWord,
    photos: matches.reduce((n, m) => n + m.photos.length, 0),
  };
}
