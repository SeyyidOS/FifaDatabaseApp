import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useT } from "../../hooks/useI18n";
import { signOutAccount, type AccountSession } from "../../lib/account";
import { accountApi, ApiError } from "../../lib/api";
import { defineMessages } from "../../lib/i18n";
import type { LeagueFate } from "../../lib/types";
import { ConfirmDialog } from "../ui/Dialog";

const m = defineMessages({
  en: {
    open: "Delete account",
    title: "Delete your account?",
    intro: "Your e-mail, name and photo are deleted and you're signed out on every device. This can't be undone.",
    stays: "Your player and matches stay in each league's history.",
    handover: "passes to {heir}",
    anAdmin: "another member",
    delete: "deleted with its matches: nobody else is in it",
    keep: "stays for those who open it with its password",
    leave: "you leave it",
    confirm: "Delete for good",
    deleted: "Your account was deleted",
  },
  tr: {
    open: "Hesabı sil",
    title: "Hesabın silinsin mi?",
    intro: "E-postan, adın ve fotoğrafın silinir, tüm cihazlarda oturumun kapanır. Bu geri alınamaz.",
    stays: "Oyuncun ve maçların liglerin geçmişinde kalır.",
    handover: "{heir} devralır",
    anAdmin: "başka bir üye",
    delete: "başka kimse olmadığı için maçlarıyla birlikte silinir",
    keep: "şifreyle girenler için kalır",
    leave: "ligden çıkarsın",
    confirm: "Kalıcı olarak sil",
    deleted: "Hesabın silindi",
  },
});

function Fate({ league }: { league: LeagueFate }) {
  const t = useT(m);
  const what =
    league.fate === "handover" ? t("handover", { heir: league.heir ?? t("anAdmin") }) : t(league.fate);
  return (
    <li>
      <span className="font-semibold text-fg">{league.name}</span>: {what}
    </li>
  );
}

/** Profile › edit: deleting the account, after saying what happens to each league. */
export function DeleteAccount({ account }: { account: AccountSession }) {
  const t = useT(m);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const leagues = useQuery({
    queryKey: ["account", "deletion"],
    queryFn: () => accountApi.deletion(account.token),
    enabled: open,
    staleTime: 0,
  });

  const remove = async () => {
    setBusy(true);
    try {
      await accountApi.deleteAccount(account.token);
      signOutAccount();
      navigate("/");
      toast.success(t("deleted"));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : String(err));
      setBusy(false);
    }
  };

  return (
    <>
      <button onClick={() => setOpen(true)} className="text-sm font-semibold text-muted hover:text-loss">
        {t("open")}
      </button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={remove}
        loading={busy || leagues.isLoading}
        title={t("title")}
        confirmLabel={t("confirm")}
        description={
          <div className="space-y-2">
            <p>{t("intro")}</p>
            {!!leagues.data?.length && (
              <ul className="list-disc space-y-1 pl-4">
                {leagues.data.map((league) => (
                  <Fate key={league.slug} league={league} />
                ))}
              </ul>
            )}
            <p>{t("stays")}</p>
          </div>
        }
      />
    </>
  );
}
