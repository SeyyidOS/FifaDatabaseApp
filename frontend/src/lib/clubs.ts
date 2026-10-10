import { rateClubs, sanitizeModel, type Card, type CardClub, type CardSet, type ModelResult } from "./clubModel";
import { addResult, emptyTally, outcomeForSide, type ParsedMatch, type Tally } from "./stats";
import type { Club, Outcome, Season } from "./types";

/** The newest game we have cards for; new card-model seasons start from it. */
export const LATEST_GAME = "FC27";

/** A card model scales a season onto the one before it (seasons come oldest first). */
export function referenceSeason(seasons: Season[], season: Season): Season | null {
  const i = seasons.findIndex((s) => s.id === season.id);
  return i > 0 ? seasons[i - 1] : null;
}

/** Find a club of a season by its game id, else by name (lists entered by hand have no ids). */
export function clubFinder(clubs: Club[]) {
  const byEa = new Map(clubs.filter((c) => c.eaId != null).map((c) => [c.eaId!, c]));
  const byName = new Map(clubs.map((c) => [c.name.toLowerCase(), c]));
  return (club: Pick<CardClub, "eaId" | "name">): Club | null =>
    byEa.get(club.eaId) ?? byName.get(club.name.toLowerCase()) ?? null;
}

/** Rate a game's clubs with the given settings, scaled onto the reference season if there is one. */
export function runModel(cards: CardSet, model: unknown, reference: Season | null): ModelResult {
  const find = reference ? clubFinder(reference.clubs) : null;
  return rateClubs(cards, sanitizeModel(model, !!reference), (c) => find?.(c)?.elo ?? null);
}

/** One match played with a club, seen from that club's side. */
export interface ClubGame {
  date: Date;
  opponent: string;
  gf: number;
  ga: number;
}

export interface ClubRecord extends Tally {
  /** most recent first */
  outcomes: Outcome[];
  /** the matches behind `outcomes`, in the same order */
  games: ClubGame[];
}

/** How the group has done with a club (a club on both sides of a match counts for neither). */
export function clubRecord(parsed: ParsedMatch[], name: string): ClubRecord {
  const key = name.toLowerCase();
  const rec: ClubRecord = { ...emptyTally(), outcomes: [], games: [] };
  for (const m of parsed) {
    const a = m.clubA.toLowerCase() === key;
    const b = m.clubB.toLowerCase() === key;
    if (a === b) continue;
    const side = a ? "A" : "B";
    const o = outcomeForSide(m, side);
    const gf = side === "A" ? m.scoreA : m.scoreB;
    const ga = side === "A" ? m.scoreB : m.scoreA;
    addResult(rec, o, gf, ga);
    rec.outcomes.push(o);
    rec.games.push({ date: m.date, opponent: side === "A" ? m.clubB : m.clubA, gf, ga });
  }
  return rec;
}

const plain = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Is the game's name for a club worth showing next to ours ("Lombardia FC" yes, "FC Barcelona" no)? */
export function distinctGameName(ours: string, game: string): boolean {
  const a = plain(ours);
  const b = plain(game);
  return !a.includes(b) && !b.includes(a);
}

/** URL-safe key of a club for /clubs/:club. */
export const clubPath = (name: string) => `/clubs/${encodeURIComponent(name)}`;

/** Card face, served next to the app. */
export const faceUrl = (game: string, id: number) =>
  `${import.meta.env.BASE_URL}games/${game.toLowerCase()}/faces/${id}.webp`;

/** A card's pace; goalkeepers have no outfield stats. */
export const pace = (card: Card): number | null => card.stats?.[0] ?? null;

/** "PAC 86 · LB · CB · LM": a card's pace (first, so a long list of positions never hides it) and positions. */
export const cardLine = (card: Card) => [...(pace(card) != null ? [`PAC ${pace(card)}`] : []), card.pos, ...card.alt].join(" · ");
