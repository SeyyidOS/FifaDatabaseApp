import { createContext } from "react";
import type { Appearance, DuoProfile, EloDna } from "../lib/analysis";
import type { EloEngine, EloPoint } from "../lib/elo";
import type { Matchday, ParsedMatch, PlayerStats, Records } from "../lib/stats";
import type { Club, Match, Player, Season } from "../lib/types";

export interface RankedPlayer {
  id: number;
  name: string;
  elo: number;
  /** 1-based position among ranked players; 0 for new players (see `provisional`) and archived ones. */
  rank: number;
  /** Positions gained (+) or lost (−) over the latest matchday. */
  rankDelta: number;
  /** Elo gained over the latest matchday. */
  eloDelta: number;
  peak: number;
  /** New to the board: fewer than `Analytics.rankedAfter` matches, so rated but not ranked yet. */
  provisional: boolean;
  /** Left the roster: not ranked (rank 0), but their matches still count. */
  archived: boolean;
  history: EloPoint[];
  stats?: PlayerStats;
}

export interface Analytics {
  players: Player[];
  /** oldest first */
  seasons: Season[];
  /** the season new matches are played in */
  season: Season | null;
  /** its clubs, strongest first */
  clubs: Club[];
  matches: Match[];
  parsed: ParsedMatch[];
  engine: EloEngine;
  stats: Map<string, PlayerStats>;
  /** Active players: the ranked ones best first, then the new ones by rating. */
  ranking: RankedPlayer[];
  /** matches a player needs before they get a rank on this board */
  rankedAfter: number;
  /** Everyone, archived players included. */
  byName: Map<string, RankedPlayer>;
  eloByName: Map<string, number>;
  matchdays: Matchday[];
  records: Records;
  /** every player's matches with the odds and Elo around them, oldest first */
  appearances: Map<string, Appearance[]>;
  /** how each player earns their Elo */
  dna: Map<string, EloDna>;
  duos: DuoProfile[];
  k: number;
  /** how much a club's rating counts in a side's strength, for matches entered from now on */
  clubWeight: number;
}

export interface AnalyticsState {
  data: Analytics | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

export const AnalyticsContext = createContext<AnalyticsState | null>(null);
