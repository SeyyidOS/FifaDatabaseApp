import { createContext } from "react";

/** A league's player photos by player name (cleanName), so every Avatar of a player shows theirs. */
export const PlayerPhotosContext = createContext<Map<string, string> | null>(null);
