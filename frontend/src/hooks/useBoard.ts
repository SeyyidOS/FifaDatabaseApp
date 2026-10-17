import { useContext, useSyncExternalStore } from "react";
import { listSessions, subscribeSessions } from "../lib/session";
import { BoardContext } from "./board-context";

export function useBoard() {
  const ctx = useContext(BoardContext);
  if (!ctx) throw new Error("useBoard must be used inside a board");
  return ctx;
}

/** Whether this device may change the board's data (log matches, add players, photos…): not a viewer. */
export const useCanEdit = () => useBoard().role !== "viewer";

/** Every board this device is signed in to, most recent first. */
export const useSessions = () => useSyncExternalStore(subscribeSessions, listSessions, listSessions);
