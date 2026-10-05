import type {
  Club,
  ClubStanding,
  DuoStanding,
  Match,
  NewMatch,
  Player,
  PlayerStanding,
} from "./types";

export const API_URL = (
  import.meta.env.VITE_API_URL ?? "https://fifadatabaseapp.onrender.com"
).replace(/\/$/, "");

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: init?.body
        ? { "Content-Type": "application/json", ...init.headers }
        : init?.headers,
    });
  } catch {
    throw new ApiError(0, "Can't reach the server. Check your connection.");
  }
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      if (typeof body?.detail === "string") detail = body.detail;
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

export const api = {
  players: () => request<Player[]>("/players"),
  clubs: () => request<Club[]>("/clubs"),
  matches: () => request<Match[]>("/matches"),
  elo: () =>
    request<{ ratings: { playerId: number; elo: number }[] }>("/elo"),
  eloSettings: () => request<{ kFactor: number }>("/settings/elo"),

  addPlayer: (name: string) =>
    request<{ message: string }>("/players", json("POST", { name })),
  addMatch: (match: NewMatch) =>
    request<{ message: string }>("/matches", json("POST", match)),
  updateKFactor: (kFactor: number) =>
    request<{ kFactor: number }>("/settings/elo", json("PUT", { kFactor })),
  deletePlayer: (id: number) =>
    request<{ message: string }>(`/admin/player/${id}`, json("DELETE")),
  deleteMatch: (id: number) =>
    request<{ message: string }>(`/admin/match/${id}`, json("DELETE")),

  leaderboard: {
    players: (start: string) =>
      request<PlayerStanding[]>(`/leaderboard/players?start_time=${start}`),
    clubs: (start: string) =>
      request<ClubStanding[]>(`/leaderboard/teams?start_time=${start}`),
    duos: (start: string) =>
      request<DuoStanding[]>(`/leaderboard/duos?start_time=${start}`),
  },
};
