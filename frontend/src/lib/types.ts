export interface Player {
  id: number;
  name: string;
  /** Archived players left the roster; their matches still count. */
  archived: boolean;
}

export interface Club {
  id: number;
  name: string;
  elo: number;
  /** the club's id in the game (card-model seasons) */
  eaId: number | null;
  /** the card model's rating; elo = modelElo + adjust */
  modelElo: number | null;
  /** an admin's correction on top of the model's rating */
  adjust: number;
}

/** A club list with ratings (one per game: FC26, FC27, …). New matches use the active one. */
export interface Season {
  id: number;
  name: string;
  active: boolean;
  /** the game whose cards rated the clubs (e.g. "FC27"); null for lists entered by hand */
  game: string | null;
  /** card-model settings used for the ratings (null: the defaults) */
  model: Record<string, unknown> | null;
  /** matches played with this season's clubs */
  matches: number;
  /** strongest first */
  clubs: Club[];
}

/**
 * Match row as returned by the API; teams are player names in the order they were entered. The club
 * ratings are the ones the match was played with, so later edits to a season never change history.
 */
export interface Match {
  id: number;
  time: string;
  season_id: number;
  club_a: string;
  club_b: string;
  club_a_elo: number;
  club_b_elo: number;
  /** the board's club weight when the match was entered */
  club_weight: number;
  team_a: string[] | null;
  team_b: string[] | null;
  score_a: number;
  score_b: number;
}

export interface NewMatch {
  clubA: string;
  clubB: string;
  teamA: string[];
  teamB: string[];
  scoreA: number;
  scoreB: number;
}

export interface StandingStats {
  wins: number;
  draws: number;
  losses: number;
  total_matches: number;
  win_percentage: number | null;
  goals_forwarded: number;
  goals_accepted: number;
  points: number;
}

export type PlayerStanding = StandingStats & { name: string };
export type ClubStanding = StandingStats & { club: string };
export type DuoStanding = StandingStats & { duo: string };

export type Role = "member" | "admin";

export interface BoardInfo {
  slug: string;
  name: string;
}

export interface BoardMe extends BoardInfo {
  role: Role;
  kFactor: number;
  /** how much a club's rating counts in a side's strength, for matches entered from now on */
  clubWeight: number;
}

/** What sign-in and board creation return. */
export interface SignIn extends BoardInfo {
  role: Role;
  token: string;
}

/** One match of the night's plan; matchId is set once it has been played. */
export interface PlannedMatch {
  slot: number;
  teamA: string[];
  teamB: string[];
  matchId: number | null;
  skipped: boolean;
}

/** The board's open plan for the night. */
export interface NightPlan {
  id: number;
  createdAt: string;
  rules: Record<string, unknown>;
  matches: PlannedMatch[];
}

export type Outcome = "W" | "D" | "L";
export type Side = "A" | "B";
