/**
 * Deeper analysis built on the Elo replay: how each player earns (and loses) their rating, how duos
 * fare against other duos and individual opponents, and the board's awards.
 *
 * Everything starts from an "appearance": one player in one match, with the win probability the Elo
 * model gave their side beforehand (clubs included), the Elo it moved, and the context around it.
 */
import { DEFAULT_CLUB_ELO, type EloEngine } from "./elo";
import { duoKey, TIME_ZONE } from "./format";
import { UPSET_THRESHOLD } from "./insights";
import { addResult, emptyTally, outcomeForSide, type ParsedMatch, type Tally } from "./stats";
import type { Outcome, Side } from "./types";

export type Role = "favourite" | "even" | "underdog";
export type ClubEdge = "stronger" | "level" | "weaker";

/** A side with at least this win probability is the favourite; with at most 1 − this, the underdog. */
export const FAVOURITE_AT = 0.55;
/** A club Elo gap of at least this much means playing with the stronger (or weaker) club. */
export const CLUB_EDGE_AT = 100;
/** Losing with at least this win probability counts as a bottled match. */
export const BOTTLE_AT = 0.65;
/** Awards and archetypes need this many rated matches. */
export const MIN_MATCHES = 8;

export const roleOf = (expected: number): Role =>
  expected >= FAVOURITE_AT ? "favourite" : expected <= 1 - FAVOURITE_AT ? "underdog" : "even";

const clubEdgeOf = (diff: number): ClubEdge =>
  diff >= CLUB_EDGE_AT ? "stronger" : diff <= -CLUB_EDGE_AT ? "weaker" : "level";

const hourFmt = new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, hour: "numeric", hourCycle: "h23" });
/** Hour of day (0–23) in the board's time zone. */
export const localHour = (d: Date) => Number(hourFmt.format(d));

export interface Appearance {
  match: ParsedMatch;
  side: Side;
  partners: string[];
  opponents: string[];
  outcome: Outcome;
  /** 1 for a win, 0.5 for a draw, 0 for a loss */
  score: number;
  gf: number;
  ga: number;
  /** win probability of this player's side before kick-off */
  expected: number;
  delta: number;
  club: string;
  oppClub: string;
  /** own club Elo − opponent club Elo */
  clubDiff: number;
  role: Role;
  clubEdge: ClubEdge;
  /** 1 = this player's first match of that night */
  nightIndex: number;
  lastOfNight: boolean;
  /** played between midnight and 6:00 */
  afterMidnight: boolean;
}

const SCORE: Record<Outcome, number> = { W: 1, D: 0.5, L: 0 };

/** Every player's appearances, oldest first. Matches the Elo replay skipped are left out. */
export function buildAppearances(parsed: ParsedMatch[], engine: EloEngine): Map<string, Appearance[]> {
  const club = (name: string) => engine.clubElo.get(name) ?? DEFAULT_CLUB_ELO;
  const out = new Map<string, Appearance[]>();
  for (const m of [...parsed].reverse()) {
    const elo = engine.perMatch.get(m.id);
    if (!elo) continue;
    const late = localHour(m.date) < 6;
    for (const side of ["A", "B"] as Side[]) {
      const team = side === "A" ? m.teamA : m.teamB;
      const opponents = side === "A" ? m.teamB : m.teamA;
      const expected = side === "A" ? elo.expectedA : 1 - elo.expectedA;
      const delta = (side === "A" ? elo.teamA : elo.teamB)[0]?.delta ?? 0;
      const ownClub = side === "A" ? m.clubA : m.clubB;
      const oppClub = side === "A" ? m.clubB : m.clubA;
      const clubDiff = club(ownClub) - club(oppClub);
      const outcome = outcomeForSide(m, side);
      for (const name of team) {
        const list = out.get(name) ?? [];
        const prev = list[list.length - 1];
        list.push({
          match: m,
          side,
          partners: team.filter((t) => t !== name),
          opponents,
          outcome,
          score: SCORE[outcome],
          gf: side === "A" ? m.scoreA : m.scoreB,
          ga: side === "A" ? m.scoreB : m.scoreA,
          expected,
          delta,
          club: ownClub,
          oppClub,
          clubDiff,
          role: roleOf(expected),
          clubEdge: clubEdgeOf(clubDiff),
          nightIndex: prev && prev.match.matchday === m.matchday ? prev.nightIndex + 1 : 1,
          lastOfNight: true,
          afterMidnight: late,
        });
        if (prev && prev.match.matchday === m.matchday) prev.lastOfNight = false;
        out.set(name, list);
      }
    }
  }
  return out;
}

