import { motion } from "motion/react";
import type { ReactNode } from "react";
import { HeartHandshake, Shield, Swords, Users } from "lucide-react";
import { scoreRate, type DuoProfile, type VsRecord } from "../../lib/analysis";
import type { EloEngine } from "../../lib/elo";
import { cn } from "../../lib/cn";
import { displayName } from "../../lib/format";
import { BoardLink } from "../board/BoardLink";
import { MatchCard } from "../match/MatchCard";
import { Avatar, ClubCrest } from "../ui/Identity";
import { EmptyState } from "../ui/primitives";
import { RecordStrip } from "./RecordStrip";

function Stat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface-2/50 p-4">
      <p className="label">{label}</p>
      <p className={cn("display mt-2 text-3xl", tone)}>{value}</p>
      {hint && <p className="mt-1 text-[11px] text-muted">{hint}</p>}
    </div>
  );
}

function VsList({
  title,
  icon,
  rows,
  render,
  empty,
}: {
  title: string;
  icon: ReactNode;
  rows: VsRecord[];
  render: (row: VsRecord) => ReactNode;
  empty: string;
}) {
  return (
    <div className="min-w-0">
      <p className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <span className="text-accent-text">{icon}</span>
        {title}
      </p>
      {rows.length ? (
        <ul className="space-y-2.5">
          {rows.map((r) => (
            <li key={r.key} className="flex items-center gap-3">
              <div className="flex w-28 min-w-0 shrink-0 items-center gap-2 sm:w-48">{render(r)}</div>
              <RecordStrip record={r.record} className="min-w-0 flex-1" />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">{empty}</p>
      )}
    </div>
  );
}

const pair = (names: string[]) => (
  <>
    <span className="flex shrink-0 -space-x-2">
      {names.map((n) => (
        <Avatar key={n} name={n} size="xs" className="ring-2 ring-surface" />
      ))}
    </span>
    <span className="truncate text-sm">{names.map(displayName).join(" & ")}</span>
  </>
);

export function DuoExplorer({
  duos,
  selected,
  onSelect,
  engine,
}: {
  duos: DuoProfile[];
  selected: DuoProfile | undefined;
  onSelect: (key: string) => void;
  engine: EloEngine;
}) {
  if (!duos.length)
    return <EmptyState icon={<Users className="size-5" />} title="No duos yet" description="Play some 2v2 matches first." />;
  const d = selected ?? duos[0];
  const perGame = (n: number) => (d.record.played ? n / d.record.played : 0).toFixed(1);
  return (
    <div>
      <select
        value={d.key}
        onChange={(e) => onSelect(e.target.value)}
        className="input mb-6 h-11 sm:max-w-sm"
        aria-label="Choose a duo"
      >
        {duos.map((x) => (
          <option key={x.key} value={x.key}>
            {x.names.map(displayName).join(" & ")} · {x.record.played} games
          </option>
        ))}
      </select>

      <motion.div key={d.key} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="flex -space-x-5">
            {d.names.map((n) => (
              <BoardLink key={n} to={`/players/${encodeURIComponent(n)}`}>
                <Avatar name={n} size="xl" className="ring-4 ring-surface" />
              </BoardLink>
            ))}
          </div>
          <div className="min-w-0">
            <p className="display text-4xl">{d.names.map(displayName).join(" & ")}</p>
            <RecordStrip record={d.record} className="mt-2 max-w-xs" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Games" value={d.record.played} hint={`${perGame(d.record.gf)} scored · ${perGame(d.record.ga)} conceded per game`} />
          <Stat label="Points taken" value={`${Math.round(scoreRate(d.record))}%`} hint="win 1, draw ½" />
          <Stat
            label="Elo together"
            value={`${d.record.delta >= 0 ? "+" : "−"}${Math.abs(Math.round(d.record.delta))}`}
            tone={d.record.delta >= 0 ? "text-win" : "text-loss"}
            hint="each, over all their games"
          />
          <Stat
            label="Chemistry"
            value={d.chemistry === null ? "—" : `${d.chemistry >= 0 ? "+" : "−"}${Math.abs(Math.round(d.chemistry))}`}
            tone={d.chemistry === null ? undefined : d.chemistry >= 0 ? "text-win" : "text-loss"}
            hint={d.chemistry === null ? "needs 3+ games together and apart" : "points-% vs their games apart"}
          />
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          <VsList
            title="When this player is on the other side"
            icon={<Swords className="size-4" />}
            rows={d.vsPlayers}
            empty="No opponents yet."
            render={(r) => (
              <BoardLink to={`/players/${encodeURIComponent(r.key)}`} className="flex min-w-0 items-center gap-2 hover:text-accent-text">
                <Avatar name={r.key} size="xs" />
                <span className="truncate text-sm">{displayName(r.key)}</span>
              </BoardLink>
            )}
          />
          <VsList
            title="Against other duos"
            icon={<HeartHandshake className="size-4" />}
            rows={d.vsDuos}
            empty="Hasn't met another duo yet."
            render={(r) => (
              <button onClick={() => onSelect(r.key)} className="flex min-w-0 items-center gap-2 text-left hover:text-accent-text">
                {pair(r.names)}
              </button>
            )}
          />
        </div>

        <div>
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Shield className="size-4 text-accent-text" /> Their clubs
          </p>
          <div className="flex flex-wrap gap-2">
            {d.clubs.slice(0, 8).map((c) => (
              <span key={c.key} className="inline-flex items-center gap-2 rounded-full border border-line bg-surface-2 py-1 pr-3 pl-1.5 text-xs">
                <ClubCrest name={c.key} size="xs" />
                {c.key}
                <span className="tabular text-muted">
                  {c.record.wins}-{c.record.draws}-{c.record.losses}
                </span>
              </span>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-3 text-sm font-semibold">Latest together</p>
          <div className="space-y-2">
            {d.matches.slice(0, 3).map((m) => (
              <MatchCard key={m.id} match={m} elo={engine.perMatch.get(m.id)} perspective={d.names[0]} className="shadow-none" />
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
