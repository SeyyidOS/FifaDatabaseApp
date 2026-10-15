import { useQueryClient } from "@tanstack/react-query";
import { motion } from "motion/react";
import { ChevronRight } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { useSessions } from "../../hooks/useBoard";
import { useMemberships } from "../../hooks/useAccount";
import { useT } from "../../hooks/useI18n";
import { saveAccount, signOutAccount, type AccountSession } from "../../lib/account";
import { accountApi, ApiError } from "../../lib/api";
import { nameLang } from "../../lib/format";
import { defineMessages } from "../../lib/i18n";
import type { Membership } from "../../lib/types";
import { BoardForms } from "../board/BoardForms";
import { PasswordInput, TextInput } from "../ui/form";
import { Avatar } from "../ui/Identity";
import { Button, Pill } from "../ui/primitives";

const m = defineMessages({
  en: {
    rename: "Change name",
    yourName: "Your name",
    save: "Save",
    cancel: "Cancel",
    signOut: "Sign out",
    leagues: "My leagues",
    none: "No leagues yet. Start one or join one below.",
    owner: "Owner",
    admin: "Admin",
    player: "Player",
    standing: "#{rank} · {elo} Elo",
    newStanding: "New · {elo} Elo",
    noPlayer: "Open it and tap “That's me” on your profile",
    device: "On this device · not on your account yet",
    claim: "Make it mine",
    claimHint: "The board's admin password makes you its owner.",
    claimed: "The board is on your account",
  },
  tr: {
    rename: "Adı değiştir",
    yourName: "Adın",
    save: "Kaydet",
    cancel: "Vazgeç",
    signOut: "Çıkış yap",
    leagues: "Liglerim",
    none: "Henüz bir ligin yok. Aşağıdan kur ya da katıl.",
    owner: "Sahip",
    admin: "Yönetici",
    player: "Oyuncu",
    standing: "{rank}. sıra · {elo} Elo",
    newStanding: "Yeni · {elo} Elo",
    noPlayer: "Lige gir, profilinde “Bu benim” de",
    device: "Bu cihazda · henüz hesabında değil",
    claim: "Sahiplen",
    claimHint: "Board'un admin şifresi seni sahibi yapar.",
    claimed: "Board artık hesabında",
  },
});

function You({ account }: { account: AccountSession }) {
  const t = useT(m);
  const label = account.user.name || account.user.email;
  // a new account has no name yet: ask for it first
  const [editing, setEditing] = useState(!account.user.name);
  const [name, setName] = useState(account.user.name ?? "");
  const [busy, setBusy] = useState(false);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      saveAccount({ token: account.token, user: await accountApi.rename(account.token, name) });
      setEditing(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) signOutAccount();
      toast.error(err instanceof ApiError ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-4">
      <Avatar name={label} size="xl" className="ring-2 ring-team-b/70 ring-offset-4 ring-offset-bg" />
      <div className="min-w-0 flex-1">
        {editing ? (
          <form onSubmit={save} className="flex items-center gap-2">
            <TextInput
              autoFocus
              maxLength={40}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("yourName")}
              aria-label={t("yourName")}
            />
            <Button type="submit" variant="primary" loading={busy} disabled={!name.trim()}>
              {t("save")}
            </Button>
          </form>
        ) : (
          <h1 lang={nameLang(label)} className="display truncate text-4xl sm:text-5xl">
            {label}
          </h1>
        )}
        <div className="mt-2 flex gap-4 text-sm font-semibold text-muted">
          {account.user.name && (
            <button onClick={() => setEditing((e) => !e)} className="hover:text-fg">
              {editing ? t("cancel") : t("rename")}
            </button>
          )}
          <button onClick={signOutAccount} className="hover:text-fg">
            {t("signOut")}
          </button>
        </div>
      </div>
    </div>
  );
}

function LeagueRow({ membership: mb }: { membership: Membership }) {
  const t = useT(m);
  const p = mb.player;
  return (
    <Link to={`/b/${mb.slug}`} className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-surface-2">
      <Avatar name={mb.name} size="lg" className="rounded-2xl" />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate font-semibold">{mb.name}</span>
          <Pill tone={mb.role === "owner" ? "accent" : "neutral"}>{t(mb.role)}</Pill>
        </span>
        <span className="tabular mt-0.5 block truncate text-xs text-muted">
          {!p ? t("noPlayer") : p.rank ? t("standing", { rank: p.rank, elo: p.elo }) : t("newStanding", { elo: p.elo })}
        </span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-faint" />
    </Link>
  );
}

/** A board this device opened with its password; its admin password moves it onto the account. */
function DeviceRow({ slug, name, token }: { slug: string; name: string; token: string }) {
  const t = useT(m);
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const claim = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await accountApi.claim(token, slug, password);
      await queryClient.invalidateQueries({ queryKey: ["auth-boards"] });
      toast.success(t("claimed"));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="px-4 py-3.5">
      <div className="flex items-center gap-3">
        <Link to={`/b/${slug}`} className="flex min-w-0 flex-1 items-center gap-3">
          <Avatar name={name} size="lg" className="rounded-2xl opacity-80" />
          <span className="min-w-0">
            <span className="block truncate font-semibold">{name}</span>
            <span className="mt-0.5 block truncate text-xs text-muted">{t("device")}</span>
          </span>
        </Link>
        {!open && (
          <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
            {t("claim")}
          </Button>
        )}
      </div>
      {open && (
        <motion.form
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          onSubmit={claim}
          className="mt-3 space-y-2 overflow-hidden"
        >
          <p className="text-xs text-muted">{t("claimHint")}</p>
          <div className="flex gap-2">
            <div className="min-w-0 flex-1">
              <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" autoFocus />
            </div>
            <Button type="submit" variant="primary" loading={busy} disabled={!password}>
              {t("claim")}
            </Button>
          </div>
          {error && <p className="text-xs text-loss">{error}</p>}
        </motion.form>
      )}
    </div>
  );
}

/** Profilim: the signed-in person's home. Who you are, your leagues, and starting or joining one. */
export function AccountHome({ account }: { account: AccountSession }) {
  const t = useT(m);
  const memberships = useMemberships();
  const sessions = useSessions();
  const mine = memberships.data ?? [];
  // boards opened on this device with a password that the account isn't in yet
  const unlinked = memberships.data ? sessions.filter((s) => !mine.some((mb) => mb.slug === s.slug)) : [];

  return (
    <div className="mx-auto max-w-2xl space-y-8 py-4 sm:py-8">
      <You account={account} />
      <section>
        <p className="label mb-3">{t("leagues")}</p>
        <div className="card divide-y divide-line overflow-hidden">
          {mine.map((mb) => (
            <LeagueRow key={mb.slug} membership={mb} />
          ))}
          {unlinked.map((s) => (
            <DeviceRow key={s.slug} slug={s.slug} name={s.name} token={account.token} />
          ))}
          {memberships.isSuccess && !mine.length && !unlinked.length && (
            <p className="px-4 py-6 text-center text-sm text-muted">{t("none")}</p>
          )}
          {memberships.isLoading && <div className="skeleton m-4 h-14" />}
        </div>
      </section>
      <BoardForms />
    </div>
  );
}