/* --------------------------------- Buckets --------------------------------- */

/** A record plus the Elo it moved and how it compares with the odds. */
export interface Bucket extends Tally {
  delta: number;
  /** sum of pre-match win probabilities */
  expected: number;
  /** sum of results (win 1, draw ½) */
  score: number;
}

export const emptyBucket = (): Bucket => ({ ...emptyTally(), delta: 0, expected: 0, score: 0 });

function add(b: Bucket, a: Appearance) {
  addResult(b, a.outcome, a.gf, a.ga);
  b.delta += a.delta;
  b.expected += a.expected;
  b.score += a.score;
}

/** Share of available points taken: win 1, draw ½ (0–100). */
export const scoreRate = (b: Pick<Bucket, "played" | "score">) => (b.played ? (b.score / b.played) * 100 : 0);

/* --------------------------------- Elo DNA --------------------------------- */

export interface Archetype {
  key: string;
  title: string;
  blurb: string;
}

export interface EloDna {
  all: Bucket;
  byRole: Record<Role, Bucket>;
  byClub: Record<ClubEdge, Bucket>;
  /** Elo moved by each kind of result in each role */
  sources: Record<Role, Record<Outcome, number>>;
  /** wins with less than UPSET_THRESHOLD win probability */
  upsets: Bucket;
  /** losses with at least BOTTLE_AT win probability */
  bottles: Bucket;
  /** the match right after a win / after a loss */
  afterWin: Bucket;
  afterLoss: Bucket;
  afterMidnight: Bucket;
  beforeMidnight: Bucket;
  lastOfNight: Bucket;
  /** results above (+) or below (−) what the odds predicted, in matches */
  overPerformance: number;
  avgExpected: number;
  avgClubDiff: number;
  best?: Appearance;
  worst?: Appearance;
  archetype: Archetype;
}

const byRoleOf = <T,>(make: () => T): Record<Role, T> => ({ favourite: make(), even: make(), underdog: make() });

export function eloDna(apps: Appearance[]): EloDna {
  const dna: Omit<EloDna, "archetype"> = {
    all: emptyBucket(),
    byRole: byRoleOf(emptyBucket),
    byClub: { stronger: emptyBucket(), level: emptyBucket(), weaker: emptyBucket() },
    sources: byRoleOf(() => ({ W: 0, D: 0, L: 0 })),
    upsets: emptyBucket(),
    bottles: emptyBucket(),
    afterWin: emptyBucket(),
    afterLoss: emptyBucket(),
    afterMidnight: emptyBucket(),
    beforeMidnight: emptyBucket(),
    lastOfNight: emptyBucket(),
    overPerformance: 0,
    avgExpected: 0,
    avgClubDiff: 0,
  };
  apps.forEach((a, i) => {
    add(dna.all, a);
    add(dna.byRole[a.role], a);
    add(dna.byClub[a.clubEdge], a);
    dna.sources[a.role][a.outcome] += a.delta;
    if (a.outcome === "W" && a.expected < UPSET_THRESHOLD) add(dna.upsets, a);
    if (a.outcome === "L" && a.expected >= BOTTLE_AT) add(dna.bottles, a);
    const prev = apps[i - 1];
    if (prev?.outcome === "W") add(dna.afterWin, a);
    if (prev?.outcome === "L") add(dna.afterLoss, a);
    add(a.afterMidnight ? dna.afterMidnight : dna.beforeMidnight, a);
    if (a.lastOfNight) add(dna.lastOfNight, a);
    dna.avgClubDiff += a.clubDiff;
    if (!dna.best || a.delta > dna.best.delta) dna.best = a;
    if (!dna.worst || a.delta < dna.worst.delta) dna.worst = a;
  });
  const n = dna.all.played || 1;
  dna.overPerformance = dna.all.score - dna.all.expected;
  dna.avgExpected = dna.all.expected / n;
  dna.avgClubDiff /= n;
  return { ...dna, archetype: archetypeOf(dna) };
}

