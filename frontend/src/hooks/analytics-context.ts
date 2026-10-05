import { createContext } from "react";
import type { EloEngine, EloPoint } from "../lib/elo";
import type { Matchday, ParsedMatch, PlayerStats, Records } from "../lib/stats";
import type { Club, Match, Player } from "../lib/types";

export interface RankedPlayer {
  id: number;
  name: string;
  elo: number;
  rank: number;
  /** Positions gained (+) or lost (−) over the latest matchday. */
  rankDelta: number;
  /** Elo gained over the latest matchday. */
  eloDelta: number;
  peak: number;
  provisional: boolean;
  history: EloPoint[];
  stats?: PlayerStats;
}

export interface Analytics {
  players: Player[];
  clubs: Club[];
  matches: Match[];
  parsed: ParsedMatch[];
  engine: EloEngine;
  stats: Map<string, PlayerStats>;
  ranking: RankedPlayer[];
  byName: Map<string, RankedPlayer>;
  eloByName: Map<string, number>;
  matchdays: Matchday[];
  records: Records;
  k: number;
}

export interface AnalyticsState {
  data: Analytics | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

export const AnalyticsContext = createContext<AnalyticsState | null>(null);

export const PROVISIONAL_GAMES = 5;
