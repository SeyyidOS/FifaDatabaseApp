import { useQueryClient } from "@tanstack/react-query";
import { motion } from "motion/react";
import { ChevronRight, MailCheck, UserCheck } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { useSessions } from "../../hooks/useBoard";
import { useMemberships } from "../../hooks/useAccount";
import { useLang, useT } from "../../hooks/useI18n";
import { saveAccount, signOutAccount, type AccountSession } from "../../lib/account";
import { accountApi, ApiError } from "../../lib/api";
import { cn } from "../../lib/cn";
import { displayName, nameLang } from "../../lib/format";
import { defineMessages } from "../../lib/i18n";
import type { Membership } from "../../lib/types";
import { PasswordInput, TextInput } from "../ui/form";
import { Avatar } from "../ui/Identity";
import { Button, Pill } from "../ui/primitives";
import { LeagueForms } from "./LeagueForms";

const m = defineMessages({
  en: {
    rename: "Change name",
    yourName: "Your name",
    save: "Save",
    cancel: "Cancel",
    signOut: "Sign out",
    changeEmail: "Change e-mail",
    newEmail: "New e-mail address",
    sendLink: "Send a link",
    emailSent: "We sent a link to {email}. Opening it moves your account there, leagues and all; until then you sign in with this address.",
    emailTaken: "That address already has an account",
    emailSame: "That's already your address",
    leagues: "My leagues",
    none: "No leagues yet. Start one or join one below.",
    owner: "Owner",
    admin: "Admin",
    player: "Player",
    standing: "#{rank} · {elo} Elo",
    newStanding: "New · {elo} Elo",
    noPlayer: "Open it and tap “That's me” on your profile",
    watching: "Not linked to a player",
    waiting: "Waiting",
    askedPlayer: "You said you're {name}; once it's confirmed, your matches are on your account",
    askedNew: "You asked to join as {name}",
    forYou: "Waiting for you",
    requests: "{n} join request|{n} join requests",
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
    changeEmail: "E-postayı değiştir",
    newEmail: "Yeni e-posta adresi",
    sendLink: "Link gönder",
    emailSent: "{email} adresine bir link gönderdik. Açınca hesabın, ligleriyle birlikte o adrese geçer; o zamana kadar bu adresle girmeye devam edersin.",
    emailTaken: "Bu adresin zaten bir hesabı var",
    emailSame: "Bu zaten senin adresin",
    leagues: "Liglerim",
    none: "Henüz bir ligin yok. Aşağıdan kur ya da katıl.",
    owner: "Sahip",
    admin: "Yönetici",
    player: "Oyuncu",
    standing: "{rank}. sıra · {elo} Elo",
    newStanding: "Yeni · {elo} Elo",
    noPlayer: "Lige gir, profilinde “Bu benim” de",
    watching: "Bir oyuncuya bağlı değilsin",
    waiting: "Onay bekliyor",
    askedPlayer: "Kendini {name} olarak seçtin; onaylanınca maçların hesabına bağlanır",
    askedNew: "{name} adıyla katılmak istedin",
    forYou: "Senden bekleyen",
    requests: "{n} katılma isteği|{n} katılma isteği",
    device: "Bu cihazda · henüz hesabında değil",
    claim: "Sahiplen",
    claimHint: "Board'un admin şifresi seni sahibi yapar.",
    claimed: "Board artık hesabında",
  },
});

