import { useQuery } from "@tanstack/react-query";
import type { Membership } from "../lib/types";
import { useEffect, useMemo, useSyncExternalStore } from "react";
import { useSessions } from "./useBoard";
import { getAccount, saveAccount, signOutAccount, subscribeAccount } from "../lib/account";
import { accountApi, ApiError } from "../lib/api";

/** The account signed in on this device, if any. */
export const useAccount = () => useSyncExternalStore(subscribeAccount, getAccount, getAccount);

/** Whether this server offers accounts: undefined until it has said (for pages that look different either way). */
export function useAccountsConfig(): boolean | undefined {
  const config = useQuery({ queryKey: ["auth-config"], queryFn: accountApi.config, staleTime: 5 * 60_000, retry: false });
  return config.isError ? false : config.data?.accounts;
}

/** Whether this server offers accounts at all; until it says yes, nothing about them shows. */
export function useAccountsEnabled() {
  return useAccountsConfig() === true;
}

/** Someone is signed in and the server offers accounts (a league then shows the account menu). */
export function useShowsAccount() {
  const enabled = useAccountsEnabled();
  const account = useAccount();
  return enabled && !!account;
}

/**
 * Keeps this device's copy of the account (name, photo, e-mail) as the server has it, since another device
 * may have changed it; a token the server no longer takes signs this device out.
 */
export function useAccountSync() {
  const enabled = useAccountsEnabled();
  const account = useAccount();
  const me = useQuery({
    queryKey: ["auth-me", account?.user.id],
    queryFn: () => accountApi.me(account!.token),
    enabled: enabled && !!account,
    staleTime: 5 * 60_000,
    retry: false,
  });
  useEffect(() => {
    const current = getAccount();
    if (me.data && current?.user.id === me.data.id && JSON.stringify(me.data) !== JSON.stringify(current.user))
      saveAccount({ token: current.token, user: me.data });
  }, [me.data]);
  useEffect(() => {
    if (me.error instanceof ApiError && me.error.status === 401) signOutAccount();
  }, [me.error]);
}

/** The boards the signed-in account is a member of (empty when signed out or accounts are off). */
export function useMemberships() {
  const enabled = useAccountsEnabled();
  const account = useAccount();
  return useQuery<Membership[]>({
    queryKey: ["auth-boards", account?.user.id],
    queryFn: () => accountApi.boards(account!.token),
    enabled: enabled && !!account,
    // owners and admins see join requests come in (the Settings badge) without reloading
    refetchInterval: (query) => (query.state.data?.some((mb) => mb.role !== "player") ? 60_000 : false),
  });
}

/** The leagues to switch between: the account's (once accounts are on), then boards this device opened with a password. */
export function useLeagues(): { slug: string; name: string }[] {
  const memberships = useMemberships().data;
  const sessions = useSessions();
  return useMemo(() => {
    const mine = (memberships ?? []).map((mb) => ({ slug: mb.slug, name: mb.name }));
    return [...mine, ...sessions.filter((s) => !mine.some((mb) => mb.slug === s.slug)).map((s) => ({ slug: s.slug, name: s.name }))];
  }, [memberships, sessions]);
}

/** Join requests waiting for this person in a board they own or run (0 otherwise). */
export function usePending(slug: string) {
  return useMemberships().data?.find((mb) => mb.slug === slug)?.pending ?? 0;
}
