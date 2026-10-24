import type { CardSet } from "./clubModel";
import { EDITION } from "./edition";
import { removeSession } from "./session";
import type {
  Account,
  BoardPublic,
  BoardInvites,
  BoardMembers,
  InvitePreview,
  LeagueFate,
  Membership,
  BoardMe,
  Club,
  ClubStanding,
  DuoStanding,
  Match,
  MatchPhoto,
  MatchStats,
  NewMatch,
  LiveMatch,
  NightPlan,
  Player,
  PlayerStanding,
  Season,
  SideStats,
  SignIn,
} from "./types";
import { defineMessages, translator, type Lang } from "./i18n";
import { siteUrl } from "./links";

const messages = defineMessages({
  en: { offline: "Can't reach the server. Check your connection." },
  tr: { offline: "Sunucuya ulaşılamıyor. Bağlantını kontrol et." },
});

export const API_URL = (import.meta.env.VITE_API_URL ?? "/api").replace(/\/$/, "");

/** Where an account's photo is served (backend/avatars.py); the name changes with every new photo. */
export const photoUrl = (name: string) => `${API_URL}/avatars/${encodeURIComponent(name)}`;

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  token?: string,
  read: (res: Response) => Promise<T> = (res) => res.json(),
): Promise<T> {
  const headers: Record<string, string> = {};
  // a Blob (a photo) is sent as itself, with its own type
  if (init.body && !(init.body instanceof Blob)) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  // the store edition says so on every request, so the API never answers it with classic content
  if (EDITION === "store") headers["X-Edition"] = "store";
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { ...init, headers });
  } catch {
    throw new ApiError(0, translator(messages)("offline"));
  }
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      if (typeof body?.detail === "string") detail = body.detail;
      // FastAPI validation errors: [{ loc: [...], msg: "..." }, ...]
      else if (Array.isArray(body?.detail))
        detail = body.detail.map((d: { msg?: string }) => d.msg?.replace(/^Value error, /, "")).join("; ");
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(res.status, detail || `Request failed (${res.status})`);
  }
  return read(res);
}

const json = (method: string, body?: unknown): RequestInit => ({
  method,
  body: body === undefined ? undefined : JSON.stringify(body),
});

/** Endpoints that need no sign-in. */
export const publicApi = {
  /** "version" is the short commit hash that is live */
  health: () => request<{ ok: boolean; version: string }>("/health"),
  board: (slug: string) => request<BoardPublic>(`/boards/${encodeURIComponent(slug)}`),
  /** A board with passwords (accounts off; with them on, accountApi.createLeague). */
  createBoard: (body: { name: string; password: string; adminPassword: string }) =>
    request<SignIn>("/boards", json("POST", body)),
  signIn: (slug: string, password: string) =>
    request<SignIn>(`/boards/${encodeURIComponent(slug)}/login`, json("POST", { password })),
};

export type BoardApi = ReturnType<typeof boardApi>;

/** A match to start (backend/live.py): `replaces` one being played, `force` past a busy player. */
export interface NewLiveMatch {
  teamA: string[];
  teamB: string[];
  clubA: string;
  clubB: string;
  replaces?: number;
  force?: boolean;
  startedAt?: string;
}

