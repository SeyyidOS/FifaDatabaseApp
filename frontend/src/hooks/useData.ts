import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { updateSession } from "../lib/session";
import type { NewMatch } from "../lib/types";
import { useBoard } from "./useBoard";

/** Every query of a board starts with ["board", slug], so a board can be refreshed or dropped at once. */
const boardKey = (slug: string, ...rest: unknown[]) => ["board", slug, ...rest];

export function useMe() {
  const { slug, api } = useBoard();
  return useQuery({ queryKey: boardKey(slug, "me"), queryFn: api.me });
}

export function usePlayers() {
  const { slug, api } = useBoard();
  return useQuery({ queryKey: boardKey(slug, "players"), queryFn: api.players });
}

export function useSeasons() {
  const { slug, api } = useBoard();
  return useQuery({ queryKey: boardKey(slug, "seasons"), queryFn: api.seasons });
}

export function useMatches() {
  const { slug, api } = useBoard();
  return useQuery({ queryKey: boardKey(slug, "matches"), queryFn: api.matches });
}

export function usePlayerStandings(start: string) {
  const { slug, api } = useBoard();
  return useQuery({
    queryKey: boardKey(slug, "leaderboard", "players", start),
    queryFn: () => api.leaderboard.players(start),
    placeholderData: (prev) => prev,
  });
}

export function useClubStandings(start: string) {
  const { slug, api } = useBoard();
  return useQuery({
    queryKey: boardKey(slug, "leaderboard", "clubs", start),
    queryFn: () => api.leaderboard.clubs(start),
    placeholderData: (prev) => prev,
  });
}

export function useDuoStandings(start: string) {
  const { slug, api } = useBoard();
  return useQuery({
    queryKey: boardKey(slug, "leaderboard", "duos", start),
    queryFn: () => api.leaderboard.duos(start),
    placeholderData: (prev) => prev,
  });
}

/** A mutation that refreshes the given parts of the current board when it succeeds. */
function useBoardMutation<A, R>(fn: (args: A) => Promise<R>, refresh: string[]) {
  const { slug } = useBoard();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () =>
      Promise.all(refresh.map((part) => qc.invalidateQueries({ queryKey: boardKey(slug, part) }))),
  });
}

export function useAddPlayer() {
  const { api } = useBoard();
  return useBoardMutation((name: string) => api.addPlayer(name), ["players"]);
}

export function useUpdatePlayer() {
  const { api } = useBoard();
  return useBoardMutation(
    ({ id, ...changes }: { id: number; name?: string; archived?: boolean }) => api.updatePlayer(id, changes),
    ["players", "matches", "leaderboard"],
  );
}

export function useDeletePlayer() {
  const { api } = useBoard();
  return useBoardMutation((id: number) => api.deletePlayer(id), ["players", "leaderboard"]);
}

export function useAddMatch() {
  const { api } = useBoard();
  return useBoardMutation((m: NewMatch) => api.addMatch(m), ["matches", "leaderboard", "seasons"]);
}

export function useDeleteMatch() {
  const { api } = useBoard();
  return useBoardMutation((id: number) => api.deleteMatch(id), ["matches", "leaderboard", "seasons"]);
}

export function useCreateSeason() {
  const { api } = useBoard();
  return useBoardMutation((body: { name: string; copyFrom?: number }) => api.createSeason(body), ["seasons"]);
}

export function useUpdateSeason() {
  const { api } = useBoard();
  return useBoardMutation(
    ({ id, ...changes }: { id: number; name?: string; active?: true }) => api.updateSeason(id, changes),
    ["seasons"],
  );
}

export function useDeleteSeason() {
  const { api } = useBoard();
  return useBoardMutation((id: number) => api.deleteSeason(id), ["seasons"]);
}

/** Club edits only touch the season's list: matches keep the ratings they were played with. */
export function useAddClub() {
  const { api } = useBoard();
  return useBoardMutation(
    ({ season, ...club }: { season: number; name: string; elo: number }) => api.addClub(season, club),
    ["seasons"],
  );
}

export function useUpdateClub() {
  const { api } = useBoard();
  return useBoardMutation(
    ({ season, id, ...changes }: { season: number; id: number; name?: string; elo?: number }) =>
      api.updateClub(season, id, changes),
    ["seasons"],
  );
}

export function useDeleteClub() {
  const { api } = useBoard();
  return useBoardMutation(
    ({ season, id }: { season: number; id: number }) => api.deleteClub(season, id),
    ["seasons"],
  );
}

export function useUpdateBoard() {
  const { slug, api } = useBoard();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.update,
    onSuccess: (board) => {
      qc.setQueryData(boardKey(slug, "me"), { ...board, token: undefined });
      // a new admin password re-issues our token; a rename changes the label on this device
      updateSession(slug, { name: board.name, ...(board.token ? { token: board.token } : {}) });
    },
  });
}
