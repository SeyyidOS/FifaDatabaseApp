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
  /** opened with the signed-in account rather than the board password: signing out is the account's */
  viaAccount: boolean;
}

export const BoardContext = createContext<BoardContextValue | null>(null);
