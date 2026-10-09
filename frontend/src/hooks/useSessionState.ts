import { useEffect, useState, type Dispatch, type SetStateAction } from "react";

/** useState that survives navigation/reloads within the tab (draft state). */
export function useSessionState<T>(key: string, initial: T): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = sessionStorage.getItem(key);
      if (raw !== null) return JSON.parse(raw) as T;
    } catch {
      /* storage unavailable or corrupt */
    }
    return initial;
  });
  useEffect(() => {
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* storage unavailable */
    }
  }, [key, value]);
  return [value, setValue];
}
