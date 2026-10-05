export interface Player {
  id: number;
  name: string;
}

export interface Club {
  id: number;
  name: string;
  tier: number;
  elo?: number | null;
}

/** Raw match row as returned by the API (teams are Postgres-array strings, e.g. "{kerem,seyyid}"). */
export interface Match {
  id: number;
  time: string;
  club_a: string;
  club_b: string;
  team_a: string;
  team_b: string;
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
export type ClubStanding = StandingStats & { team: string };
export type DuoStanding = StandingStats & { team_name: string };

export type Outcome = "W" | "D" | "L";
export type Side = "A" | "B";
