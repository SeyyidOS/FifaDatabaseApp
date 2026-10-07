import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Archive,
  ArchiveRestore,
  Check,
  Copy,
  Gauge,
  KeyRound,
  Link2,
  Lock,
  LogOut,
  PartyPopper,
  Pencil,
  Search,
  ShieldCheck,
  Trash2,
  Users,
} from "lucide-react";
import { AddPlayer } from "../components/AddPlayer";
import { DataGate } from "../components/DataGate";
import { PageHeader } from "../components/layout/AppShell";
import { ConfirmDialog } from "../components/ui/Dialog";
import { Avatar, ClubCrest } from "../components/ui/Identity";
import { Field, PasswordInput, TextInput } from "../components/ui/form";
import { Button, Delta, Panel, Pill, RankMove } from "../components/ui/primitives";
import type { Analytics } from "../hooks/analytics-context";
import { useBoard } from "../hooks/useBoard";
import { useDeleteMatch, useDeletePlayer, useUpdateBoard, useUpdatePlayer } from "../hooks/useData";
import { ApiError, publicApi } from "../lib/api";
import { cn } from "../lib/cn";
import { runElo } from "../lib/elo";
import { cleanName, displayName, formatDateTime } from "../lib/format";
import { getSession, removeSession, saveSession } from "../lib/session";
import type { ParsedMatch } from "../lib/stats";
import type { Player } from "../lib/types";
import { useT } from "../hooks/useI18n";
import { defineMessages } from "../lib/i18n";
import { common } from "../lib/messages";

