import { useEffect, useState } from "react";
import { parseApiTime } from "../lib/format";

/** Whole minutes since a match started, kept current. */
export function useMinutesSince(startedAt: string) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  return Math.max(0, Math.floor((now - parseApiTime(startedAt).getTime()) / 60_000));
}
