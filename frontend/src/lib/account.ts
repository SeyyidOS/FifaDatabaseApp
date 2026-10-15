/**
 * The account signed in on this device (kept in localStorage), separate from the boards it is signed in to
 * with their passwords (session.ts).
 */
import { removeAccountSessions } from "./session";
import type { Account } from "./types";

export interface AccountSession {
  token: string;
  user: Account;
}

const KEY = "fm-account";
const listeners = new Set<() => void>();
let snapshot: AccountSession | null = null;
let snapshotRaw: string | null = null;

/** The signed-in account, or null (stable reference while nothing changes). */
export function getAccount(): AccountSession | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    /* storage blocked */
  }
  if (raw !== snapshotRaw) {
    snapshotRaw = raw;
    try {
      const value = raw ? JSON.parse(raw) : null;
      snapshot = value && typeof value.token === "string" && value.user ? value : null;
    } catch {
      snapshot = null;
    }
  }
  return snapshot;
}

function write(value: AccountSession | null) {
  try {
    if (value) localStorage.setItem(KEY, JSON.stringify(value));
    else localStorage.removeItem(KEY);
  } catch {
    /* storage full or blocked: the sign-in just won't persist */
  }
  listeners.forEach((l) => l());
}

export const saveAccount = (session: AccountSession) => write(session);

/** Signs the account out, and out of the boards this device opened with it. */
export function signOutAccount() {
  write(null);
  removeAccountSessions();
}

export function subscribeAccount(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => e.key === KEY && listener();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}
