import { motion } from "motion/react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Check, Gauge, Lock, LogOut, Search, ShieldCheck, Trash2, Users } from "lucide-react";
import { AddPlayer } from "../components/AddPlayer";
import { DataGate } from "../components/DataGate";
import { PageHeader } from "../components/layout/AppShell";
import { ConfirmDialog } from "../components/ui/Dialog";
import { Avatar, ClubCrest } from "../components/ui/Identity";
import { Button, Delta, Panel, Pill, RankMove } from "../components/ui/primitives";
import type { Analytics } from "../hooks/analytics-context";
import { useDeleteMatch, useDeletePlayer, useUpdateKFactor } from "../hooks/useData";
import { useSessionState } from "../hooks/useSessionState";
import { cn } from "../lib/cn";
import { runElo } from "../lib/elo";
import { cleanName, displayName, formatDateTime } from "../lib/format";
import type { ParsedMatch } from "../lib/stats";

// Same client-side gate as the original app — not real security (the API is open).
const ADMIN_PASSWORD = "admin123";

function Gate({ onUnlock }: { onUnlock: () => void }) {
  const [pw, setPw] = useState("");
  const [shake, setShake] = useState(0);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (pw === ADMIN_PASSWORD) onUnlock();
    else {
      setShake((s) => s + 1);
      setPw("");
    }
  };
  return (
    <div className="grid min-h-[60vh] place-items-center">
      <motion.form
        key={shake}
        onSubmit={submit}
        animate={shake ? { x: [0, -10, 10, -6, 6, 0] } : {}}
        transition={{ duration: 0.4 }}
        className="card w-full max-w-sm p-8 text-center"
      >
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-surface-2 text-accent-text ring-1 ring-line">
          <Lock className="size-6" />
        </span>
        <h1 className="display mt-5 text-3xl">Admin access</h1>
        <p className="mt-1 text-sm text-muted">Enter the admin password to manage data.</p>
        <input
          type="password"
          autoFocus
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          placeholder="Password"
          className={cn("input mt-6 text-center", shake > 0 && "border-loss/60")}
        />
        {shake > 0 && <p className="mt-2 text-xs text-loss">Incorrect password</p>}
        <Button type="submit" variant="primary" className="mt-4 w-full">
          Unlock
        </Button>
      </motion.form>
    </div>
  );
}

