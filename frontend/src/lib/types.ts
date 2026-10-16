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
  /** IDs of the match's photos (e.g. the stats screens), oldest first */
  photos?: number[];
  /** numbers from the game's summary screen, if anyone entered or read them */
  stats?: MatchStats | null;
}

/** One side's numbers from the game's match summary ("Özet") screen; any of them may be missing. */
export interface SideStats {
  possession?: number;
  /** seconds to win the ball back */
  recoveryTime?: number;
  shots?: number;
  xg?: number;
  passes?: number;
  tackles?: number;
  tacklesWon?: number;
  interceptions?: number;
  saves?: number;
  fouls?: number;
  offsides?: number;
  corners?: number;
  freeKicks?: number;
  penalties?: number;
  yellowCards?: number;
  redCards?: number;
  dribbleSuccess?: number;
  shotAccuracy?: number;
  passAccuracy?: number;
}

/** A match's stats by the app's sides, whichever side the game showed as home. */
export interface MatchStats {
  A: SideStats;
  B: SideStats;
  source: "ocr" | "manual";
  /** the photo they were read from */
  photoId: number | null;
}

/** A photo stored with a match; the image itself comes from `BoardApi.photo`. */
export interface MatchPhoto {
  id: number;
  matchId: number;
  width: number;
  height: number;
  createdAt: string;
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

/** What the sign-in screen knows about a board: a password box, or invite-only (a league started with an account). */
export interface BoardPublic extends BoardInfo {
  passwordLogin: boolean;
}

export interface BoardMe extends BoardInfo {
  role: Role;
  kFactor: number;
  /** how much a club's rating counts in a side's strength, for matches entered from now on */
  clubWeight: number;
  /** false for a league started with an account: no passwords, people come in with invites */
  passwordLogin: boolean;
}

/** What sign-in and board creation return. */
export interface SignIn extends BoardInfo {
  role: Role;
  token: string;
}

/** An account's place in a board: its role and, once it said which, its player's standing there. */
export interface Membership {
  slug: string;
  name: string;
  role: "owner" | "admin" | "player";
  /** join requests waiting for an owner or admin (0 for players) */
  pending: number;
  player: { id: number; name: string; elo: number; rank: number; played: number } | null;
  /** the player this account asked to be (or the new one it asked to start as), until an owner or admin answers */
  asked: { name: string; new: boolean } | null;
}

/** What an invite link leads to, shown before signing in. */
export interface InvitePreview {
  kind: "personal" | "group";
  board: { name: string; players: number; matches: number };
  /** personal: the player it is for */
  player?: { id: number; name: string; elo: number; rank: number; played: number };
  /** group: the players nobody has claimed yet */
  players?: { id: number; name: string; played: number }[];
}

export interface BoardInvites {
  group: string | null;
  /** players without an account, with their personal link if one is out */
  players: { id: number; name: string; played: number; code: string | null }[];
}

export interface BoardMembers {
  members: { userId: number; name: string | null; role: Membership["role"]; player: { id: number; name: string } | null }[];
  requests: { id: number; name: string | null; email: string; player: { id: number; name: string } | null; newName: string | null }[];
}

/** A person who signs in with a link sent to their e-mail (not a board sign-in). */
export interface Account {
  id: number;
  email: string;
  name: string | null;
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