/** Moving the account to another address: a link to that address, which does it once opened. */
function ChangeEmail({ account }: { account: AccountSession }) {
  const t = useT(m);
  const { lang } = useLang();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const send = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await accountApi.changeEmail(account.token, email.trim(), lang);
      setSent(email.trim());
    } catch (err) {
      const status = err instanceof ApiError ? err.status : 0;
      setError(status === 409 ? t("emailTaken") : status === 422 ? t("emailSame") : (err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (sent)
    return (
      <p className="flex gap-3 rounded-2xl border border-accent/30 bg-accent/[0.07] p-4 text-sm">
        <MailCheck className="size-5 shrink-0 text-accent-text" />
        {t("emailSent", { email: sent })}
      </p>
    );
  return (
    <form onSubmit={send} className="space-y-2">
      <div className="flex gap-2">
        <TextInput
          type="email"
          autoFocus
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t("newEmail")}
          aria-label={t("newEmail")}
        />
        <Button type="submit" variant="primary" className="h-11 shrink-0" loading={busy} disabled={!email.includes("@")}>
          {t("sendLink")}
        </Button>
      </div>
      {error && <p className="text-xs text-loss">{error}</p>}
    </form>
  );
}

function You({ account }: { account: AccountSession }) {
  const t = useT(m);
  const label = account.user.name || account.user.email;
  // a new account has no name yet: ask for it first
  const [editing, setEditing] = useState<"name" | "email" | null>(account.user.name ? null : "name");
  const [name, setName] = useState(account.user.name ?? "");
  const [busy, setBusy] = useState(false);
  const toggle = (what: "name" | "email") => setEditing((e) => (e === what ? null : what));

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      saveAccount({ token: account.token, user: await accountApi.rename(account.token, name) });
      setEditing(null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) signOutAccount();
      toast.error(err instanceof ApiError ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Avatar name={label} size="xl" className="ring-2 ring-team-b/70 ring-offset-4 ring-offset-bg" />
        <div className="min-w-0 flex-1">
          {editing === "name" ? (
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
            <>
              <h1 lang={nameLang(label)} className="display truncate text-4xl sm:text-5xl">
                {label}
              </h1>
              {account.user.name && <p className="mt-1 truncate text-sm text-muted">{account.user.email}</p>}
            </>
          )}
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm font-semibold text-muted">
            {account.user.name && (
              <button onClick={() => toggle("name")} className="hover:text-fg">
                {editing === "name" ? t("cancel") : t("rename")}
              </button>
            )}
            <button onClick={() => toggle("email")} className="hover:text-fg">
              {editing === "email" ? t("cancel") : t("changeEmail")}
            </button>
            <button onClick={signOutAccount} className="hover:text-fg">
              {t("signOut")}
            </button>
          </div>
        </div>
      </div>
      {editing === "email" && <ChangeEmail account={account} />}
    </div>
  );
}

function LeagueRow({ membership: mb }: { membership: Membership }) {
  const t = useT(m);
  const p = mb.player;
  const asked = mb.asked && t(mb.asked.new ? "askedNew" : "askedPlayer", { name: displayName(mb.asked.name) });
  return (
    <Link to={`/b/${mb.slug}`} className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-surface-2">
      <Avatar name={mb.name} size="lg" className="rounded-2xl" />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate font-semibold">{mb.name}</span>
          {asked ? (
            <Pill tone="b" className="shrink-0 whitespace-nowrap">
              {t("waiting")}
            </Pill>
          ) : (
            <Pill tone={mb.role === "owner" ? "accent" : "neutral"}>{t(mb.role)}</Pill>
          )}
        </span>
        <span className={cn("tabular mt-0.5 block text-xs text-muted", !asked && "truncate")}>
          {asked ||
            (p
              ? p.rank
                ? t("standing", { rank: p.rank, elo: p.elo })
                : t("newStanding", { elo: p.elo })
              : mb.role === "player"
                ? t("watching")
                : t("noPlayer"))}
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

/** Join requests waiting in leagues this person owns or runs: a way to them, where they are answered. */
function ForYou({ memberships }: { memberships: Membership[] }) {
  const t = useT(m);
  const waiting = memberships.filter((mb) => mb.pending > 0);
  if (!waiting.length) return null;
  return (
    <section>
      <p className="label mb-3 text-team-b">{t("forYou")}</p>
      <div className="card divide-y divide-line overflow-hidden border-team-b/35">
        {waiting.map((mb) => (
          <Link
            key={mb.slug}
            to={`/b/${mb.slug}/settings`}
            className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-team-b/12 text-team-b">
              <UserCheck className="size-4" />
            </span>
            <span className="min-w-0 flex-1 text-sm">
              <span className="font-semibold">{mb.name}</span>
              <span className="text-muted"> · {t("requests", { n: mb.pending })}</span>
            </span>
            <ChevronRight className="size-4 shrink-0 text-faint" />
          </Link>
        ))}
      </div>
    </section>
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
      <ForYou memberships={mine} />
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
      <LeagueForms account={account} />
    </div>
  );
}