function KFactor({ data }: { data: Analytics }) {
  const [k, setK] = useState(data.k);
  const update = useUpdateKFactor();
  const dirty = k !== data.k;

  useEffect(() => {
    if (!dirty) return;
    const t = setTimeout(() => {
      update.mutate(k, {
        onSuccess: () => toast.success(`K-factor set to ${k}`, { description: "Ratings recalculated for everyone." }),
        onError: (e) => toast.error("Couldn't save K-factor", { description: e.message }),
      });
    }, 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [k]);

  const preview = useMemo(() => {
    const engine = runElo(data.players, data.clubs, data.matches, k);
    const sorted = [...data.players].sort((a, b) => (engine.ratings.get(b.id) ?? 0) - (engine.ratings.get(a.id) ?? 0));
    const rank = new Map(sorted.map((p, i) => [p.id, i + 1]));
    return data.ranking.map((p) => ({
      p,
      elo: Math.round(engine.ratings.get(p.id) ?? 1000),
      rank: rank.get(p.id) ?? p.rank,
    }));
  }, [data, k]);

  return (
    <Panel
      title="Elo sensitivity"
      subtitle="K-factor controls how far ratings move per match"
      icon={<Gauge className="size-4" />}
      action={
        <Pill tone={update.isPending ? "draw" : dirty ? "neutral" : "win"}>
          {update.isPending ? "Saving…" : dirty ? "Pending" : (
            <>
              <Check className="size-3" /> Saved
            </>
          )}
        </Pill>
      }
    >
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
            <span>64 · volatile</span>
          </div>
        </div>
      </div>
      <div className="hairline my-5" />
      <p className="label mb-3">{dirty ? `Preview at K ${k} vs live K ${data.k}` : "Live ratings"}</p>
      <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
        {[...preview].sort((a, b) => a.rank - b.rank).map(({ p, elo, rank }) => (
          <div key={p.id} className="flex items-center gap-2.5 text-sm">
            <span className="display tabular w-5 text-faint">{rank}</span>
            <Avatar name={p.name} size="xs" />
            <span className="flex-1 truncate">{displayName(p.name)}</span>
            {dirty && <RankMove value={p.rank - rank} />}
            <span className="tabular w-12 text-right font-semibold">{elo}</span>
            {dirty && <Delta value={elo - p.elo} className="w-10 justify-end" />}
          </div>
        ))}
      </div>
    </Panel>
  );
}

function PlayersAdmin({ data }: { data: Analytics }) {
  const del = useDeletePlayer();
  const [target, setTarget] = useState<{ id: number; name: string } | null>(null);
  return (
    <Panel
      title="Players"
      subtitle={`${data.players.length} on the roster`}
      icon={<Users className="size-4" />}
      action={<AddPlayer players={data.players} />}
      bodyClassName="p-2"
    >
      <ul>
        {[...data.players].sort((a, b) => a.name.localeCompare(b.name)).map((p) => {
          const played = data.stats.get(cleanName(p.name))?.played ?? 0;
          return (
            <li key={p.id} className="group flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-surface-2/60">
              <Avatar name={p.name} size="sm" />
              <span className="flex-1 text-sm font-medium">{displayName(p.name)}</span>
              <span className="tabular text-xs text-muted">{played} matches</span>
              <Button size="sm" variant="ghost" className="text-loss opacity-60 group-hover:opacity-100" onClick={() => setTarget(p)} aria-label={`Delete ${p.name}`}>
                <Trash2 className="size-4" />
              </Button>
            </li>
          );
        })}
      </ul>
      <ConfirmDialog
        open={!!target}
        onClose={() => setTarget(null)}
        loading={del.isPending}
        title={`Remove ${target ? displayName(target.name) : ""}?`}
        description="Their past matches stay in the history, but they'll drop out of ratings and the roster."
        onConfirm={async () => {
          if (!target) return;
          try {
            await del.mutateAsync(target.id);
            toast.success(`${displayName(target.name)} removed`);
          } catch (e) {
            toast.error("Couldn't remove player", { description: (e as Error).message });
          }
          setTarget(null);
        }}
      />
    </Panel>
  );
}

function MatchesAdmin({ data }: { data: Analytics }) {
  const del = useDeleteMatch();
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(25);
  const [target, setTarget] = useState<ParsedMatch | null>(null);
  const filtered = data.parsed.filter((m) => {
    const s = q.trim().toLowerCase();
    if (!s) return true;
    return [m.clubA, m.clubB, ...m.teamA, ...m.teamB].some((x) => x.toLowerCase().includes(s));
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
              {target.clubA} {target.scoreA}–{target.scoreB} {target.clubB} on {formatDateTime(target.date)}. Elo will be recalculated without it.
            </>
          )
        }
        onConfirm={async () => {
          if (!target) return;
          try {
            await del.mutateAsync(target.id);
            toast.success("Match deleted");
          } catch (e) {
            toast.error("Couldn't delete match", { description: (e as Error).message });
          }
          setTarget(null);
        }}
      />
    </Panel>
  );
}

export default function Admin() {
  const [unlocked, setUnlocked] = useSessionState("fm-admin", false);
  if (!unlocked) return <Gate onUnlock={() => setUnlocked(true)} />;
  return (
    <DataGate>
      {(data) => (
        <div className="space-y-6">
          <PageHeader
            eyebrow="Admin"
            title="Control Room"
            description="Tune the rating system and clean up data. Changes apply for everyone immediately."
            actions={
              <Button variant="ghost" onClick={() => setUnlocked(false)}>
                <LogOut className="size-4" /> Lock
              </Button>
            }
          />
          <div className="grid gap-6 xl:grid-cols-12">
            <div className="min-w-0 space-y-6 xl:col-span-7">
              <KFactor data={data} />
              <MatchesAdmin data={data} />
            </div>
            <div className="min-w-0 xl:col-span-5">
              <PlayersAdmin data={data} />
            </div>
          </div>
        </div>
      )}
    </DataGate>
  );
}
