import { useQuery } from "@tanstack/react-query";
import type { Membership } from "../lib/types";
import { useMemo, useSyncExternalStore } from "react";
import { useSessions } from "./useBoard";
import { getAccount, subscribeAccount } from "../lib/account";
import { accountApi } from "../lib/api";

/** The account signed in on this device, if any. */
export const useAccount = () => useSyncExternalStore(subscribeAccount, getAccount, getAccount);

/** Whether this server offers accounts at all; until it says yes, nothing about them shows. */
export function useAccountsEnabled() {
  const config = useQuery({ queryKey: ["auth-config"], queryFn: accountApi.config, staleTime: 5 * 60_000, retry: false });
  return config.data?.accounts === true;
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
