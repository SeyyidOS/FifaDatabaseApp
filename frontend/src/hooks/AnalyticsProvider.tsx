import { useMemo, type ReactNode } from "react";
import { buildAppearances, duoProfiles, eloDna } from "../lib/analysis";
import { INITIAL_ELO, runElo } from "../lib/elo";
import { cleanName } from "../lib/format";
import { computePlayerStats, computeRecords, groupMatchdays, parseMatches } from "../lib/stats";
import type { Player } from "../lib/types";
import {
  AnalyticsContext,
  PROVISIONAL_GAMES,
  type Analytics,
  type AnalyticsState,
  type RankedPlayer,
} from "./analytics-context";
import { useClubs, useMatches, useMe, usePlayers } from "./useData";

export function AnalyticsProvider({ children }: { children: ReactNode }) {
  const players = usePlayers();
  const clubs = useClubs();
  const matches = useMatches();
  const settings = useMe();

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

    // archived players keep shaping everyone's history, but leave the rankings
    const active = players.data.filter((p) => !p.archived);
    const order = (ratings: Map<number, number>) =>
      [...active]
        .sort((a, b) => (ratings.get(b.id) ?? INITIAL_ELO) - (ratings.get(a.id) ?? INITIAL_ELO))
        .map((p) => p.id);
    const prevRank = new Map(order(before.ratings).map((id, i) => [id, i + 1]));

    const describe = (p: Player, rank: number): RankedPlayer => {
      const elo = Math.round(engine.ratings.get(p.id) ?? INITIAL_ELO);
      const history = engine.history.get(p.id) ?? [];
      const s = stats.get(cleanName(p.name));
      return {
        id: p.id,
        name: p.name,
        elo,
        rank,
        rankDelta: rank ? (prevRank.get(p.id) ?? rank) - rank : 0,
        eloDelta: elo - Math.round(before.ratings.get(p.id) ?? INITIAL_ELO),
        peak: Math.round(Math.max(INITIAL_ELO, ...history.map((h) => h.elo))),
        provisional: (s?.played ?? 0) < PROVISIONAL_GAMES,
        archived: p.archived,
        history,
        stats: s,
      };
    };
    const ranking = order(engine.ratings).map((id, i) => describe(players.data.find((x) => x.id === id)!, i + 1));
    // archived players are not ranked, but their profiles stay reachable from old matches
    const everyone = [...ranking, ...players.data.filter((p) => p.archived).map((p) => describe(p, 0))];

    const appearances = buildAppearances(parsed, engine);

    return {
      players: players.data,
      clubs: clubs.data,
      matches: matches.data,
      parsed,
      engine,
      stats,
      ranking,
      byName: new Map(everyone.map((r) => [cleanName(r.name), r])),
      eloByName: new Map(everyone.map((r) => [cleanName(r.name), r.elo])),
      matchdays,
      records: computeRecords(parsed, stats),
      appearances,
      dna: new Map([...appearances].map(([name, apps]) => [name, eloDna(apps)])),
      duos: duoProfiles(appearances),
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
