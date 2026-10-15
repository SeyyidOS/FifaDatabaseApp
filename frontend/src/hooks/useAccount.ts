import { useQuery } from "@tanstack/react-query";
import type { Membership } from "../lib/types";
import { useSyncExternalStore } from "react";
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
    staleTime: 60_000,
  });
}
