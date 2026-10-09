/**
 * Board sign-ins kept on this device. "Remember this device" stores the token in localStorage
 * (it survives restarts); otherwise it lives in sessionStorage and is gone when the tab closes.
 */
import type { SignIn } from "./types";

export interface BoardSession extends SignIn {
  remember: boolean;
  savedAt: number;
}

const KEY = "fm-boards";
const listeners = new Set<() => void>();

function read(storage: Storage | undefined): BoardSession[] {
  try {
    const value = JSON.parse(storage?.getItem(KEY) ?? "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function write(storage: Storage | undefined, sessions: BoardSession[]) {
  try {
    storage?.setItem(KEY, JSON.stringify(sessions));
  } catch {
    /* storage full or blocked: the sign-in just won't persist */
  }
}

const local = () => (typeof localStorage === "undefined" ? undefined : localStorage);
const tab = () => (typeof sessionStorage === "undefined" ? undefined : sessionStorage);

let snapshot: BoardSession[] = [];
let snapshotKey = "";

/** All sign-ins on this device, most recent first (stable reference while nothing changes). */
export function listSessions(): BoardSession[] {
  const all = [...read(tab()), ...read(local()).filter((s) => !read(tab()).some((t) => t.slug === s.slug))].sort(
    (a, b) => b.savedAt - a.savedAt,
  );
  const key = JSON.stringify(all);
  if (key !== snapshotKey) {
    snapshotKey = key;
    snapshot = all;
  }
  return snapshot;
}

export const getSession = (slug: string) => listSessions().find((s) => s.slug === slug) ?? null;

export function subscribeSessions(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => e.key === KEY && listener();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

const notify = () => listeners.forEach((l) => l());

export function saveSession(signIn: SignIn, remember: boolean) {
  const session: BoardSession = { ...signIn, remember, savedAt: Date.now() };
  const [keep, drop] = remember ? [local(), tab()] : [tab(), local()];
  write(keep, [session, ...read(keep).filter((s) => s.slug !== signIn.slug)]);
  write(drop, read(drop).filter((s) => s.slug !== signIn.slug));
  notify();
}

export function updateSession(slug: string, changes: Partial<Pick<BoardSession, "name" | "token" | "role">>) {
  const current = getSession(slug);
  if (current) saveSession({ ...current, ...changes }, current.remember);
}

/** Forget a board on this device. With `token`, only if that is still the stored one. */
export function removeSession(slug: string, token?: string) {
  for (const storage of [local(), tab()]) {
    write(
      storage,
      read(storage).filter((s) => s.slug !== slug || (token !== undefined && s.token !== token)),
    );
  }
  notify();
}


