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

const fail = (what: string) => (e: unknown) => toast.error(what, { description: (e as Error).message });

/* ---------------------------------- Invite --------------------------------- */

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy", { description: "Select the text and copy it yourself." });
    }
  };
  return (
    <Field label={label}>
      <div className="flex gap-2">
        <input readOnly value={value} onFocus={(e) => e.target.select()} className="input h-11 font-mono text-xs" />
        <Button variant="secondary" className="h-11" onClick={copy} aria-label={`Copy ${label.toLowerCase()}`}>
          {copied ? <Check className="size-4 text-win" /> : <Copy className="size-4" />}
        </Button>
      </div>
    </Field>
  );
}

function Invite({ welcome }: { welcome: boolean }) {
  const { slug } = useBoard();
  const link = `${window.location.origin}${window.location.pathname}#/b/${slug}`;
  return (
    <Panel
      title="Invite your group"
      subtitle="Send the link and the board password; each device signs in once"
      icon={<Link2 className="size-4" />}
      className={cn(welcome && "ring-2 ring-accent/60")}
    >
      {welcome && (
        <div className="mb-5 flex gap-3 rounded-2xl border border-accent/30 bg-accent/[0.07] p-4 text-sm">
          <PartyPopper className="size-5 shrink-0 text-accent-text" />
          <p>
            <span className="font-semibold">Your board is ready.</span> Share the link below with your friends together
            with the board password. Keep the admin password to yourself.
          </p>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
        <CopyField label="Invite link" value={link} />
        <CopyField label="Board code" value={slug} />
      </div>
    </Panel>
  );
}

/* ------------------------------- Admin unlock ------------------------------ */

function AdminUnlock() {
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
        setError("That's the board password. Admin tools need the admin password.");
        return;
      }
      saveSession(signIn, getSession(slug)?.remember ?? true);
      toast.success("Admin tools unlocked on this device");
    } catch (err) {
      setError(err instanceof ApiError && err.status === 401 ? "Wrong password" : (err as Error).message);
    } finally {
      setBusy(false);
      setPassword("");
    }
  };

  return (
    <Panel title="Admin tools are locked" subtitle="Archiving, deleting and board settings" icon={<Lock className="size-4" />}>
      <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="flex-1">
          <PasswordInput
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Admin password"
            aria-label="Admin password"
            autoComplete="current-password"
          />
          {error && <p className="mt-1.5 text-xs text-loss">{error}</p>}
        </div>
        <Button type="submit" variant="primary" className="h-11" loading={busy} disabled={!password}>
          <ShieldCheck className="size-4" /> Unlock
        </Button>
      </form>
    </Panel>
  );
}

/* ---------------------------------- Board ---------------------------------- */

function BoardName() {
  const { name } = useBoard();
  const [value, setValue] = useState(name);
  const update = useUpdateBoard();
  useEffect(() => setValue(name), [name]);
  const save = (e: FormEvent) => {
    e.preventDefault();
    update.mutate(
      { name: value.trim() },
      { onSuccess: () => toast.success("Board renamed"), onError: fail("Couldn't rename the board") },
    );
  };
  return (
    <form onSubmit={save} className="flex gap-2">
      <TextInput value={value} onChange={(e) => setValue(e.target.value)} maxLength={60} aria-label="Board name" />
      <Button
        type="submit"
        variant="secondary"
        className="h-11"
        loading={update.isPending}
        disabled={value.trim().length < 2 || value.trim() === name}
      >
        Save
      </Button>
    </form>
  );
}

function KFactor({ data }: { data: Analytics }) {
  const [k, setK] = useState(data.k);
  const update = useUpdateBoard();
  const dirty = k !== data.k;

  useEffect(() => {
    if (!dirty) return;
    const t = setTimeout(() => {
      update.mutate(
        { kFactor: k },
        {
          onSuccess: () => toast.success(`K-factor set to ${k}`, { description: "Ratings recalculated for everyone." }),
          onError: fail("Couldn't save the K-factor"),
        },
      );
    }, 700);
    return () => clearTimeout(t);
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
            aria-label="K-factor"
          />
          <div className="mt-2 flex justify-between text-[11px] text-faint">
            <span>8 · steady</span>
            <Pill tone={update.isPending ? "draw" : dirty ? "neutral" : "win"}>
              {update.isPending ? "Saving…" : dirty ? "Pending" : "Saved"}
            </Pill>
            <span>64 · volatile</span>
          </div>
        </div>
      </div>
      <div className="hairline my-5" />
      <p className="label mb-3">{dirty ? `Preview at K ${k} vs live K ${data.k}` : "Live ratings"}</p>
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
        {!preview.length && <p className="text-sm text-muted">No players yet.</p>}
      </div>
    </div>
  );
}

function PasswordChange({ kind }: { kind: "password" | "adminPassword" }) {
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
          toast.success(member ? "Board password changed" : "Admin password changed", {
            description: member
              ? "Members sign in again with the new password."
              : "Other admin devices sign in again; this one stays signed in.",
          });
        },
        onError: fail("Couldn't change the password"),
      },
    );
  };
  return (
    <form onSubmit={save}>
      <Field
        label={member ? "New board password" : "New admin password"}
        hint={member ? "Signs every member device out." : "Signs other admin devices out."}
      >
        <div className="flex gap-2">
          <PasswordInput
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoComplete="new-password"
            placeholder="At least 6 characters"
          />
          <Button type="submit" variant="secondary" className="h-11" loading={update.isPending} disabled={value.length < 6}>
            Change
          </Button>
        </div>
      </Field>
    </form>
  );
}