const pct = (v: number) => `${Math.round(v)}%`;

function archetypeOf(d: Omit<EloDna, "archetype">): Archetype {
  const played = d.all.played;
  if (played < MIN_MATCHES)
    return {
      key: "rookie",
      title: "Rookie",
      blurb: `${played} rated matches so far: the profile takes shape after ${MIN_MATCHES}.`,
    };
  const gained = (["favourite", "even", "underdog"] as Role[]).reduce(
    (sum, r) => sum + Math.max(0, d.sources[r].W) + Math.max(0, d.sources[r].D),
    0,
  );
  const share = (v: number) => (gained > 0 ? Math.max(0, v) / gained : 0);
  const underdogShare = share(d.sources.underdog.W);
  const favouriteShare = share(d.sources.favourite.W);
  const evenShare = d.byRole.even.played / played;
  const perMatch = d.overPerformance / played;
  const overall = scoreRate(d.all);
  const tiltGap = d.afterLoss.played >= 6 ? scoreRate(d.afterLoss) - overall : 0;
  const nightGap =
    d.afterMidnight.played >= 6 && d.beforeMidnight.played >= 6
      ? scoreRate(d.afterMidnight) - scoreRate(d.beforeMidnight)
      : 0;

  const candidates: (Archetype & { score: number })[] = [
    {
      key: "giant-killer",
      title: "Giant Killer",
      blurb: `${pct(underdogShare * 100)} of the Elo they won came from matches they were expected to lose.`,
      score: d.byRole.underdog.wins >= 3 ? underdogShare / 0.35 : 0,
    },
    {
      key: "overachiever",
      title: "Overachiever",
      blurb: `${d.overPerformance.toFixed(1)} more results than the odds gave them.`,
      score: perMatch / 0.07,
    },
    {
      key: "flat-track-bully",
      title: "Flat-Track Bully",
      blurb: `${pct(favouriteShare * 100)} of their Elo comes from games they were favourites in.`,
      score: d.avgExpected >= FAVOURITE_AT ? favouriteShare / 0.6 : 0,
    },
    {
      key: "club-merchant",
      title: "Club Merchant",
      blurb: `Plays with a club ${Math.round(d.avgClubDiff)} Elo stronger than the opponent's on average.`,
      score: d.avgClubDiff / 90,
    },
    {
      key: "handicapper",
      title: "Handicapper",
      blurb: `Hands the opponent a club ${Math.round(-d.avgClubDiff)} Elo stronger on average.`,
      score: -d.avgClubDiff / 90,
    },
    {
      key: "unlucky",
      title: "Hard Luck",
      blurb: `${(-d.overPerformance).toFixed(1)} fewer results than the odds gave them.`,
      score: -perMatch / 0.07,
    },
    {
      key: "coin-flipper",
      title: "Coin-Flip King",
      blurb: `${pct(evenShare * 100)} of their matches were coin flips (45–55% win probability).`,
      score: evenShare / 0.5,
    },
    {
      key: "tilt-proof",
      title: "Tilt-Proof",
      blurb: `Takes ${pct(scoreRate(d.afterLoss))} of the points right after a loss, ${pct(overall)} overall.`,
      score: tiltGap / 12,
    },
    {
      key: "night-owl",
      title: "Night Owl",
      blurb: `${pct(scoreRate(d.afterMidnight))} of points after midnight, ${pct(scoreRate(d.beforeMidnight))} before.`,
      score: nightGap / 15,
    },
  ];
  const best = candidates.reduce((a, b) => (b.score > a.score ? b : a));
  if (best.score < 1)
    return { key: "all-rounder", title: "All-Rounder", blurb: "No single trick: points come from every kind of match." };
  return { key: best.key, title: best.title, blurb: best.blurb };
}

/* ---------------------------------- Awards --------------------------------- */

export interface Award {
  key: string;
  title: string;
  /** why it matters, in a few words */
  caption: string;
  winner: string;
  value: string;
  detail: string;
  runnerUp?: { name: string; value: string };
}

