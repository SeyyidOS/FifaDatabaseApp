import { createContext } from "react";
import type { BoardApi } from "../lib/api";
import type { Role } from "../lib/types";

export interface BoardContextValue {
  slug: string;
  name: string;
  role: Role;
  token: string;
  api: BoardApi;
  /** "/players" -> "/b/<slug>/players" */
  path: (to?: string) => string;
}

export const BoardContext = createContext<BoardContextValue | null>(null);
