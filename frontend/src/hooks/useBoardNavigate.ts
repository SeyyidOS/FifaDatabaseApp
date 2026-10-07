import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useBoard } from "./useBoard";

/** navigate("/play") inside the current board. */
export function useBoardNavigate() {
  const navigate = useNavigate();
  const { path } = useBoard();
  return useCallback((to: string) => navigate(path(to)), [navigate, path]);
}