export function computeAwards(dnas: Map<string, EloDna>, eligible: string[]): Award[] {
  const pool = eligible.map((name) => ({ name, d: dnas.get(name) })).filter((x) => x.d && x.d.all.played >= MIN_MATCHES) as {
    name: string;
    d: EloDna;
  }[];
  const pick = (
    key: string,
    title: string,
    caption: string,
    metric: (d: EloDna) => number | null,
    show: (d: EloDna, v: number) => [string, string],
    lowest = false,
  ): Award | null => {
    const ranked = pool
      .map(({ name, d }) => ({ name, d, v: metric(d) }))
      .filter((x): x is { name: string; d: EloDna; v: number } => x.v !== null)
      .sort((a, b) => (lowest ? a.v - b.v : b.v - a.v));
    const [best, second] = ranked;
    if (!best) return null;
    const [value, detail] = show(best.d, best.v);
    return {
      key,
      title,
      caption,
      winner: best.name,
      value,
      detail,
      runnerUp: second ? { name: second.name, value: show(second.d, second.v)[0] } : undefined,
    };
  };
  const elo = (v: number) => `${v >= 0 ? "+" : "−"}${Math.abs(Math.round(v))} Elo`;
  const rate = (b: Bucket, min: number) => (b.played >= min ? scoreRate(b) : null);
  return [
    pick("giant-killer", "Giant Killer", "Most Elo from wins as the underdog", (d) => d.sources.underdog.W, (d, v) => [
      elo(v),
      `${d.byRole.underdog.wins} wins as underdog · ${d.upsets.wins} big upsets`,
    ]),
    pick("flat-track-bully", "Flat-Track Bully", "Most Elo from wins as the favourite", (d) => d.sources.favourite.W, (d, v) => [
      elo(v),
      `${d.byRole.favourite.wins} of ${d.byRole.favourite.played} won as favourite`,
    ]),
    pick("overachiever", "Overachiever", "Most results above what the odds said", (d) => d.overPerformance, (d, v) => [
      `+${v.toFixed(1)}`,
      `${d.all.score.toFixed(1)} points from ${d.all.expected.toFixed(1)} expected`,
    ]),
    pick(
      "bottler",
      "The Bottler",
      "Most Elo dropped as the favourite",
      (d) => (d.byRole.favourite.losses ? d.sources.favourite.L : null),
      (d, v) => [elo(v), `${d.byRole.favourite.losses} losses as favourite · ${d.bottles.played} as heavy favourite`],
      true,
    ),
    pick("club-merchant", "Club Merchant", "Picks the strongest clubs", (d) => d.avgClubDiff, (d, v) => [
      `${v >= 0 ? "+" : "−"}${Math.abs(Math.round(v))}`,
      `club Elo over the opponent, on average · ${d.byClub.stronger.played} games with the stronger club`,
    ]),
    pick("tilt-proof", "Tilt-Proof", "Best right after a loss", (d) => rate(d.afterLoss, 6), (d, v) => [
      `${Math.round(v)}%`,
      `of points after a loss (${d.afterLoss.wins}W ${d.afterLoss.draws}D ${d.afterLoss.losses}L)`,
    ]),
    pick("night-owl", "Night Owl", "Best after midnight", (d) => rate(d.afterMidnight, 6), (d, v) => [
      `${Math.round(v)}%`,
      `of points after midnight, ${Math.round(scoreRate(d.beforeMidnight))}% before`,
    ]),
    pick("closer", "The Closer", "Best in the last match of the night", (d) => rate(d.lastOfNight, 4), (d, v) => [
      `${Math.round(v)}%`,
      `of points in a night's final match (${d.lastOfNight.played} nights)`,
    ]),
  ].filter((a): a is Award => a !== null);
}

/* ----------------------------------- Duos ---------------------------------- */

export interface VsRecord {
  key: string;
  names: string[];
  record: Bucket;
}

export interface DuoProfile {
  key: string;
  names: string[];
  record: Bucket;
  vsDuos: VsRecord[];
  vsPlayers: VsRecord[];
  clubs: VsRecord[];
  /** duo score rate − the members' average score rate in matches without each other (percentage points) */
  chemistry: number | null;
  matches: ParsedMatch[];
}

const sortByPlayed = (list: VsRecord[]) =>
  list.sort((a, b) => b.record.played - a.record.played || scoreRate(b.record) - scoreRate(a.record));

