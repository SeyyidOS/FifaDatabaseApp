import { useMemo, type ReactNode } from "react";
import { INITIAL_ELO, runElo } from "../lib/elo";
import { cleanName } from "../lib/format";
import { computePlayerStats, computeRecords, groupMatchdays, parseMatches } from "../lib/stats";
import {
  AnalyticsContext,
  PROVISIONAL_GAMES,
  type Analytics,
  type AnalyticsState,
  type RankedPlayer,
} from "./analytics-context";
import { useClubs, useEloSettings, useMatches, usePlayers } from "./useData";

export function AnalyticsProvider({ children }: { children: ReactNode }) {
  const players = usePlayers();
  const clubs = useClubs();
  const matches = useMatches();
  const settings = useEloSettings();

  const data = useMemo<Analytics | null>(() => {
    if (!players.data || !clubs.data || !matches.data || !settings.data) return null;
    const k = settings.data.kFactor ?? 24;
    const parsed = parseMatches(matches.data);
    const engine = runElo(players.data, clubs.data, matches.data, k);
    const stats = computePlayerStats(parsed);
    const matchdays = groupMatchdays(parsed);

    // Ratings before the latest matchday → rank movement and Elo swing.
    const lastDay = matchdays[0]?.key;
    const before = lastDay
      ? runElo(
          players.data,
          clubs.data,
          matches.data.filter((m) => !matchdays[0].matches.some((x) => x.id === m.id)),
          k,
        )
      : engine;

    const order = (ratings: Map<number, number>) =>
      [...players.data]
        .sort((a, b) => (ratings.get(b.id) ?? INITIAL_ELO) - (ratings.get(a.id) ?? INITIAL_ELO))
        .map((p) => p.id);
    const prevRank = new Map(order(before.ratings).map((id, i) => [id, i + 1]));

    const ranking: RankedPlayer[] = order(engine.ratings).map((id, i) => {
      const p = players.data.find((x) => x.id === id)!;
      const elo = Math.round(engine.ratings.get(id) ?? INITIAL_ELO);
      const history = engine.history.get(id) ?? [];
      const s = stats.get(cleanName(p.name));
      return {
        id,
        name: p.name,
        elo,
        rank: i + 1,
        rankDelta: (prevRank.get(id) ?? i + 1) - (i + 1),
        eloDelta: elo - Math.round(before.ratings.get(id) ?? INITIAL_ELO),
        peak: Math.round(Math.max(INITIAL_ELO, ...history.map((h) => h.elo))),
        provisional: (s?.played ?? 0) < PROVISIONAL_GAMES,
        history,
        stats: s,
      };
    });

    return {
      players: players.data,
      clubs: clubs.data,
      matches: matches.data,
      parsed,
      engine,
      stats,
      ranking,
      byName: new Map(ranking.map((r) => [cleanName(r.name), r])),
      eloByName: new Map(ranking.map((r) => [cleanName(r.name), r.elo])),
      matchdays,
      records: computeRecords(parsed, stats),
      k,
    };
  }, [players.data, clubs.data, matches.data, settings.data]);

  const value: AnalyticsState = {
    data,
    isLoading: !data && (players.isLoading || clubs.isLoading || matches.isLoading || settings.isLoading),
    error: (players.error || clubs.error || matches.error || settings.error) as Error | null,
    refetch: () => {
      players.refetch();
      clubs.refetch();
      matches.refetch();
      settings.refetch();
    },
  };

  return <AnalyticsContext.Provider value={value}>{children}</AnalyticsContext.Provider>;
}
