import { useContext, useSyncExternalStore } from "react";
import { listSessions, subscribeSessions } from "../lib/session";
import { BoardContext } from "./board-context";

export function useBoard() {
  const ctx = useContext(BoardContext);
  if (!ctx) throw new Error("useBoard must be used inside a board");
  return ctx;
}

/** Every board this device is signed in to, most recent first. */
export const useSessions = () => useSyncExternalStore(subscribeSessions, listSessions, listSessions);