/** Endpoints of one board, called with this device's token for it. */
export function boardApi(slug: string, token: string) {
  const base = `/boards/${encodeURIComponent(slug)}`;
  const call = async <T>(path: string, init?: RequestInit, read?: (res: Response) => Promise<T>): Promise<T> => {
    try {
      return await request<T>(`${base}${path}`, init, token, read);
    } catch (e) {
      // a rejected token (password changed, board gone) means signing in again
      if (e instanceof ApiError && e.status === 401) removeSession(slug, token);
      throw e;
    }
  };
  return {
    me: () => call<BoardMe>("/me"),
    update: (changes: { name?: string; kFactor?: number; clubWeight?: number; password?: string; adminPassword?: string }) =>
      call<BoardMe & { token?: string }>("", json("PATCH", changes)),

    players: () => call<Player[]>("/players"),
    addPlayer: (name: string) => call<Player>("/players", json("POST", { name })),
    updatePlayer: (id: number, changes: { name?: string; archived?: boolean }) =>
      call<Player>(`/players/${id}`, json("PATCH", changes)),
    deletePlayer: (id: number) => call<{ message: string }>(`/players/${id}`, json("DELETE")),

    matches: () => call<Match[]>("/matches"),
    addMatch: (match: NewMatch) => call<{ message: string; id: number }>("/matches", json("POST", match)),
    deleteMatch: (id: number) => call<{ message: string }>(`/matches/${id}`, json("DELETE")),
    fixScore: (id: number, scoreA: number, scoreB: number) =>
      call<{ scoreA: number; scoreB: number }>(`/matches/${id}`, json("PATCH", { scoreA, scoreB })),
    /** `ai`: the uploader agreed to have the stats read by the AI service; otherwise it's only kept */
    addPhoto: (matchId: number, image: Blob, ai: boolean) =>
      call<MatchPhoto>(`/matches/${matchId}/photos${ai ? "?ai=true" : ""}`, { method: "POST", body: image }),
    /** the image itself; it needs this device's token, so it can't be a plain <img src> */
    photo: (id: number, size: "full" | "thumb") => call<Blob>(`/photos/${id}?size=${size}`, {}, (res) => res.blob()),
    deletePhoto: (id: number) => call<{ message: string }>(`/photos/${id}`, json("DELETE")),
    saveStats: (matchId: number, stats: { A: SideStats; B: SideStats; photoId?: number | null; source?: "ocr" | "manual" }) =>
      call<MatchStats>(`/matches/${matchId}/stats`, json("PUT", stats)),
    deleteStats: (matchId: number) => call<{ message: string }>(`/matches/${matchId}/stats`, json("DELETE")),

    seasons: () => call<Season[]>("/seasons"),
    createSeason: (body: { name: string; copyFrom?: number }) => call<Season>("/seasons", json("POST", body)),
    updateSeason: (id: number, changes: { name?: string; active?: true }) =>
      call<Season>(`/seasons/${id}`, json("PATCH", changes)),
    deleteSeason: (id: number) => call<{ message: string }>(`/seasons/${id}`, json("DELETE")),
    applyModel: (
      season: number,
      body: { game: string; model: object; clubs: { eaId: number; name: string; modelElo: number }[] },
    ) => call<Season>(`/seasons/${season}/model`, json("POST", body)),
    addClub: (season: number, club: { name: string; elo: number }) =>
      call<Club>(`/seasons/${season}/clubs`, json("POST", club)),
    updateClub: (season: number, id: number, changes: { name?: string; elo?: number }) =>
      call<Club>(`/seasons/${season}/clubs/${id}`, json("PATCH", changes)),
    deleteClub: (season: number, id: number) =>
      call<{ message: string }>(`/seasons/${season}/clubs/${id}`, json("DELETE")),

    // a game's cards and their faces (backend/games.py): for signed-in boards only, never public files
    cards: (game: string) => call<CardSet>(`/games/${encodeURIComponent(game.toLowerCase())}/cards`),
    cardFace: (game: string, id: number) =>
      call<Blob>(`/games/${encodeURIComponent(game.toLowerCase())}/faces/${id}`, {}, (res) => res.blob()),
    live: () => call<LiveMatch[]>("/live"),
    startLive: (body: NewLiveMatch) => call<LiveMatch>("/live", json("POST", body)),
    cancelLive: (id: number) => call<{ cancelled: number }>(`/live/${id}`, json("DELETE")),
    plan: () => call<NightPlan | null>("/fixture"),
    savePlan: (body: { rules: object; matches: { teamA: string[]; teamB: string[] }[] }) =>
      call<NightPlan>("/fixture", json("PUT", body)),
    closePlan: () => call<{ message: string }>("/fixture", json("DELETE")),
    skipPlanned: (slot: number, skipped: boolean) => call<NightPlan>(`/fixture/matches/${slot}`, json("PATCH", { skipped })),

    leaderboard: {
      players: (start: string) => call<PlayerStanding[]>(`/leaderboard/players?start_time=${start}`),
      clubs: (start: string) => call<ClubStanding[]>(`/leaderboard/clubs?start_time=${start}`),
      duos: (start: string) => call<DuoStanding[]>(`/leaderboard/duos?start_time=${start}`),
    },
  };
}

