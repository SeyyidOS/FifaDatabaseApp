import { removeSession } from "./session";
import type {
  BoardInfo,
  BoardMe,
  Club,
  ClubStanding,
  DuoStanding,
  Match,
  NewMatch,
  NightPlan,
  Player,
  PlayerStanding,
  Season,
  SignIn,
} from "./types";
import { defineMessages, translator } from "./i18n";

const messages = defineMessages({
  en: { offline: "Can't reach the server. Check your connection." },
  tr: { offline: "Sunucuya ulaşılamıyor. Bağlantını kontrol et." },
});

export const API_URL = (import.meta.env.VITE_API_URL ?? "/api").replace(/\/$/, "");

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
  const headers: Record<string, string> = {};
  if (init.body) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
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
  return res.json() as Promise<T>;
}

const json = (method: string, body?: unknown): RequestInit => ({
  method,
  body: body === undefined ? undefined : JSON.stringify(body),
});

/** Endpoints that need no sign-in. */
export const publicApi = {
  /** "version" is the short commit hash that is live */
  health: () => request<{ ok: boolean; version: string }>("/health"),
  board: (slug: string) => request<BoardInfo>(`/boards/${encodeURIComponent(slug)}`),
  createBoard: (body: { name: string; password: string; adminPassword: string }) =>
    request<SignIn>("/boards", json("POST", body)),
  signIn: (slug: string, password: string) =>
    request<SignIn>(`/boards/${encodeURIComponent(slug)}/login`, json("POST", { password })),
};

export type BoardApi = ReturnType<typeof boardApi>;

/** Endpoints of one board, called with this device's token for it. */
export function boardApi(slug: string, token: string) {
  const base = `/boards/${encodeURIComponent(slug)}`;
  const call = async <T>(path: string, init?: RequestInit): Promise<T> => {
    try {
      return await request<T>(`${base}${path}`, init, token);
    } catch (e) {
      // a rejected token (password changed, board gone) means signing in again
      if (e instanceof ApiError && e.status === 401) removeSession(slug, token);
      throw e;
    }
  };
  return {
    me: () => call<BoardMe>("/me"),
    update: (changes: { name?: string; kFactor?: number; password?: string; adminPassword?: string }) =>
      call<BoardMe & { token?: string }>("", json("PATCH", changes)),

    players: () => call<Player[]>("/players"),
    addPlayer: (name: string) => call<Player>("/players", json("POST", { name })),
    updatePlayer: (id: number, changes: { name?: string; archived?: boolean }) =>
      call<Player>(`/players/${id}`, json("PATCH", changes)),
    deletePlayer: (id: number) => call<{ message: string }>(`/players/${id}`, json("DELETE")),

    matches: () => call<Match[]>("/matches"),
    addMatch: (match: NewMatch) => call<{ message: string; id: number }>("/matches", json("POST", match)),
    deleteMatch: (id: number) => call<{ message: string }>(`/matches/${id}`, json("DELETE")),

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
