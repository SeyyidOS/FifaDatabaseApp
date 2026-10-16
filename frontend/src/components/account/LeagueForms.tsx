import { useQueryClient } from "@tanstack/react-query";
import { motion } from "motion/react";
import { ArrowRight, Link2, Mail, Plus } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useT } from "../../hooks/useI18n";
import type { AccountSession } from "../../lib/account";
import { accountApi, ApiError } from "../../lib/api";
import { defineMessages } from "../../lib/i18n";
import { linkTarget } from "../../lib/links";
import { saveSession } from "../../lib/session";
import { Field, TextInput } from "../ui/form";
import { Button } from "../ui/primitives";

const m = defineMessages({
  en: {
    getIn: "Get in",
    getInText: "No password: we e-mail you a code. Your first sign-in makes your account.",
    signIn: "Sign in with e-mail",
    toStart: "Sign in to start a league, too.",
    haveInvite: "Got an invite link?",
    inviteLabel: "Invite link",
    invitePlaceholder: "Paste the link you were sent",
    open: "Open",
    notInvite: "That isn't an invite link",
    leagueName: "League name",
    namePlaceholder: "e.g. Friday Night League",
    newHint: "No passwords: you invite people with links, and they come in with their own account.",
    start: "Start the league",
    ready: "{name} is ready",
    failed: "Couldn't start the league",
  },
  tr: {
    getIn: "Ligine gir",
    getInText: "Şifre yok: e-postana bir kod gelir. Hesabın ilk girişte açılır.",
    signIn: "E-postayla giriş yap",
    toStart: "Lig kurmak için de giriş yap.",
    haveInvite: "Davet linkin mi var?",
    inviteLabel: "Davet linki",
    invitePlaceholder: "Sana gelen linki yapıştır",
    open: "Aç",
    notInvite: "Bu bir davet linki değil",
    leagueName: "Lig adı",
    namePlaceholder: "ör. Cuma Gecesi Ligi",
    newHint: "Şifre yok: insanları linkle davet edersin, kendi hesaplarıyla girerler.",
    start: "Ligi kur",
    ready: "{name} hazır",
    failed: "Lig kurulamadı",
  },
});

export function InviteLinkForm({ autoFocus }: { autoFocus?: boolean }) {
  const t = useT(m);
  const navigate = useNavigate();
  const [link, setLink] = useState("");
  const [error, setError] = useState<string | null>(null);
  const open = (e: FormEvent) => {
    e.preventDefault();
    const to = linkTarget(link);
    if (to) navigate(to);
    else setError(t("notInvite"));
  };
  return (
    <form onSubmit={open} className="space-y-3">
      <Field label={t("inviteLabel")} htmlFor="invite-link" error={error}>
        <div className="flex gap-2">
          <TextInput
            id="invite-link"
            autoFocus={autoFocus}
            value={link}
            onChange={(e) => {
              setLink(e.target.value);
              setError(null);
            }}
            placeholder={t("invitePlaceholder")}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
          <Button type="submit" variant="secondary" className="h-11 shrink-0" disabled={!link.trim()}>
            {t("open")}
          </Button>
        </div>
      </Field>
    </form>
  );
}

/** The home page's way in while signed out (accounts on): sign in, or open an invite. */
export function SignedOutForms() {
  const t = useT(m);
  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.08 }}
      className="card space-y-6 p-6 sm:p-8"
    >
      <div className="space-y-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Mail className="size-5 text-accent-text" />
          {t("getIn")}
        </h2>
        <p className="text-sm text-muted">{t("getInText")}</p>
        <Link to="/signin" className="accent-gem flex h-12 items-center justify-center gap-2 rounded-xl font-bold">
          {t("signIn")} <ArrowRight className="size-4" />
        </Link>
        <p className="text-center text-xs text-faint">{t("toStart")}</p>
      </div>
      <div className="space-y-3 border-t border-line pt-5">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <Link2 className="size-4 text-accent-text" />
          {t("haveInvite")}
        </p>
        <InviteLinkForm />
      </div>
    </motion.section>
  );
}

export function NewLeagueForm({ account }: { account: AccountSession }) {
  const t = useT(m);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) return;
    setBusy(true);
    try {
      const signIn = await accountApi.createLeague(account.token, name.trim());
      // opened with the account: signing out of it closes the league here too
      saveSession(signIn, true, account.user.id);
      await queryClient.invalidateQueries({ queryKey: ["auth-boards"] });
      toast.success(t("ready", { name: signIn.name }));
      navigate(`/b/${signIn.slug}/settings?welcome=1`);
    } catch (err) {
      toast.error(t("failed"), { description: err instanceof ApiError ? err.message : String(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label={t("leagueName")} htmlFor="league-name" hint={t("newHint")}>
        <TextInput
          id="league-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("namePlaceholder")}
          maxLength={60}
        />
      </Field>
      <Button type="submit" variant="primary" size="lg" className="w-full" loading={busy} disabled={name.trim().length < 2}>
        <Plus className="size-4" /> {t("start")}
      </Button>
    </form>
  );
}
