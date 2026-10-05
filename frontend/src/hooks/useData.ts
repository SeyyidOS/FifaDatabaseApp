import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { NewMatch } from "../lib/types";

export const qk = {
  players: ["players"] as const,
  clubs: ["clubs"] as const,
  matches: ["matches"] as const,
  eloSettings: ["eloSettings"] as const,
  leaderboard: (kind: string, start: string) => ["leaderboard", kind, start] as const,
};

export const usePlayers = () => useQuery({ queryKey: qk.players, queryFn: api.players });
export const useClubs = () =>
  useQuery({ queryKey: qk.clubs, queryFn: api.clubs, staleTime: 5 * 60_000 });
export const useMatches = () => useQuery({ queryKey: qk.matches, queryFn: api.matches });
export const useEloSettings = () =>
  useQuery({ queryKey: qk.eloSettings, queryFn: api.eloSettings });

export const usePlayerStandings = (start: string) =>
  useQuery({
    queryKey: qk.leaderboard("players", start),
    queryFn: () => api.leaderboard.players(start),
    placeholderData: (prev) => prev,
  });
export const useClubStandings = (start: string) =>
  useQuery({
    queryKey: qk.leaderboard("clubs", start),
    queryFn: () => api.leaderboard.clubs(start),
    placeholderData: (prev) => prev,
  });
export const useDuoStandings = (start: string) =>
  useQuery({
    queryKey: qk.leaderboard("duos", start),
    queryFn: () => api.leaderboard.duos(start),
    placeholderData: (prev) => prev,
  });

function useInvalidate() {
  const qc = useQueryClient();
  return (...keys: (readonly string[])[]) =>
    Promise.all(keys.map((queryKey) => qc.invalidateQueries({ queryKey })));
}

export function useAddPlayer() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (name: string) => api.addPlayer(name),
    onSuccess: () => invalidate(qk.players),
  });
}

export function useAddMatch() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (m: NewMatch) => api.addMatch(m),
    onSuccess: () => invalidate(qk.matches, ["leaderboard"]),
  });
}

export function useDeletePlayer() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: number) => api.deletePlayer(id),
    onSuccess: () => invalidate(qk.players, ["leaderboard"]),
  });
}

export function useDeleteMatch() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: number) => api.deleteMatch(id),
    onSuccess: () => invalidate(qk.matches, ["leaderboard"]),
  });
}

export function useUpdateKFactor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (k: number) => api.updateKFactor(k),
    onSuccess: (data) => qc.setQueryData(qk.eloSettings, data),
  });
}
