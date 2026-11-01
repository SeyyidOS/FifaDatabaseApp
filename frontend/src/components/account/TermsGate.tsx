import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useAccount, useAccountsEnabled } from "../../hooks/useAccount";
import { useT } from "../../hooks/useI18n";
import { saveAccount, signOutAccount } from "../../lib/account";
import { accountApi, ApiError } from "../../lib/api";
import { defineMessages } from "../../lib/i18n";
import { Modal } from "../ui/Dialog";
import { Button } from "../ui/primitives";

const m = defineMessages({
  en: {
    title: "Before you go on",
    lead: "Matchnight is for friends. To use it, agree to the terms of use:",
    point1: "No offensive names or photos, and no harassing anyone.",
    point2: "Anyone can report a photo or a player; we look at reports within 24 hours.",
    point3: "What breaks the terms is removed, and the account behind it suspended.",
    read: "Read the terms",
    agree: "I agree",
    signOut: "Sign out",
  },
  tr: {
    title: "Devam etmeden önce",
    lead: "Matchnight arkadaşlar için. Kullanmak için kullanım koşullarını kabul et:",
    point1: "Uygunsuz isim ya da fotoğraf yok, kimseyi taciz etmek yok.",
    point2: "Herkes bir fotoğrafı ya da oyuncuyu bildirebilir; bildirimlere 24 saat içinde bakarız.",
    point3: "Koşullara aykırı olan kaldırılır, arkasındaki hesap askıya alınır.",
    read: "Koşulları oku",
    agree: "Kabul ediyorum",
    signOut: "Çıkış yap",
  },
});

// pages anyone may read before agreeing
const OPEN = ["/terms", "/privacy", "/support"];

/**
 * Asks a signed-in account, once, to agree to the terms of use (backend accounts.accept_terms), as App Review
 * asks of apps where people post. It waits for the server's word (an older copy of the account doesn't say),
 * and it can't be dismissed: agreeing or signing out are the ways on.
 */
export function TermsGate() {
  const t = useT(m);
  const enabled = useAccountsEnabled();
  const account = useAccount();
  const { pathname } = useLocation();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const open = enabled && account?.user.termsAccepted === false && !OPEN.includes(pathname);

  const agree = async () => {
    if (!account) return;
    setBusy(true);
    try {
      const user = await accountApi.acceptTerms(account.token);
      saveAccount({ token: account.token, user });
      // or the account sync puts back the copy from before
      await queryClient.invalidateQueries({ queryKey: ["auth-me"] });
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={() => {}} labelledBy="terms-title">
      <div className="flex gap-4">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent/12 text-accent-text ring-1 ring-accent/25">
          <ShieldCheck className="size-5" />
        </span>
        <div className="min-w-0">
          <h3 id="terms-title" className="font-semibold">
            {t("title")}
          </h3>
          <p className="mt-1.5 text-sm text-muted">{t("lead")}</p>
        </div>
      </div>
      <ul className="mt-4 space-y-2 text-sm text-muted">
        {(["point1", "point2", "point3"] as const).map((k) => (
          <li key={k} className="flex gap-2.5">
            <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-accent" />
            <span>{t(k)}</span>
          </li>
        ))}
      </ul>
      <Link to="/terms" className="mt-4 inline-block text-sm font-semibold text-accent-text hover:underline">
        {t("read")} →
      </Link>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="ghost" onClick={signOutAccount}>
          {t("signOut")}
        </Button>
        <Button variant="primary" onClick={agree} loading={busy}>
          {t("agree")}
        </Button>
      </div>
    </Modal>
  );
}
