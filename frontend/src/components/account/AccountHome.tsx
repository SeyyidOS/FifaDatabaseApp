import { Camera, ChevronRight, Link2, LogOut, MailCheck, Pencil, Plus, UserCheck } from "lucide-react";
import { useCallback, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { useSessions } from "../../hooks/useBoard";
import { useMemberships } from "../../hooks/useAccount";
import { useLang, useT } from "../../hooks/useI18n";
import { saveAccount, signOutAccount, type AccountSession } from "../../lib/account";
import { accountApi, ApiError } from "../../lib/api";
import { cn } from "../../lib/cn";
import { displayName, nameLang } from "../../lib/format";
import { defineMessages, locale } from "../../lib/i18n";
import { common } from "../../lib/messages";
import type { Membership, Outcome } from "../../lib/types";
import { Modal } from "../ui/Dialog";
import { Field, TextInput } from "../ui/form";
import { Avatar } from "../ui/Identity";
import { Button, Pill } from "../ui/primitives";
import { DeleteAccount } from "./DeleteAccount";
import { InviteLinkForm, NewLeagueForm } from "./LeagueForms";
import { PhotoCropper } from "./PhotoCropper";

const m = defineMessages({
  en: {
    profile: "My profile",
    edit: "Edit profile",
    yourName: "Your name",
    nameFirst: "What's your name?",
    nameFirstHint: "Your leagues see you by it.",
    save: "Save",
    signOut: "Sign out",
    email: "E-mail",
    change: "Change",
    cancel: "Cancel",
    newEmail: "New e-mail address",
    sendLink: "Send a link",
    emailSent: "We sent a link to {email}. Opening it moves your account there, leagues and all; until then you sign in with this address.",
    emailTaken: "That address already has an account",
    emailSame: "That's already your address",
    addPhoto: "Add a photo",
    changePhoto: "Change photo",
    removePhoto: "Remove photo",
    photoRemoved: "Photo removed",
    photo: "Change your photo",
    owner: "Owner",
    admin: "Admin",
    player: "Player",
    waiting: "Waiting",
    eloRank: "Elo · #{rank}",
    eloNew: "Elo · new",
    matches: "Matches",
    wins: "Wins",
    goals: "Goals",
    form: "Form",
    noPlayer: "Open the league and tap “That's me” on your profile",
    watching: "Not linked to a player",
    askedPlayer: "You said you're {name}; once it's confirmed, your matches are on your account",
    askedNew: "You asked to join as {name}",
    openLeague: "{league}, your player",
    lastNight: "Your last night · {day}",
    record: "{played} matches · {w}W {d}D {l}L",
    recordNoDraws: "{played} matches · {w}W {l}L",
    noLeagues: "No leagues yet. Start one, or open the invite link you were sent.",
    device: "On this device only · ask whoever runs it for an invite to add it to your account",
    forYou: "Waiting for you",
    requests: "{n} join request|{n} join requests",
    newLeague: "Start a league",
    haveInvite: "Got an invite link",
    showLeague: "Show {league}",
  },
  tr: {
    profile: "Profilim",
    edit: "Profili düzenle",
    yourName: "Adın",
    nameFirst: "Adın ne?",
    nameFirstHint: "Liglerin seni bu adla görür.",
    save: "Kaydet",
    signOut: "Çıkış yap",
    email: "E-posta",
    change: "Değiştir",
    cancel: "Vazgeç",
    newEmail: "Yeni e-posta adresi",
    sendLink: "Link gönder",
    emailSent: "{email} adresine bir link gönderdik. Açınca hesabın, ligleriyle birlikte o adrese geçer; o zamana kadar bu adresle girmeye devam edersin.",
    emailTaken: "Bu adresin zaten bir hesabı var",
    emailSame: "Bu zaten senin adresin",
    addPhoto: "Fotoğraf ekle",
    changePhoto: "Fotoğrafı değiştir",
    removePhoto: "Fotoğrafı kaldır",
    photoRemoved: "Fotoğraf kaldırıldı",
    photo: "Fotoğrafını değiştir",
    owner: "Sahip",
    admin: "Yönetici",
    player: "Oyuncu",
    waiting: "Onay bekliyor",
    eloRank: "Elo · {rank}. sıra",
    eloNew: "Elo · yeni",
    matches: "Maç",
    wins: "Galibiyet",
    goals: "Gol",
    form: "Form",
    noPlayer: "Lige gir, profilinde “Bu benim” de",
    watching: "Bir oyuncuya bağlı değilsin",
    askedPlayer: "Kendini {name} olarak seçtin; onaylanınca maçların hesabına bağlanır",
    askedNew: "{name} adıyla katılmak istedin",
    openLeague: "{league}, oyuncun",
    lastNight: "Son gecen · {day}",
    record: "{played} maç · {w}G {d}B {l}M",
    recordNoDraws: "{played} maç · {w}G {l}M",
    noLeagues: "Henüz bir ligin yok. Bir tane kur ya da sana gelen davet linkini aç.",
    device: "Yalnızca bu cihazda · hesabına eklemek için yöneteninden davet linki iste",
    forYou: "Senden bekleyen",
    requests: "{n} katılma isteği|{n} katılma isteği",
    newLeague: "Yeni lig kur",
    haveInvite: "Davet linki gir",
    showLeague: "{league} kartını göster",
  },
});

const OUTCOME = { W: "bg-win", D: "bg-draw", L: "bg-loss" } as const;

function FormDots({ form }: { form: Outcome[] }) {
  return (
    <span className="flex h-7 items-center gap-1">
      {form.map((r, i) => (
        <span key={i} className={cn("size-2.5 rounded-full", OUTCOME[r])} />
      ))}
    </span>
  );
}

function Stat({ value, label }: { value: ReactNode; label: string }) {
  return (
    <span className="flex flex-col items-center gap-1.5">
      <span className="display tabular text-[26px] leading-none">{value}</span>
      <span className="label">{label}</span>
    </span>
  );
}

/** One league as the account's player card: its Elo and rank, the photo, the record and the form. */
function LeagueCard({ account, membership: mb, onPhoto }: { account: AccountSession; membership: Membership; onPhoto: () => void }) {
  const t = useT(m);
  const p = mb.player;
  const label = account.user.name || account.user.email;
  const to = p ? `/b/${mb.slug}/players/${encodeURIComponent(p.name)}` : `/b/${mb.slug}`;
  const note = mb.asked
    ? t(mb.asked.new ? "askedNew" : "askedPlayer", { name: displayName(mb.asked.name) })
    : !p
      ? mb.role === "player"
        ? t("watching")
        : t("noPlayer")
      : null;
  return (
    <article
      className="relative flex w-full shrink-0 snap-center flex-col items-center gap-4 overflow-hidden rounded-[28px] border border-accent/30 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,.1),0_40px_70px_-40px_rgba(200,255,61,.35)]"
      style={{ background: "linear-gradient(170deg, color-mix(in oklab, var(--color-accent) 16%, transparent), var(--color-surface) 40%, var(--color-bg-elev))" }}
    >
      {/* the whole card leads to the player (or the league); the photo button sits above it */}
      <Link to={to} aria-label={t("openLeague", { league: mb.name })} className="absolute inset-0 z-0" />
      <div className="pointer-events-none relative flex w-full items-start justify-between">
        {p ? (
          <span className="flex flex-col gap-1">
            <span className="display tabular text-5xl leading-none text-accent-text">{p.elo}</span>
            <span className="label text-accent-text">{p.rank ? t("eloRank", { rank: p.rank }) : t("eloNew")}</span>
          </span>
        ) : (
          <span />
        )}
        <span className="flex flex-col items-end gap-1.5">
          <Avatar name={mb.name} size="md" photo={null} className="rounded-xl" />
          {mb.asked ? (
            <Pill tone="b" className="shrink-0 whitespace-nowrap">
              {t("waiting")}
            </Pill>
          ) : (
            <Pill tone={mb.role === "owner" ? "accent" : "neutral"}>{t(mb.role)}</Pill>
          )}
        </span>
      </div>
      <span className="relative -mt-6">
        <Avatar name={label} photo={account.user.photo} size="3xl" className="ring-2 ring-accent/70 ring-offset-4 ring-offset-surface" />
        <button
          onClick={onPhoto}
          aria-label={t("photo")}
          className="accent-gem absolute right-0 bottom-1 z-10 grid size-11 place-items-center rounded-full border-[3px] border-surface"
        >
          <Camera className="size-[18px]" />
        </button>
      </span>
      <span className="pointer-events-none relative flex max-w-full flex-col items-center gap-1.5 text-center">
        <span lang={nameLang(label)} className="display max-w-full truncate text-4xl">
          {label}
        </span>
        <span className="text-sm text-muted">{mb.name}</span>
      </span>
      <span className="pointer-events-none relative h-px w-full bg-gradient-to-r from-transparent via-line-strong to-transparent" />
      {p && !mb.asked ? (
        <span className="pointer-events-none relative grid w-full grid-cols-4">
          <Stat value={p.played} label={t("matches")} />
          <Stat value={p.wins} label={t("wins")} />
          <Stat value={p.goals} label={t("goals")} />
          <span className="flex flex-col items-center gap-1.5">
            <FormDots form={p.form} />
            <span className="label">{t("form")}</span>
          </span>
        </span>
      ) : (
        <p className="pointer-events-none relative px-2 text-center text-sm text-muted">{note}</p>
      )}
    </article>
  );
}

/** The day a night began, as "10 October". */
const nightDay = (day: string) =>
  new Intl.DateTimeFormat(locale(), { day: "numeric", month: "long" }).format(new Date(`${day}T12:00:00`));

/** The account's leagues as cards, side by side; the shown one's last night under them. */
function LeagueCards({ account, memberships, onPhoto }: { account: AccountSession; memberships: Membership[]; onPhoto: () => void }) {
  const t = useT(m);
  const strip = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const shown = memberships[Math.min(index, memberships.length - 1)];
  const night = shown?.player?.lastNight;
  const go = (i: number) => strip.current?.scrollTo({ left: i * strip.current.clientWidth, behavior: "smooth" });

  return (
    <div className="space-y-3">
      <div
        ref={strip}
        onScroll={(e) => setIndex(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {memberships.map((mb) => (
          <LeagueCard key={mb.slug} account={account} membership={mb} onPhoto={onPhoto} />
        ))}
      </div>
      {memberships.length > 1 && (
        <div className="flex justify-center gap-1.5">
          {memberships.map((mb, i) => (
            <button
              key={mb.slug}
              onClick={() => go(i)}
              aria-label={t("showLeague", { league: mb.name })}
              aria-current={i === index}
              className="grid h-6 place-items-center px-0.5"
            >
              <span className={cn("block h-1.5 rounded-full transition-all", i === index ? "w-5 bg-accent" : "w-1.5 bg-line-strong")} />
            </button>
          ))}
        </div>
      )}
      {night && (
        <Link
          to={`/b/${shown.slug}/night/${night.day}`}
          className="flex min-h-15 items-center gap-3 rounded-2xl border border-line bg-surface/60 px-4 py-3 transition-colors hover:border-line-strong"
        >
          <span className="min-w-0 flex-1">
            <span className="label block">{t("lastNight", { day: nightDay(night.day) })}</span>
            <span className="tabular mt-1 block text-sm font-semibold">
              {night.draws
                ? t("record", { played: night.played, w: night.wins, d: night.draws, l: night.losses })
                : t("recordNoDraws", { played: night.played, w: night.wins, l: night.losses })}
            </span>
          </span>
          <span
            className={cn(
              "tabular rounded-lg px-2 py-1 text-sm font-bold",
              night.delta > 0 ? "bg-win/12 text-win" : night.delta < 0 ? "bg-loss/12 text-loss" : "bg-surface-2 text-muted",
            )}
          >
            {night.delta > 0 ? "+" : night.delta < 0 ? "−" : "±"}
            {Math.abs(night.delta)} Elo
          </span>
          <ChevronRight className="size-4 shrink-0 text-faint" />
        </Link>
      )}
    </div>
  );
}

/** Before anything else, a new account says what it is called. */
function NameStep({ account }: { account: AccountSession }) {
  const t = useT(m);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      saveAccount({ token: account.token, user: await accountApi.rename(account.token, name) });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) signOutAccount();
      toast.error(err instanceof ApiError ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={save} className="card space-y-3 p-5">
      <div>
        <p className="font-semibold">{t("nameFirst")}</p>
        <p className="text-sm text-muted">{t("nameFirstHint")}</p>
      </div>
      <div className="flex gap-2">
        <TextInput autoFocus maxLength={40} value={name} onChange={(e) => setName(e.target.value)} placeholder={t("yourName")} aria-label={t("yourName")} />
        <Button type="submit" variant="primary" className="h-11 shrink-0" loading={busy} disabled={!name.trim()}>
          {t("save")}
        </Button>
      </div>
    </form>
  );
}

/** Moving the account to another address: a link to that address, which does it once opened. */
function ChangeEmail({ account }: { account: AccountSession }) {
  const t = useT(m);
  const tc = useT(common);
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
      setError(
        status === 409
          ? t("emailTaken")
          : status === 422
            ? t("emailSame")
            : status === 503
              ? tc("mailFailed")
              : (err as Error).message,
      );
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

/** Photo, name, e-mail and signing out, in one place. */
function EditProfile({ account, onPhoto }: { account: AccountSession; onPhoto: () => void }) {
  const t = useT(m);
  const label = account.user.name || account.user.email;
  const [name, setName] = useState(account.user.name ?? "");
  const [busy, setBusy] = useState(false);
  const [moving, setMoving] = useState(false);

  const rename = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      saveAccount({ token: account.token, user: await accountApi.rename(account.token, name) });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };
  const removePhoto = async () => {
    try {
      saveAccount({ token: account.token, user: await accountApi.removePhoto(account.token) });
      toast.success(t("photoRemoved"));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : String(err));
    }
  };

  return (
    <div className="space-y-6">
      <h2 id="edit-title" className="text-lg font-semibold">
        {t("edit")}
      </h2>
      <div className="flex items-center gap-4">
        <Avatar name={label} photo={account.user.photo} size="xl" />
        <div className="flex flex-col items-start gap-2">
          <Button variant="secondary" onClick={onPhoto}>
            <Camera className="size-4" /> {account.user.photo ? t("changePhoto") : t("addPhoto")}
          </Button>
          {account.user.photo && (
            <button onClick={removePhoto} className="text-sm font-semibold text-muted hover:text-loss">
              {t("removePhoto")}
            </button>
          )}
        </div>
      </div>
      <form onSubmit={rename}>
        <Field label={t("yourName")} htmlFor="account-name">
          <div className="flex gap-2">
            <TextInput id="account-name" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} />
            <Button
              type="submit"
              variant="secondary"
              className="h-11 shrink-0"
              loading={busy}
              disabled={!name.trim() || name.trim() === account.user.name}
            >
              {t("save")}
            </Button>
          </div>
        </Field>
      </form>
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <span className="min-w-0">
            <span className="label block">{t("email")}</span>
            <span className="mt-1 block truncate text-sm">{account.user.email}</span>
          </span>
          <Button variant="ghost" size="sm" onClick={() => setMoving((v) => !v)}>
            {moving ? t("cancel") : t("change")}
          </Button>
        </div>
        {moving && <ChangeEmail account={account} />}
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-line pt-4">
        <Button variant="ghost" className="text-loss" onClick={signOutAccount}>
          <LogOut className="size-4" /> {t("signOut")}
        </Button>
        <DeleteAccount account={account} />
      </div>
    </div>
  );
}