const msg = defineMessages({
  en: {
    copyFailed: "Couldn't copy",
    copyFailedHint: "Select the text and copy it yourself.",
    copy: "Copy {what}",
    invite: "Invite your group",
    inviteSub: "Send the link and the board password; each device signs in once",
    readyBold: "Your board is ready.",
    readyText: " Share the link below with your friends together with the board password. Keep the admin password to yourself.",
    inviteLink: "Invite link",
    boardCode: "Board code",
    notAdmin: "That's the board password. Admin tools need the admin password.",
    unlocked: "Admin tools unlocked on this device",
    wrong: "Wrong password",
    locked: "Admin tools are locked",
    lockedSub: "Archiving, deleting and board settings",
    adminPassword: "Admin password",
    unlock: "Unlock",
    renamed: "Board renamed",
    renameFailed: "Couldn't rename the board",
    boardName: "Board name",
    kSet: "K-factor set to {k}",
    kSetHint: "Ratings recalculated for everyone.",
    kFailed: "Couldn't save the K-factor",
    kLabel: "K-factor",
    steady: "8 · steady",
    volatile: "64 · volatile",
    saving: "Saving…",
    pending: "Pending",
    saved: "Saved",
    preview: "Preview at K {k} vs live K {live}",
    live: "Live ratings",
    noPlayers: "No players yet.",
    memberChanged: "Board password changed",
    memberChangedHint: "Members sign in again with the new password.",
    adminChanged: "Admin password changed",
    adminChangedHint: "Other admin devices sign in again; this one stays signed in.",
    passwordFailed: "Couldn't change the password",
    newMember: "New board password",
    newAdmin: "New admin password",
    newMemberHint: "Signs every member device out.",
    newAdminHint: "Signs other admin devices out.",
    minChars: "At least 6 characters",
    change: "Change",
    renamedTo: "Renamed to {name}",
    renamedHint: "Their whole history follows.",
    renameFailedPlayer: "Couldn't rename",
    archivedToast: "{name} archived",
    archivedHint: "Off the roster; their matches and everyone's ratings stay as they were.",
    restored: "{name} is back",
    updateFailed: "Couldn't update the player",
    newName: "New name",
    archived: "Archived",
    matchesN: "{n} match|{n} matches",
    rename: "Rename",
    renameName: "Rename {name}",
    restore: "Restore to the roster",
    restoreName: "Restore {name}",
    archive: "Archive (keeps history)",
    archiveName: "Archive {name}",
    deleteName: "Delete {name}",
    onlyArchive: "Players with matches can only be archived",
    deleteTitle: "Delete {name}?",
    deleteHint: "They haven't played a match yet, so nothing else changes.",
    deleted: "{name} deleted",
    deleteFailed: "Couldn't delete the player",
    players: "Players",
    rosterSub: "{n} on the roster",
    rosterArchived: " · {n} archived",
    hideArchived: "Hide archived players",
    showArchived: "Show {n} archived",
    archiveNote: "Archiving takes someone off the roster without touching history or anyone's rating. Only players without matches can be deleted.",
    matches: "Matches",
    results: "{n} result|{n} results",
    searchMatches: "Search clubs or players…",
    deleteMatch: "Delete match",
    noMatches: "No matches.",
    showMore: "Show more ({n})",
    deleteMatchTitle: "Delete this match?",
    deleteMatchHint: "{match} on {date}. Elo will be recalculated without it.",
    matchDeleted: "Match deleted",
    matchDeleteFailed: "Couldn't delete the match",
    eyebrow: "Settings",
    adminDesc: "You're an admin on this device: invite people, tune ratings and tidy up players and matches.",
    memberDesc: "You're signed in as a member on this device.",
    ratings: "Ratings",
    ratingsSub: "The K-factor sets how far ratings move per match",
    board: "Board",
    boardSub: "Name and passwords",
  },
  tr: {
    copyFailed: "Kopyalanamadı",
    copyFailedHint: "Metni seçip kendin kopyala.",
    copy: "{what} kopyala",
    invite: "Grubunu davet et",
    inviteSub: "Linki ve board şifresini gönder; her cihaz bir kez giriş yapar",
    readyBold: "Board'un hazır.",
    readyText: " Aşağıdaki linki board şifresiyle birlikte arkadaşlarına gönder. Yönetici şifresini kendine sakla.",
    inviteLink: "Davet linki",
    boardCode: "Board kodu",
    notAdmin: "Bu board şifresi. Yönetici araçları için yönetici şifresi gerekiyor.",
    unlocked: "Yönetici araçları bu cihazda açıldı",
    wrong: "Şifre yanlış",
    locked: "Yönetici araçları kilitli",
    lockedSub: "Arşivleme, silme ve board ayarları",
    adminPassword: "Yönetici şifresi",
    unlock: "Kilidi aç",
    renamed: "Board'un adı değişti",
    renameFailed: "Board'un adı değiştirilemedi",
    boardName: "Board adı",
    kSet: "K-faktörü {k} oldu",
    kSetHint: "Herkesin puanı yeniden hesaplandı.",
    kFailed: "K-faktörü kaydedilemedi",
    kLabel: "K-faktörü",
    steady: "8 · durağan",
    volatile: "64 · oynak",
    saving: "Kaydediliyor…",
    pending: "Bekliyor",
    saved: "Kaydedildi",
    preview: "K {k} önizlemesi, şu anki K {live}",
    live: "Güncel puanlar",
    noPlayers: "Henüz oyuncu yok.",
    memberChanged: "Board şifresi değişti",
    memberChangedHint: "Üyeler yeni şifreyle tekrar giriş yapacak.",
    adminChanged: "Yönetici şifresi değişti",
    adminChangedHint: "Diğer yönetici cihazları tekrar giriş yapacak; bu cihaz girişli kalır.",
    passwordFailed: "Şifre değiştirilemedi",
    newMember: "Yeni board şifresi",
    newAdmin: "Yeni yönetici şifresi",
    newMemberHint: "Bütün üye cihazlarında çıkış yapılır.",
    newAdminHint: "Diğer yönetici cihazlarında çıkış yapılır.",
    minChars: "En az 6 karakter",
    change: "Değiştir",
    renamedTo: "Yeni adı: {name}",
    renamedHint: "Bütün geçmişi de yeni isme geçer.",
    renameFailedPlayer: "Ad değiştirilemedi",
    archivedToast: "{name} arşivlendi",
    archivedHint: "Kadrodan çıktı; maçları ve herkesin puanı olduğu gibi kalıyor.",
    restored: "{name} geri döndü",
    updateFailed: "Oyuncu güncellenemedi",
    newName: "Yeni ad",
    archived: "Arşivde",
    matchesN: "{n} maç|{n} maç",
    rename: "Yeniden adlandır",
    renameName: "{name} oyuncusunu yeniden adlandır",
    restore: "Kadroya geri al",
    restoreName: "{name} oyuncusunu geri al",
    archive: "Arşivle (geçmiş korunur)",
    archiveName: "{name} oyuncusunu arşivle",
    deleteName: "{name} oyuncusunu sil",
    onlyArchive: "Maçı olan oyuncular sadece arşivlenebilir",
    deleteTitle: "{name} silinsin mi?",
    deleteHint: "Henüz hiç maç oynamadı, başka hiçbir şey değişmez.",
    deleted: "{name} silindi",
    deleteFailed: "Oyuncu silinemedi",
    players: "Oyuncular",
    rosterSub: "Kadroda {n} kişi",
    rosterArchived: " · {n} arşivde",
    hideArchived: "Arşivdekileri gizle",
    showArchived: "Arşivdeki {n} kişiyi göster",
    archiveNote: "Arşivleme, geçmişe ve kimsenin puanına dokunmadan oyuncuyu kadrodan çıkarır. Sadece hiç maçı olmayan oyuncular silinebilir.",
    matches: "Maçlar",
    results: "{n} sonuç|{n} sonuç",
    searchMatches: "Kulüp ya da oyuncu ara…",
    deleteMatch: "Maçı sil",
    noMatches: "Maç yok.",
    showMore: "Daha fazla göster ({n})",
    deleteMatchTitle: "Bu maç silinsin mi?",
    deleteMatchHint: "{date} tarihli {match}. Elo bu maç olmadan yeniden hesaplanır.",
    matchDeleted: "Maç silindi",
    matchDeleteFailed: "Maç silinemedi",
    eyebrow: "Ayarlar",
    adminDesc: "Bu cihazda yöneticisin: insanları davet et, puanları ayarla, oyuncuları ve maçları düzenle.",
    memberDesc: "Bu cihazda üye olarak girişlisin.",
    ratings: "Puanlama",
    ratingsSub: "K-faktörü, puanların maç başına ne kadar değişeceğini belirler",
    board: "Board",
    boardSub: "Ad ve şifreler",
  },
});