/* --------------------------------- Players --------------------------------- */

function PlayerRow({ player, played }: { player: Player; played: number }) {
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
          toast.success(`Renamed to ${displayName(p.name)}`, { description: "Their whole history follows." });
        },
        onError: fail("Couldn't rename"),
      },
    );
  };
  const archive = (archived: boolean) =>
    update.mutate(
      { id: player.id, archived },
      {
        onSuccess: () =>
          toast.success(archived ? `${displayName(player.name)} archived` : `${displayName(player.name)} is back`, {
            description: archived ? "Off the roster; their matches and everyone's ratings stay as they were." : undefined,
          }),
        onError: fail("Couldn't update the player"),
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
            aria-label="New name"
          />
          <Button type="submit" size="sm" variant="primary" loading={update.isPending}>
            Save
          </Button>
        </form>
      ) : (
        <span className="min-w-0 flex-1 truncate text-sm font-medium">
          {displayName(player.name)}
          {player.archived && <span className="ml-2 text-[10px] font-semibold text-faint uppercase">Archived</span>}
        </span>
      )}
      {!editing && (
        <>
          <span className="tabular hidden text-xs text-muted sm:block">{played} matches</span>
          <span className="flex gap-0.5 opacity-70 transition-opacity group-hover:opacity-100">
            <Button size="icon" variant="ghost" onClick={() => setEditing(true)} aria-label={`Rename ${player.name}`} title="Rename">
              <Pencil className="size-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => archive(!player.archived)}
              aria-label={player.archived ? `Restore ${player.name}` : `Archive ${player.name}`}
              title={player.archived ? "Restore to the roster" : "Archive (keeps history)"}
            >
              {player.archived ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="text-loss"
              disabled={played > 0}
              onClick={() => setConfirm(true)}
              aria-label={`Delete ${player.name}`}
              title={played > 0 ? "Players with matches can only be archived" : "Delete"}
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
        title={`Delete ${displayName(player.name)}?`}
        description="They haven't played a match yet, so nothing else changes."
        onConfirm={() =>
          del.mutate(player.id, {
            onSuccess: () => toast.success(`${displayName(player.name)} deleted`),
            onError: fail("Couldn't delete the player"),
            onSettled: () => setConfirm(false),
          })
        }
      />
    </li>
  );
}

function PlayersAdmin({ data }: { data: Analytics }) {
  const [showArchived, setShowArchived] = useState(false);
  const archived = data.players.filter((p) => p.archived).length;
  const players = [...data.players]
    .filter((p) => showArchived || !p.archived)
    .sort((a, b) => Number(a.archived) - Number(b.archived) || a.name.localeCompare(b.name));
  return (
    <Panel
      title="Players"
      subtitle={`${data.players.length - archived} on the roster${archived ? ` · ${archived} archived` : ""}`}
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
          {showArchived ? "Hide archived players" : `Show ${archived} archived`}
        </button>
      )}
      <p className="mx-3 mt-3 mb-2 text-xs text-faint">
        Archiving takes someone off the roster without touching history or anyone's rating. Only players without
        matches can be deleted.
      </p>
    </Panel>
  );
}

/* --------------------------------- Matches --------------------------------- */

function MatchesAdmin({ data }: { data: Analytics }) {
  const del = useDeleteMatch();
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(25);
  const [target, setTarget] = useState<ParsedMatch | null>(null);
  const filtered = data.parsed.filter((m) => {
    const s = q.trim().toLowerCase();
    return !s || [m.clubA, m.clubB, ...m.teamA, ...m.teamB].some((x) => x.toLowerCase().includes(s));
  });
  return (
    <Panel title="Matches" subtitle={`${data.parsed.length} results`} icon={<ShieldCheck className="size-4" />} bodyClassName="p-0">
      <div className="border-b border-line p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search clubs or players…" className="input pl-9" />
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
            <Button size="sm" variant="ghost" className="text-loss opacity-60 group-hover:opacity-100" onClick={() => setTarget(m)} aria-label="Delete match">
              <Trash2 className="size-4" />
            </Button>
          </li>
        ))}
        {!filtered.length && <li className="px-4 py-8 text-center text-sm text-muted">No matches.</li>}
      </ul>
      {filtered.length > limit && (
        <div className="border-t border-line p-3 text-center">
          <Button size="sm" variant="ghost" onClick={() => setLimit((l) => l + 50)}>
            Show more ({filtered.length - limit})
          </Button>
        </div>
      )}
      <ConfirmDialog
        open={!!target}
        onClose={() => setTarget(null)}
        loading={del.isPending}
        title="Delete this match?"
        description={
          target && (
            <>
              {target.clubA} {target.scoreA}–{target.scoreB} {target.clubB} on {formatDateTime(target.date)}. Elo will
              be recalculated without it.
            </>
          )
        }
        onConfirm={() =>
          target &&
          del.mutate(target.id, {
            onSuccess: () => toast.success("Match deleted"),
            onError: fail("Couldn't delete the match"),
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
            eyebrow="Settings"
            title={name}
            description={
              role === "admin"
                ? "You're an admin on this device: invite people, tune ratings and tidy up players and matches."
                : "You're signed in as a member on this device."
            }
            actions={
              <Button variant="ghost" onClick={signOut}>
                <LogOut className="size-4" /> Sign out on this device
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
                    <Panel title="Ratings" subtitle="The K-factor sets how far ratings move per match" icon={<Gauge className="size-4" />}>
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
                  <Panel title="Board" subtitle="Name and passwords" icon={<KeyRound className="size-4" />} bodyClassName="space-y-5 p-5">
                    <Field label="Board name">
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