/** A board this device opened with its password: it opens from here; onto the account it comes with an invite. */
function DeviceRow({ slug, name }: { slug: string; name: string }) {
  const t = useT(m);
  return (
    <Link to={`/b/${slug}`} className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-surface-2">
      <Avatar name={name} size="lg" photo={null} className="rounded-2xl opacity-80" />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">{name}</span>
        <span className="mt-0.5 block text-xs text-muted">{t("device")}</span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-faint" />
    </Link>
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
          <Link key={mb.slug} to={`/b/${mb.slug}/settings`} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2">
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

/** Profilim: the signed-in person's home. Their leagues as their player cards, and starting or joining one. */
export function AccountHome({ account }: { account: AccountSession }) {
  const t = useT(m);
  const memberships = useMemberships();
  const sessions = useSessions();
  const mine = memberships.data ?? [];
  // boards opened on this device with a password that the account isn't in yet
  const unlinked = memberships.data ? sessions.filter((s) => !mine.some((mb) => mb.slug === s.slug)) : [];
  const [sheet, setSheet] = useState<"edit" | "invite" | "new" | null>(null);
  const [cropping, setCropping] = useState<File | null>(null);
  const picker = useRef<HTMLInputElement>(null);
  const label = account.user.name || account.user.email;

  // the file picker opens straight from the tap (browsers want that); the cropper takes it from there
  const pickPhoto = () => {
    setSheet(null);
    picker.current?.click();
  };
  const stopCropping = useCallback(() => setCropping(null), []);

  return (
    <div className="mx-auto max-w-md space-y-5 py-4 sm:py-8">
      <div className="flex items-center justify-between">
        <p className="label">{t("profile")}</p>
        <Button variant="secondary" size="icon" onClick={() => setSheet("edit")} aria-label={t("edit")} title={t("edit")}>
          <Pencil className="size-4" />
        </Button>
      </div>
      {!account.user.name && <NameStep account={account} />}
      <ForYou memberships={mine} />
      {memberships.isLoading ? (
        <div className="skeleton h-[420px] rounded-[28px]" />
      ) : mine.length ? (
        <LeagueCards account={account} memberships={mine} onPhoto={pickPhoto} />
      ) : (
        <div className="card flex flex-col items-center gap-4 p-6 text-center">
          <span className="relative">
            <Avatar name={label} photo={account.user.photo} size="2xl" />
            <button
              onClick={pickPhoto}
              aria-label={t("photo")}
              className="accent-gem absolute right-0 bottom-0 grid size-10 place-items-center rounded-full border-[3px] border-surface"
            >
              <Camera className="size-4" />
            </button>
          </span>
          <span lang={nameLang(label)} className="display text-3xl">
            {label}
          </span>
          <p className="text-sm text-muted">{t("noLeagues")}</p>
        </div>
      )}
      {unlinked.length > 0 && (
        <div className="card divide-y divide-line overflow-hidden">
          {unlinked.map((s) => (
            <DeviceRow key={s.slug} slug={s.slug} name={s.name} />
          ))}
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Button variant="primary" size="lg" onClick={() => setSheet("new")}>
          <Plus className="size-4" /> {t("newLeague")}
        </Button>
        <Button variant="secondary" size="lg" onClick={() => setSheet("invite")}>
          <Link2 className="size-4" /> {t("haveInvite")}
        </Button>
      </div>

      <input
        ref={picker}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) setCropping(file);
          e.target.value = "";
        }}
      />
      <Modal open={sheet === "edit"} onClose={() => setSheet(null)} labelledBy="edit-title">
        <EditProfile account={account} onPhoto={pickPhoto} />
      </Modal>
      <Modal open={sheet === "new"} onClose={() => setSheet(null)}>
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">{t("newLeague")}</h2>
          <NewLeagueForm account={account} />
        </div>
      </Modal>
      <Modal open={sheet === "invite"} onClose={() => setSheet(null)}>
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">{t("haveInvite")}</h2>
          <InviteLinkForm autoFocus />
        </div>
      </Modal>
      <PhotoCropper file={cropping} account={account} onClose={stopCropping} />
    </div>
  );
}