const fail = (what: string) => (e: unknown) => toast.error(what, { description: (e as Error).message });

/* ---------------------------------- Invite --------------------------------- */

function CopyField({ label, value }: { label: string; value: string }) {
  const t = useT(msg);
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error(t("copyFailed"), { description: t("copyFailedHint") });
    }
  };
  return (
    <Field label={label}>
      <div className="flex gap-2">
        <input readOnly value={value} onFocus={(e) => e.target.select()} className="input h-11 font-mono text-xs" />
        <Button variant="secondary" className="h-11" onClick={copy} aria-label={t("copy", { what: label })}>
          {copied ? <Check className="size-4 text-win" /> : <Copy className="size-4" />}
        </Button>
      </div>
    </Field>
  );
}

function Invite({ welcome }: { welcome: boolean }) {
  const t = useT(msg);
  const { slug } = useBoard();
  const link = `${window.location.origin}${window.location.pathname}#/b/${slug}`;
  return (
    <Panel
      title={t("invite")}
      subtitle={t("inviteSub")}
      icon={<Link2 className="size-4" />}
      className={cn(welcome && "ring-2 ring-accent/60")}
    >
      {welcome && (
        <div className="mb-5 flex gap-3 rounded-2xl border border-accent/30 bg-accent/[0.07] p-4 text-sm">
          <PartyPopper className="size-5 shrink-0 text-accent-text" />
          <p>
            <span className="font-semibold">{t("readyBold")}</span>
            {t("readyText")}
          </p>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
        <CopyField label={t("inviteLink")} value={link} />
        <CopyField label={t("boardCode")} value={slug} />
      </div>
    </Panel>
  );
}

/* ------------------------------- Admin unlock ------------------------------ */

function AdminUnlock() {
  const t = useT(msg);
  const { slug } = useBoard();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!password) return;
    setBusy(true);
    setError(null);
    try {
      const signIn = await publicApi.signIn(slug, password);
      if (signIn.role !== "admin") {
        setError(t("notAdmin"));
        return;
      }
      saveSession(signIn, getSession(slug)?.remember ?? true);
      toast.success(t("unlocked"));
    } catch (err) {
      setError(err instanceof ApiError && err.status === 401 ? t("wrong") : (err as Error).message);
    } finally {
      setBusy(false);
      setPassword("");
    }
  };

  return (
    <Panel title={t("locked")} subtitle={t("lockedSub")} icon={<Lock className="size-4" />}>
      <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="flex-1">
          <PasswordInput
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t("adminPassword")}
            aria-label={t("adminPassword")}
            autoComplete="current-password"
          />
          {error && <p className="mt-1.5 text-xs text-loss">{error}</p>}
        </div>
        <Button type="submit" variant="primary" className="h-11" loading={busy} disabled={!password}>
          <ShieldCheck className="size-4" /> {t("unlock")}
        </Button>
      </form>
    </Panel>
  );
}

