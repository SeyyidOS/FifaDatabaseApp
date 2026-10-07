export interface Player {
  id: number;
  name: string;
  /** Archived players left the roster; their matches still count. */
  archived: boolean;
}

export interface Club {
  id: number;
  name: string;
  tier: number;
  elo?: number | null;
}

/** Match row as returned by the API; teams are player names in the order they were entered. */
export interface Match {
  id: number;
  time: string;
  club_a: string;
  club_b: string;
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
}

/** What sign-in and board creation return. */
export interface SignIn extends BoardInfo {
  role: Role;
  token: string;
}

export type Outcome = "W" | "D" | "L";
export type Side = "A" | "B";