function addTo(map: Map<string, VsRecord>, key: string, names: string[], a: Appearance) {
  let row = map.get(key);
  if (!row) map.set(key, (row = { key, names, record: emptyBucket() }));
  add(row.record, a);
}

/** Every two-player side, with its record against opposing duos, individual opponents and clubs. */
export function duoProfiles(apps: Map<string, Appearance[]>): DuoProfile[] {
  const duos = new Map<
    string,
    { names: string[]; record: Bucket; vsDuos: Map<string, VsRecord>; vsPlayers: Map<string, VsRecord>; clubs: Map<string, VsRecord>; matches: ParsedMatch[] }
  >();
  for (const [name, list] of apps) {
    for (const a of list) {
      if (a.partners.length !== 1 || name > a.partners[0]) continue; // count each side once, via its first member
      const names = [name, a.partners[0]].sort();
      const key = duoKey(names);
      let d = duos.get(key);
      if (!d) {
        d = { names, record: emptyBucket(), vsDuos: new Map(), vsPlayers: new Map(), clubs: new Map(), matches: [] };
        duos.set(key, d);
      }
      add(d.record, a);
      d.matches.push(a.match);
      if (a.opponents.length === 2) addTo(d.vsDuos, duoKey(a.opponents), [...a.opponents].sort(), a);
      a.opponents.forEach((o) => addTo(d.vsPlayers, o, [o], a));
      addTo(d.clubs, a.club, [a.club], a);
    }
  }

  // each member's results in matches without the other one
  const without = (player: string, partner: string) => {
    const b = emptyBucket();
    (apps.get(player) ?? []).filter((a) => !a.partners.includes(partner)).forEach((a) => add(b, a));
    return b;
  };

  return [...duos.entries()].map(([key, d]) => {
    const [p, q] = d.names;
    const apart = [without(p, q), without(q, p)].filter((b) => b.played >= 3);
    return {
      key,
      names: d.names,
      record: d.record,
      vsDuos: sortByPlayed([...d.vsDuos.values()]),
      vsPlayers: sortByPlayed([...d.vsPlayers.values()]),
      clubs: sortByPlayed([...d.clubs.values()]),
      chemistry:
        apart.length === 2 && d.record.played >= 3
          ? scoreRate(d.record) - (scoreRate(apart[0]) + scoreRate(apart[1])) / 2
          : null,
      matches: [...d.matches].reverse(),
    };
  });
}

export interface Rivalry {
  a: string[];
  b: string[];
  /** from duo a's point of view */
  record: Bucket;
}

/** Duo-vs-duo pairings that met most often. */
export function duoRivalries(duos: DuoProfile[]): Rivalry[] {
  const seen = new Set<string>();
  const out: Rivalry[] = [];
  for (const d of duos) {
    for (const v of d.vsDuos) {
      const id = [d.key, v.key].sort().join(" vs ");
      if (seen.has(id)) continue;
      seen.add(id);
      out.push({ a: d.names, b: v.names, record: v.record });
    }
  }
  return out.sort((x, y) => y.record.played - x.record.played);
}

/** A player's record against each opposing duo. */
export function vsDuosOf(apps: Appearance[]): VsRecord[] {
  const map = new Map<string, VsRecord>();
  apps.filter((a) => a.opponents.length === 2).forEach((a) => addTo(map, duoKey(a.opponents), [...a.opponents].sort(), a));
  return sortByPlayed([...map.values()]);
}

/* ---------------------------------- Night ---------------------------------- */

export interface HourStat {
  hour: number;
  matches: number;
  goals: number;
}

/** Matches and goals by local kick-off hour, in evening-to-morning order (12:00 … 11:00). */
export function goalsByHour(parsed: ParsedMatch[]): HourStat[] {
  const rows = new Map<number, HourStat>();
  for (const m of parsed) {
    const hour = localHour(m.date);
    const row = rows.get(hour) ?? { hour, matches: 0, goals: 0 };
    row.matches++;
    row.goals += m.scoreA + m.scoreB;
    rows.set(hour, row);
  }
  return [...rows.values()].sort((a, b) => ((a.hour + 12) % 24) - ((b.hour + 12) % 24));
}
