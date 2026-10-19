import { useContext, useSyncExternalStore } from "react";
import { listSessions, subscribeSessions } from "../lib/session";
import type { ParsedMatch } from "../lib/stats";
import { BoardContext } from "./board-context";

export function useBoard() {
  const ctx = useContext(BoardContext);
  if (!ctx) throw new Error("useBoard must be used inside a board");
  return ctx;
}

/** Whether this device may change the board's data (log matches, add players, photos…): not a viewer. */
export const useCanEdit = () => useBoard().role !== "viewer";

/** How long after it is logged anyone on the board may fix a match (backend/board_data.py, FIX_WINDOW). */
export const FIX_MINUTES = 15;

/** Whether this device may fix a match's score or take it back: admins always, members for a while after it was logged. */
export function useCanFix(match: ParsedMatch) {
  const { role } = useBoard();
  if (role === "admin") return true;
  return role === "member" && Date.now() - match.date.getTime() < FIX_MINUTES * 60_000;
}

/** Every board this device is signed in to, most recent first. */
export const useSessions = () => useSyncExternalStore(subscribeSessions, listSessions, listSessions);
