import { motion } from "motion/react";
import { useState, type ReactNode } from "react";
import { Navigate, useParams } from "react-router-dom";
import { ArrowLeft, Crosshair, Flame, HeartHandshake, Shield, Skull, Swords, Target, TrendingUp, Trophy } from "lucide-react";
import { MatchMapChart } from "../components/charts/InsightCharts";
import { DataGate } from "../components/DataGate";
import { EloDnaPanel } from "../components/insights/EloDnaPanel";
import { RecordStrip } from "../components/insights/RecordStrip";
import { PlayerEloChart } from "../components/charts/EloCharts";
import { MatchCard } from "../components/match/MatchCard";
import { PlayerCard } from "../components/PlayerCard";
import { Avatar, ClubCrest } from "../components/ui/Identity";
import { AnimatedNumber, Button, Delta, FormPills, Panel, Pill, ProgressBar, RankMove } from "../components/ui/primitives";
import type { Analytics, RankedPlayer } from "../hooks/analytics-context";
import { cn } from "../lib/cn";
import { vsDuosOf } from "../lib/analysis";
import { cleanName, displayName, relativeTime } from "../lib/format";
import { winRate, type Tally } from "../lib/stats";
import { BoardLink } from "../components/board/BoardLink";
import { useBoard } from "../hooks/useBoard";
import { useBoardNavigate } from "../hooks/useBoardNavigate";

const MIN_PAIR = 3;

function StatTile({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface-2/50 p-4">
      <p className="label">{label}</p>
      <p className={cn("display mt-2 text-3xl", tone)}>{value}</p>
      {sub && <p className="mt-1 text-xs text-muted">{sub}</p>}
    </div>
  );
}

function RelationCard({
  title,
  icon,
  name,
  record,
  tone,
  caption,
  to,
}: {
  title: string;
  icon: ReactNode;
  name?: string;
  record?: Tally;
  tone: "win" | "loss";
  caption: string;
  to?: string;
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface-2/50 p-4">
      <div className={cn("flex items-center gap-2", tone === "win" ? "text-win" : "text-loss")}>
        {icon}
        <span className="label" style={{ color: "inherit" }}>
          {title}
        </span>
      </div>
      {name && record ? (
        <BoardLink to={to ?? `/players/${encodeURIComponent(name)}`} className="mt-3 flex items-center gap-3 hover:opacity-90">
          <Avatar name={name} size="md" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{displayName(name)}</p>
            <p className="text-xs text-muted">
              {record.wins}W {record.draws}D {record.losses}L · {caption}
            </p>
          </div>
          <span className={cn("display tabular text-2xl", tone === "win" ? "text-win" : "text-loss")}>
            {winRate(record).toFixed(0)}%
          </span>
        </BoardLink>
      ) : (
        <p className="mt-3 text-sm text-muted">Not enough games yet ({MIN_PAIR}+ needed)</p>
      )}
    </div>
  );
}

function pickExtreme(map: Map<string, Tally> | undefined, best: boolean): [string, Tally] | undefined {
  if (!map) return undefined;
  const eligible = [...map.entries()].filter(([, r]) => r.played >= MIN_PAIR);
  eligible.sort((a, b) => (best ? winRate(b[1]) - winRate(a[1]) : winRate(a[1]) - winRate(b[1])) || b[1].played - a[1].played);
  return eligible[0];
}