/** Accounts: sign in with a link sent to an e-mail address. Off unless the server says otherwise. */
export const accountApi = {
  config: () => request<{ accounts: boolean }>("/auth/config"),
  requestLink: (email: string, lang: Lang) => request<{ sent: boolean }>("/auth/email", json("POST", { email, lang })),
  verify: (token: string) => request<{ token: string; user: Account }>("/auth/email/verify", json("POST", { token })),
  /** The six-digit code from the same e-mail, typed where the sign-in began. */
  verifyCode: (email: string, code: string) =>
    request<{ token: string; user: Account }>("/auth/email/code", json("POST", { email, code })),
  /** With `renewed`, a fresh token to keep: the one sent was getting old. */
  me: (token: string) => request<Account & { renewed?: string }>("/auth/me", {}, token),
  /** A square photo (the app crops it) for the account and, wherever it plays, its player. */
  setPhoto: (token: string, image: Blob) => request<Account>("/auth/me/photo", { method: "PUT", body: image }, token),
  removePhoto: (token: string) => request<Account>("/auth/me/photo", json("DELETE"), token),
  /** Mails a link to the new address; opening it moves the account there (confirmEmail). */
  changeEmail: (token: string, email: string, lang: Lang) =>
    request<{ sent: boolean }>("/auth/me/email", json("POST", { email, lang }), token),
  confirmEmail: (linkToken: string) =>
    request<{ token: string; user: Account }>("/auth/me/email/verify", json("POST", { token: linkToken })),
  /** A league owned by the account, with no passwords: people come in with invites. */
  createLeague: (token: string, name: string) => request<SignIn>("/boards", json("POST", { name }), token),
  rename: (token: string, name: string) => request<Account>("/auth/me", json("PATCH", { name }), token),
  /** What deleting the account would do to each of its leagues. */
  deletion: (token: string) => request<LeagueFate[]>("/auth/me/deletion", {}, token),
  deleteAccount: (token: string) => request<void>("/auth/me", json("DELETE"), token, async () => undefined),
  boards: (token: string) => request<Membership[]>("/auth/boards", {}, token),
  /** A board token for a board the account is a member of. */
  session: (token: string, slug: string) => request<SignIn>(`/boards/${encodeURIComponent(slug)}/session`, json("POST"), token),
  linkPlayer: (token: string, slug: string, playerId: number | null) =>
    request<{ playerId: number | null }>(`/boards/${encodeURIComponent(slug)}/membership/player`, json("PUT", { playerId }), token),

  // owners and admins
  invites: (token: string, slug: string) => request<BoardInvites>(`/boards/${encodeURIComponent(slug)}/invites`, {}, token),
  /** a personal link for a player, or (no player) the group link */
  invite: (token: string, slug: string, playerId?: number) =>
    request<{ kind: string; code: string }>(`/boards/${encodeURIComponent(slug)}/invites`, json("POST", { playerId }), token),
  resetGroupInvite: (token: string, slug: string) =>
    request<{ kind: string; code: string }>(`/boards/${encodeURIComponent(slug)}/invites/group/reset`, json("POST"), token),
  members: (token: string, slug: string) => request<BoardMembers>(`/boards/${encodeURIComponent(slug)}/members`, {}, token),
  approve: (token: string, slug: string, id: number) =>
    request<{ playerId: number }>(`/boards/${encodeURIComponent(slug)}/requests/${id}/approve`, json("POST"), token),
  reject: (token: string, slug: string, id: number) =>
    request<{ rejected: boolean }>(`/boards/${encodeURIComponent(slug)}/requests/${id}/reject`, json("POST"), token),
  setRole: (token: string, slug: string, userId: number, role: "admin" | "player") =>
    request<{ role: string }>(`/boards/${encodeURIComponent(slug)}/members/${userId}`, json("PATCH", { role }), token),
  removeMember: (token: string, slug: string, userId: number) =>
    request<{ removed: boolean }>(`/boards/${encodeURIComponent(slug)}/members/${userId}`, json("DELETE"), token),
  /** The owner hands the board over and stays on as an admin. */
  handOver: (token: string, slug: string, userId: number) =>
    request<{ owner: number }>(`/boards/${encodeURIComponent(slug)}/members/${userId}/owner`, json("POST"), token),

  // people with a link
  preview: (code: string) => request<InvitePreview>(`/invites/${encodeURIComponent(code)}`),
  accept: (token: string, code: string, body: { playerId?: number; newName?: string }) =>
    request<{ slug: string; status: "joined" | "requested" }>(`/invites/${encodeURIComponent(code)}/accept`, json("POST", body), token),
};

/** The address of an invite link, on whatever host the app is served from. */
export const inviteLink = (code: string) => `${siteUrl()}#/join/${code}`;