/* ---------------------------------- Board ---------------------------------- */

function BoardName() {
  const t = useT(msg);
  const tc = useT(common);
  const { name } = useBoard();
  const [value, setValue] = useState(name);
  const update = useUpdateBoard();
  useEffect(() => setValue(name), [name]);
  const save = (e: FormEvent) => {
    e.preventDefault();
    update.mutate(
      { name: value.trim() },
      { onSuccess: () => toast.success(t("renamed")), onError: fail(t("renameFailed")) },
    );
  };
  return (
    <form onSubmit={save} className="flex gap-2">
      <TextInput value={value} onChange={(e) => setValue(e.target.value)} maxLength={60} aria-label={t("boardName")} />
      <Button
        type="submit"
        variant="secondary"
        className="h-11"
        loading={update.isPending}
        disabled={value.trim().length < 2 || value.trim() === name}
      >
        {tc("save")}
      </Button>
    </form>
  );
}

function KFactor({ data }: { data: Analytics }) {
  const t = useT(msg);
  const [k, setK] = useState(data.k);
  const update = useUpdateBoard();
  const dirty = k !== data.k;

  useEffect(() => {
    if (!dirty) return;
    const timer = setTimeout(() => {
      update.mutate(
        { kFactor: k },
        {
          onSuccess: () => toast.success(t("kSet", { k }), { description: t("kSetHint") }),
          onError: fail(t("kFailed")),
        },
      );
    }, 700);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [k]);

  // what the table would look like at this K (all matches replayed, archived players included)
  const preview = useMemo(() => {
    const engine = runElo(data.players, data.clubs, data.matches, k);
    const elo = (id: number) => Math.round(engine.ratings.get(id) ?? 1000);
    return [...data.ranking]
      .sort((a, b) => elo(b.id) - elo(a.id))
      .map((p, i) => ({ p, elo: elo(p.id), rank: i + 1 }));
  }, [data, k]);

  return (
    <div>
      <div className="flex items-center gap-5">
        <span className="display tabular w-16 text-6xl text-accent-text">{k}</span>
        <div className="flex-1">
          <input
            type="range"
            min={8}
            max={64}
            value={k}
            onChange={(e) => setK(Number(e.target.value))}
            className="range"
            style={{ ["--fill" as string]: `${((k - 8) / 56) * 100}%` }}
            aria-label={t("kLabel")}
          />
          <div className="mt-2 flex justify-between text-[11px] text-faint">
            <span>{t("steady")}</span>
            <Pill tone={update.isPending ? "draw" : dirty ? "neutral" : "win"}>
              {update.isPending ? t("saving") : dirty ? t("pending") : t("saved")}
            </Pill>
            <span>{t("volatile")}</span>
          </div>
        </div>
      </div>
      <div className="hairline my-5" />
      <p className="label mb-3">{dirty ? t("preview", { k, live: data.k }) : t("live")}</p>
      <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
        {preview.map(({ p, elo, rank }) => (
          <div key={p.id} className="flex items-center gap-2.5 text-sm">
            <span className="display tabular w-5 text-faint">{rank}</span>
            <Avatar name={p.name} size="xs" />
            <span className="flex-1 truncate">{displayName(p.name)}</span>
            {dirty && <RankMove value={p.rank - rank} />}
            <span className="tabular w-12 text-right font-semibold">{elo}</span>
            {dirty && <Delta value={elo - p.elo} className="w-10 justify-end" />}
          </div>
        ))}
        {!preview.length && <p className="text-sm text-muted">{t("noPlayers")}</p>}
      </div>
    </div>
  );
}

function PasswordChange({ kind }: { kind: "password" | "adminPassword" }) {
  const t = useT(msg);
  const [value, setValue] = useState("");
  const update = useUpdateBoard();
  const member = kind === "password";
  const save = (e: FormEvent) => {
    e.preventDefault();
    update.mutate(
      { [kind]: value },
      {
        onSuccess: () => {
          setValue("");
          toast.success(member ? t("memberChanged") : t("adminChanged"), {
            description: member ? t("memberChangedHint") : t("adminChangedHint"),
          });
        },
        onError: fail(t("passwordFailed")),
      },
    );
  };
  return (
    <form onSubmit={save}>
      <Field
        label={member ? t("newMember") : t("newAdmin")}
        hint={member ? t("newMemberHint") : t("newAdminHint")}
      >
        <div className="flex gap-2">
          <PasswordInput
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoComplete="new-password"
            placeholder={t("minChars")}
          />
          <Button type="submit" variant="secondary" className="h-11" loading={update.isPending} disabled={value.length < 6}>
            {t("change")}
          </Button>
        </div>
      </Field>
    </form>
  );
}

/* --------------------------------- Players --------------------------------- */

function PlayerRow({ player, played }: { player: Player; played: number }) {
  const t = useT(msg);
  const tc = useT(common);
  const update = useUpdatePlayer();
  const del = useDeletePlayer();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(player.name);
  const [confirm, setConfirm] = useState(false);

  const rename = (e: FormEvent) => {
    e.preventDefault();
    const next = name.trim();
    if (!next || next.toLowerCase() === player.name) return setEditing(false);
    update.mutate(
      { id: player.id, name: next },
      {
        onSuccess: (p) => {
          setEditing(false);
          toast.success(t("renamedTo", { name: displayName(p.name) }), { description: t("renamedHint") });
        },
        onError: fail(t("renameFailedPlayer")),
      },
    );
  };
  const archive = (archived: boolean) =>
    update.mutate(
      { id: player.id, archived },
      {
        onSuccess: () =>
          toast.success(archived ? t("archivedToast", { name: displayName(player.name) }) : t("restored", { name: displayName(player.name) }), {
            description: archived ? t("archivedHint") : undefined,
          }),
        onError: fail(t("updateFailed")),
      },
    );

  return (
    <li className={cn("group flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-surface-2/60", player.archived && "opacity-60")}>
      <Avatar name={player.name} size="sm" />
      {editing ? (
        <form onSubmit={rename} className="flex min-w-0 flex-1 gap-2">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && setEditing(false)}
            maxLength={30}
            className="input h-8 text-sm"
            aria-label={t("newName")}
          />
          <Button type="submit" size="sm" variant="primary" loading={update.isPending}>
            Save
          </Button>
        </form>
      ) : (
        <span className="min-w-0 flex-1 truncate text-sm font-medium">
          {displayName(player.name)}
          {player.archived && <span className="ml-2 text-[10px] font-semibold text-faint uppercase">{t("archived")}</span>}
        </span>
      )}
      {!editing && (
        <>
          <span className="tabular hidden text-xs text-muted sm:block">{t("matchesN", { n: played })}</span>
          <span className="flex gap-0.5 opacity-70 transition-opacity group-hover:opacity-100">
            <Button size="icon" variant="ghost" onClick={() => setEditing(true)} aria-label={t("renameName", { name: player.name })} title={t("rename")}>
              <Pencil className="size-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => archive(!player.archived)}
              aria-label={player.archived ? t("restoreName", { name: player.name }) : t("archiveName", { name: player.name })}
              title={player.archived ? t("restore") : t("archive")}
            >
              {player.archived ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="text-loss"
              disabled={played > 0}
              onClick={() => setConfirm(true)}
              aria-label={t("deleteName", { name: player.name })}
              title={played > 0 ? t("onlyArchive") : tc("delete")}
            >
              <Trash2 className="size-4" />
            </Button>
          </span>
        </>
      )}
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        loading={del.isPending}
        title={t("deleteTitle", { name: displayName(player.name) })}
        description={t("deleteHint")}
        onConfirm={() =>
          del.mutate(player.id, {
            onSuccess: () => toast.success(t("deleted", { name: displayName(player.name) })),
            onError: fail(t("deleteFailed")),
            onSettled: () => setConfirm(false),
          })
        }
      />
    </li>
  );
}

function PlayersAdmin({ data }: { data: Analytics }) {
  const t = useT(msg);
  const [showArchived, setShowArchived] = useState(false);
  const archived = data.players.filter((p) => p.archived).length;
  const players = [...data.players]
    .filter((p) => showArchived || !p.archived)
    .sort((a, b) => Number(a.archived) - Number(b.archived) || a.name.localeCompare(b.name));
  return (
    <Panel
      title={t("players")}
      subtitle={t("rosterSub", { n: data.players.length - archived }) + (archived ? t("rosterArchived", { n: archived }) : "")}
      icon={<Users className="size-4" />}
      action={<AddPlayer players={data.players} />}
      bodyClassName="p-2"
    >
      <ul>
        {players.map((p) => (
          <PlayerRow key={p.id} player={p} played={data.stats.get(cleanName(p.name))?.played ?? 0} />
        ))}
      </ul>
      {archived > 0 && (
        <button onClick={() => setShowArchived((s) => !s)} className="mx-3 mt-2 mb-1 text-xs font-medium text-muted hover:text-fg">
          {showArchived ? t("hideArchived") : t("showArchived", { n: archived })}
        </button>
      )}
      <p className="mx-3 mt-3 mb-2 text-xs text-faint">
        {t("archiveNote")}
      </p>
    </Panel>
  );
}

/* --------------------------------- Matches --------------------------------- */

function MatchesAdmin({ data }: { data: Analytics }) {
  const t = useT(msg);
  const del = useDeleteMatch();
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(25);
  const [target, setTarget] = useState<ParsedMatch | null>(null);
  const filtered = data.parsed.filter((m) => {
    const s = q.trim().toLowerCase();
    return !s || [m.clubA, m.clubB, ...m.teamA, ...m.teamB].some((x) => x.toLowerCase().includes(s));
  });
  return (
    <Panel title={t("matches")} subtitle={t("results", { n: data.parsed.length })} icon={<ShieldCheck className="size-4" />} bodyClassName="p-0">
      <div className="border-b border-line p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("searchMatches")} className="input pl-9" />
        </div>
      </div>
      <ul className="divide-y divide-line/60">
        {filtered.slice(0, limit).map((m) => (
          <li key={m.id} className="group flex items-center gap-3 px-4 py-3 hover:bg-surface-2/40">
            <div className="min-w-0 flex-1">
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-sm">
                <span className="flex min-w-0 items-center justify-end gap-2">
                  <span className="truncate">{m.clubA}</span>
                  <ClubCrest name={m.clubA} size="xs" />
                </span>
                <span className="tabular rounded-md bg-surface-3 px-2 py-0.5 font-display text-base font-bold">
                  {m.scoreA}–{m.scoreB}
                </span>
                <span className="flex min-w-0 items-center gap-2">
                  <ClubCrest name={m.clubB} size="xs" />
                  <span className="truncate">{m.clubB}</span>
                </span>
              </div>
              <p className="mt-1 truncate text-center text-xs text-muted">
                {formatDateTime(m.date)} · {m.teamA.map(displayName).join(" & ")} v {m.teamB.map(displayName).join(" & ")}
              </p>
            </div>
            <Button size="sm" variant="ghost" className="text-loss opacity-60 group-hover:opacity-100" onClick={() => setTarget(m)} aria-label={t("deleteMatch")}>
              <Trash2 className="size-4" />
            </Button>
          </li>
        ))}
        {!filtered.length && <li className="px-4 py-8 text-center text-sm text-muted">{t("noMatches")}</li>}
      </ul>
      {filtered.length > limit && (
        <div className="border-t border-line p-3 text-center">
          <Button size="sm" variant="ghost" onClick={() => setLimit((l) => l + 50)}>
            {t("showMore", { n: filtered.length - limit })}
          </Button>
        </div>
      )}
      <ConfirmDialog
        open={!!target}
        onClose={() => setTarget(null)}
        loading={del.isPending}
        title={t("deleteMatchTitle")}
        description={
          target && (
            <>
              {t("deleteMatchHint", {
                match: `${target.clubA} ${target.scoreA}–${target.scoreB} ${target.clubB}`,
                date: formatDateTime(target.date),
              })}
            </>
          )
        }
        onConfirm={() =>
          target &&
          del.mutate(target.id, {
            onSuccess: () => toast.success(t("matchDeleted")),
            onError: fail(t("matchDeleteFailed")),
            onSettled: () => setTarget(null),
          })
        }
      />
    </Panel>
  );
}

/* ---------------------------------- Page ----------------------------------- */

function Section({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}>
      {children}
    </motion.div>
  );
}