function Profile({ data, player }: { data: Analytics; player: RankedPlayer }) {
  const [showAll, setShowAll] = useState(false);
  const navigate = useBoardNavigate();
  const s = player.stats;
  const key = cleanName(player.name);
  const matches = data.parsed.filter((m) => m.teamA.includes(key) || m.teamB.includes(key));

  const apps = data.appearances.get(key) ?? [];
  const dna = data.dna.get(key);
  const vsDuos = vsDuosOf(apps);
  const partnerBest = pickExtreme(s?.teammates, true);
  const partnerWorst = pickExtreme(s?.teammates, false);
  const victim = pickExtreme(s?.opponents, true);
  const nemesis = pickExtreme(s?.opponents, false);
  const clubs = [...(s?.clubs.entries() ?? [])].sort((a, b) => b[1].played - a[1].played).slice(0, 6);
  const teammates = [...(s?.teammates.entries() ?? [])].sort((a, b) => b[1].played - a[1].played);
  const played = s?.played ?? 0;
  const current = s?.current;

  return (
    <div className="space-y-6">
      <BoardLink to="/players" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg">
        <ArrowLeft className="size-4" /> All players
      </BoardLink>

      {/* Hero */}
      <section className="card relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 opacity-50"
          style={{
            background: `radial-gradient(40rem 20rem at 15% 30%, color-mix(in oklab, var(--accent) 12%, transparent), transparent 70%)`,
          }}
        />
        <div className="relative flex flex-col items-center gap-8 p-6 sm:p-8 lg:flex-row lg:items-center">
          <PlayerCard player={player} size="lg" />
          <div className="w-full min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              {player.archived ? <Pill>Archived</Pill> : <Pill tone="accent">#{player.rank} by Elo</Pill>}
              <RankMove value={player.rankDelta} hideZero />
              {player.provisional && <Pill>Provisional</Pill>}
              {current && current.count >= 2 && (
                <Pill tone={current.type === "W" ? "win" : current.type === "L" ? "loss" : "draw"}>
                  <Flame className="size-3" /> {current.count} {current.type === "W" ? "wins" : current.type === "L" ? "losses" : "draws"} in a row
                </Pill>
              )}
            </div>
            <h1 className="display mt-3 text-6xl sm:text-7xl">{displayName(player.name)}</h1>
            <p className="mt-2 text-sm text-muted">
              {played} matches{s?.lastPlayed && <> · last played {relativeTime(s.lastPlayed)}</>}
            </p>

            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatTile
                label="Elo"
                value={<AnimatedNumber value={player.elo} />}
                sub={
                  <span className="inline-flex items-center gap-1">
                    <Delta value={player.eloDelta} /> last matchday
                  </span>
                }
              />
              <StatTile label="Peak" value={player.peak} tone="text-gold" sub="All-time high" />
              <StatTile label="Win rate" value={`${s ? winRate(s).toFixed(0) : 0}%`} sub={`${s?.wins ?? 0}W ${s?.draws ?? 0}D ${s?.losses ?? 0}L`} />
              <StatTile
                label="Goal diff"
                value={`${(s?.gf ?? 0) - (s?.ga ?? 0) > 0 ? "+" : ""}${(s?.gf ?? 0) - (s?.ga ?? 0)}`}
                tone={(s?.gf ?? 0) >= (s?.ga ?? 0) ? "text-win" : "text-loss"}
                sub={`${played ? ((s?.gf ?? 0) / played).toFixed(1) : 0} for · ${played ? ((s?.ga ?? 0) / played).toFixed(1) : 0} against /g`}
              />
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="label">Form</span>
                <FormPills outcomes={s?.outcomes ?? []} />
              </div>
              <Button variant="secondary" className="ml-auto" onClick={() => navigate(`/h2h?a=${encodeURIComponent(player.name)}`)}>
                <Swords className="size-4" /> Compare
              </Button>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-12">
        <Panel
          title="Elo journey"
          subtitle={`${player.history.length} rated matches · K ${data.k}`}
          icon={<TrendingUp className="size-4" />}
          className="lg:col-span-8"
        >
          {player.history.length ? (
            <PlayerEloChart history={player.history} />
          ) : (
            <p className="py-16 text-center text-sm text-muted">No rated matches yet.</p>
          )}
        </Panel>
        <Panel title="Milestones" icon={<Trophy className="size-4" />} className="lg:col-span-4" bodyClassName="grid grid-cols-2 gap-3 p-5">
          <StatTile label="Best streak" value={s?.longestWin ?? 0} sub="wins in a row" />
          <StatTile label="Unbeaten" value={s?.longestUnbeaten ?? 0} sub="longest run" />
          <StatTile label="Clean sheets" value={s?.cleanSheets ?? 0} sub="0 goals conceded" />
          <StatTile
            label="Biggest win"
            value={s?.biggestWin ? `${Math.max(s.biggestWin.scoreA, s.biggestWin.scoreB)}–${Math.min(s.biggestWin.scoreA, s.biggestWin.scoreB)}` : "—"}
            sub={s?.biggestWin ? `${s.biggestWin.clubA} v ${s.biggestWin.clubB}` : undefined}
          />
        </Panel>
      </div>

      {dna && apps.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-12">
          <EloDnaPanel dna={dna} name={player.name} className="lg:col-span-7" />
          <div className="min-w-0 space-y-6 lg:col-span-5">
            <Panel
              title="Match map"
              subtitle="Each dot is a match: win probability before kick-off vs Elo won or lost"
              icon={<Crosshair className="size-4" />}
            >
              <MatchMapChart apps={apps} />
              <div className="mt-3 flex justify-center gap-4 text-[11px] text-muted">
                {(["Win", "Draw", "Loss"] as const).map((l, i) => (
                  <span key={l} className="inline-flex items-center gap-1.5">
                    <span className="size-2 rounded-full" style={{ background: ["var(--win)", "var(--draw)", "var(--loss)"][i] }} />
                    {l}
                  </span>
                ))}
              </div>
            </Panel>
            <Panel title="Against duos" subtitle="Record against each pair faced" icon={<Swords className="size-4" />}>
              {vsDuos.length ? (
                <ul className="space-y-2.5">
                  {vsDuos.slice(0, 8).map((v) => (
                    <li key={v.key} className="flex items-center gap-3">
                      <BoardLink
                        to={`/insights?duo=${encodeURIComponent(v.key)}`}
                        className="flex w-36 min-w-0 items-center gap-2 hover:text-accent-text sm:w-44"
                      >
                        <span className="flex shrink-0 -space-x-2">
                          {v.names.map((n) => (
                            <Avatar key={n} name={n} size="xs" className="ring-2 ring-surface" />
                          ))}
                        </span>
                        <span className="truncate text-sm">{v.names.map(displayName).join(" & ")}</span>
                      </BoardLink>
                      <RecordStrip record={v.record} className="flex-1" />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">No duos faced yet.</p>
              )}
            </Panel>
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <RelationCard title="Best partner" icon={<HeartHandshake className="size-4" />} name={partnerBest?.[0]} record={partnerBest?.[1]} tone="win" caption="together" />
        <RelationCard title="Worst partner" icon={<Shield className="size-4" />} name={partnerWorst?.[0]} record={partnerWorst?.[1]} tone="loss" caption="together" />
        <RelationCard
          title="Favourite victim"
          icon={<Target className="size-4" />}
          name={victim?.[0]}
          record={victim?.[1]}
          tone="win"
          caption="against"
          to={victim ? `/h2h?a=${encodeURIComponent(player.name)}&b=${encodeURIComponent(victim[0])}` : undefined}
        />
        <RelationCard
          title="Nemesis"
          icon={<Skull className="size-4" />}
          name={nemesis?.[0]}
          record={nemesis?.[1]}
          tone="loss"
          caption="against"
          to={nemesis ? `/h2h?a=${encodeURIComponent(player.name)}&b=${encodeURIComponent(nemesis[0])}` : undefined}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Partnerships" subtitle="Record with each teammate" icon={<HeartHandshake className="size-4" />}>
          <div className="space-y-3">
            {teammates.map(([name, r]) => (
              <BoardLink key={name} to={`/players/${encodeURIComponent(name)}`} className="flex items-center gap-3 rounded-lg hover:bg-surface-2/60">
                <Avatar name={name} size="sm" />
                <span className="w-24 truncate text-sm font-medium">{displayName(name)}</span>
                <ProgressBar value={winRate(r)} className="flex-1" barClassName={winRate(r) >= 50 ? "bg-win" : "bg-loss"} />
                <span className="tabular w-10 text-right text-sm">{winRate(r).toFixed(0)}%</span>
                <span className="tabular w-14 text-right text-xs text-muted">{r.played} gp</span>
              </BoardLink>
            ))}
            {!teammates.length && <p className="text-sm text-muted">No partnerships yet.</p>}
          </div>
        </Panel>
        <Panel title="Favourite clubs" subtitle="Most picked, with win rate" icon={<Shield className="size-4" />}>
          <div className="space-y-3">
            {clubs.map(([name, r]) => (
              <div key={name} className="flex items-center gap-3">
                <ClubCrest name={name} size="sm" />
                <span className="w-36 truncate text-sm font-medium">{name}</span>
                <ProgressBar value={winRate(r)} className="flex-1" barClassName={winRate(r) >= 50 ? "bg-win" : "bg-loss"} />
                <span className="tabular w-10 text-right text-sm">{winRate(r).toFixed(0)}%</span>
                <span className="tabular w-14 text-right text-xs text-muted">{r.played} gp</span>
              </div>
            ))}
            {!clubs.length && <p className="text-sm text-muted">No clubs yet.</p>}
          </div>
        </Panel>
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[15px] font-semibold">Recent matches</h2>
          <span className="text-xs text-muted">{matches.length} total</span>
        </div>
        <div className="space-y-2">
          {(showAll ? matches : matches.slice(0, 8)).map((m, i) => (
            <motion.div key={m.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 8) * 0.03 }}>
              <MatchCard match={m} elo={data.engine.perMatch.get(m.id)} perspective={key} />
            </motion.div>
          ))}
        </div>
        {matches.length > 8 && !showAll && (
          <div className="mt-4 flex justify-center">
            <Button variant="secondary" onClick={() => setShowAll(true)}>
              Show all {matches.length} matches
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}

export default function PlayerProfile() {
  const { name = "" } = useParams();
  const { path } = useBoard();
  return (
    <DataGate>
      {(data) => {
        const player = data.byName.get(cleanName(decodeURIComponent(name)));
        if (!player) return <Navigate to={path("/players")} replace />;
        return <Profile key={player.id} data={data} player={player} />;
      }}
    </DataGate>
  );
}
