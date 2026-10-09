import type { EloEngine, MatchElo } from "./elo";
import { outcomeFor, type Matchday, type ParsedMatch } from "./stats";

export const UPSET_THRESHOLD = 0.35;

/** The winner had less than a 35% chance going in. */
export function isUpset(m: ParsedMatch, elo?: MatchElo) {
  if (!elo || m.result === "D") return false;
  const winnerExp = m.result === "A" ? elo.expectedA : 1 - elo.expectedA;
  return winnerExp < UPSET_THRESHOLD;
}

export interface NightSummary {
  name: string;
  delta: number;
  played: number;
  wins: number;
}

/** Per-player Elo swing across one matchday, best first. */
export function nightSummary(day: Matchday, engine: EloEngine): NightSummary[] {
  const map = new Map<string, NightSummary>();
  for (const m of day.matches) {
    const e = engine.perMatch.get(m.id);
    if (!e) continue;
    for (const p of [...e.teamA, ...e.teamB]) {
      const key = p.name.toLowerCase();
      const s = map.get(key) ?? { name: p.name, delta: 0, played: 0, wins: 0 };
      s.delta += p.delta;
      s.played++;
      if (outcomeFor(m, key) === "W") s.wins++;
      map.set(key, s);
    }
  }
  return [...map.values()].sort((a, b) => b.delta - a.delta);
}

/** FUT-style overall rating derived from Elo. */
export const eloToOvr = (elo: number) => Math.max(45, Math.min(99, Math.round(70 + (elo - 1000) / 25)));