export default function Settings() {
  const t = useT(msg);
  const tc = useT(common);
  const { slug, role, name } = useBoard();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const signOut = () => {
    removeSession(slug);
    qc.removeQueries({ queryKey: ["board", slug] });
    navigate("/");
  };

  return (
    <DataGate>
      {(data) => (
        <div className="space-y-6">
          <PageHeader
            eyebrow={t("eyebrow")}
            title={name}
            description={
              role === "admin" ? t("adminDesc") : t("memberDesc")
            }
            actions={
              <Button variant="ghost" onClick={signOut}>
                <LogOut className="size-4" /> {tc("signOutDevice")}
              </Button>
            }
          />
          <div className="grid gap-6 xl:grid-cols-12">
            <div className="min-w-0 space-y-6 xl:col-span-7">
              <Section>
                <Invite welcome={params.get("welcome") === "1"} />
              </Section>
              <AnimatePresence mode="wait">
                {role !== "admin" ? (
                  <Section key="locked" delay={0.05}>
                    <AdminUnlock />
                  </Section>
                ) : (
                  <Section key="board" delay={0.05}>
                    <Panel title={t("ratings")} subtitle={t("ratingsSub")} icon={<Gauge className="size-4" />}>
                      <KFactor data={data} />
                    </Panel>
                  </Section>
                )}
              </AnimatePresence>
              {role === "admin" && (
                <Section delay={0.1}>
                  <MatchesAdmin data={data} />
                </Section>
              )}
            </div>
            {role === "admin" && (
              <div className="min-w-0 space-y-6 xl:col-span-5">
                <Section delay={0.05}>
                  <Panel title={t("board")} subtitle={t("boardSub")} icon={<KeyRound className="size-4" />} bodyClassName="space-y-5 p-5">
                    <Field label={t("boardName")}>
                      <BoardName />
                    </Field>
                    <PasswordChange kind="password" />
                    <PasswordChange kind="adminPassword" />
                  </Panel>
                </Section>
                <Section delay={0.1}>
                  <PlayersAdmin data={data} />
                </Section>
              </div>
            )}
          </div>
        </div>
      )}
    </DataGate>
  );
}
