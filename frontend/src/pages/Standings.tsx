import { motion } from "motion/react";
import { useMemo, useState, type ReactNode } from "react";
import { ArrowDownWideNarrow, CalendarRange, Crown, Trophy } from "lucide-react";
import { DataGate } from "../components/DataGate";
import { PageHeader } from "../components/layout/AppShell";
import { Avatar, ClubCrest, Stars } from "../components/ui/Identity";
import { EmptyState, FormPills, Panel, RankMove, Segmented, Skeleton } from "../components/ui/primitives";
import type { Analytics } from "../hooks/analytics-context";
import { useClubStandings, useDuoStandings, usePlayerStandings } from "../hooks/useData";
import { useSessionState } from "../hooks/useSessionState";
import { cn } from "../lib/cn";
import { clubStars } from "../lib/elo";
import { cleanName, daysAgoIso, displayName } from "../lib/format";
import type { StandingStats } from "../lib/types";
import { BoardLink } from "../components/board/BoardLink";

type Tab = "players" | "clubs" | "duos";
type Range = "7" | "30" | "90" | "365" | "all" | "custom";
type SortKey = "points" | "win" | "played" | "gd" | "gf" | "elo";

interface Row extends StandingStats {
  key: string;
  label: string;
  entity: ReactNode;
  small: ReactNode;
  to?: string;
  elo?: number;
  extra?: ReactNode;
}

const RANGES: { value: Range; label: string }[] = [
  { value: "7", label: "7D" },
  { value: "30", label: "30D" },
  { value: "90", label: "90D" },
  { value: "365", label: "1Y" },
  { value: "all", label: "All" },
];

const n = (v: unknown) => Number(v) || 0;

function sortRows(rows: Row[], key: SortKey) {
  const val = (r: Row) =>
    key === "points"
      ? n(r.points)
      : key === "win"
        ? n(r.win_percentage)
        : key === "played"
          ? n(r.total_matches)
          : key === "gd"
            ? n(r.goals_forwarded) - n(r.goals_accepted)
            : key === "gf"
              ? n(r.goals_forwarded)
              : (r.elo ?? 0);
  return [...rows].sort(
    (a, b) =>
      val(b) - val(a) ||
      n(b.points) - n(a.points) ||
      n(b.goals_forwarded) - n(b.goals_accepted) - (n(a.goals_forwarded) - n(a.goals_accepted)),
  );
}

function Podium({ rows, metric }: { rows: Row[]; metric: (r: Row) => ReactNode }) {
  const order = [rows[1], rows[0], rows[2]];
  const heights = ["h-24", "h-32", "h-20"];
  const tones = ["text-silver", "text-gold", "text-bronze"];
  const ranks = [2, 1, 3];
  return (
    <div className="grid grid-cols-3 items-end gap-3 sm:gap-5">
      {order.map((r, i) =>
        r ? (
          <motion.div
            key={r.key}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: [0.15, 0, 0.3][i], type: "spring", bounce: 0.3 }}
            className="flex flex-col items-center text-center"
          >
            {ranks[i] === 1 && <Crown className="mb-1 size-6 text-gold drop-shadow-[0_0_12px_var(--gold)]" />}
            <div className="mb-2">{r.entity}</div>
            {r.to ? (
              <BoardLink to={r.to} className="max-w-full truncate text-sm font-semibold hover:underline">
                {r.label}
              </BoardLink>
            ) : (
              <span className="max-w-full truncate text-sm font-semibold">{r.label}</span>
            )}
            <p className="mt-0.5 text-xs text-muted">{metric(r)}</p>
            <div
              className={cn(
                "mt-3 grid w-full place-items-center rounded-t-2xl border border-b-0 border-line bg-gradient-to-b from-surface-3 to-surface-2",
                heights[i],
              )}
            >
              <span className={cn("display text-5xl", tones[i])}>{ranks[i]}</span>
            </div>
          </motion.div>
        ) : (
          <div key={i} />
        ),
      )}
    </div>
  );
}

function Th({
  children,
  sort,
  active,
  onSort,
  className,
}: {
  children: ReactNode;
  sort?: SortKey;
  active?: SortKey;
  onSort?: (k: SortKey) => void;
  className?: string;
}) {
  return (
    <th className={cn("px-3 py-3 text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap text-faint", className ?? "text-right", className && !/text-(left|center)/.test(className) && "text-right")}>
      {sort ? (
        <button
          onClick={() => onSort?.(sort)}
          className={cn("inline-flex items-center gap-1 uppercase hover:text-fg", active === sort && "text-accent-text")}
        >
          {children}
          {active === sort && <ArrowDownWideNarrow className="size-3" />}
        </button>
      ) : (
        children
      )}
    </th>
  );
}

function StandingsInner({ data }: { data: Analytics }) {
  const [tab, setTab] = useSessionState<Tab>("st-tab", "players");
  const [range, setRange] = useSessionState<Range>("st-range", "all");
  const [custom, setCustom] = useSessionState("st-custom", daysAgoIso(30));
  const [sort, setSort] = useSessionState<SortKey>("st-sort", "points");
  const [minGames, setMinGames] = useState(tab === "duos" ? 3 : 0);

  const start = range === "custom" ? custom : range === "all" ? "2000-01-01" : daysAgoIso(Number(range));
  const players = usePlayerStandings(start);
  const clubs = useClubStandings(start);
  const duos = useDuoStandings(start);
  const q = tab === "players" ? players : tab === "clubs" ? clubs : duos;

  const rows: Row[] = useMemo(() => {
    if (tab === "players")
      return (players.data ?? []).map((r) => {
        const rp = data.byName.get(cleanName(r.name));
        return {
          ...r,
          key: r.name,
          label: displayName(r.name),
          entity: <Avatar name={r.name} size="lg" />,
          small: <Avatar name={r.name} size="sm" />,
          to: `/players/${encodeURIComponent(r.name)}`,
          elo: rp?.elo,
          extra: rp && rp.rankDelta !== 0 ? <RankMove value={rp.rankDelta} hideZero /> : null,
        };
      });
    if (tab === "clubs")
      return (clubs.data ?? []).map((r) => {
        const club = data.clubs.find((c) => c.name === r.club);
        return {
          ...r,
          key: r.club,
          label: r.club,
          entity: <ClubCrest name={r.club} size="xl" />,
          small: <ClubCrest name={r.club} size="sm" />,
          elo: club?.elo ?? undefined,
          extra: club ? <Stars value={clubStars(club.elo)} /> : null,
        };
      });
    return (duos.data ?? []).map((r) => {
      const names = r.duo.split(" & ");
      return {
        ...r,
        key: r.duo,
        label: names.map(displayName).join(" & "),
        entity: (
          <span className="flex -space-x-3">
            {names.map((x) => (
              <Avatar key={x} name={x} size="lg" className="ring-4 ring-surface" />
            ))}
          </span>
        ),
        small: (
          <span className="flex -space-x-2">
            {names.map((x) => (
              <Avatar key={x} name={x} size="sm" className="ring-2 ring-surface" />
            ))}
          </span>
        ),
        to: names.length === 2 ? `/h2h?a=${encodeURIComponent(names[0])}&b=${encodeURIComponent(names[1])}` : undefined,
      };
    });
  }, [tab, players.data, clubs.data, duos.data, data]);

  const effectiveSort: SortKey = sort === "elo" && tab === "duos" ? "points" : sort;
  const visible = sortRows(rows.filter((r) => n(r.total_matches) >= minGames), effectiveSort);
  const maxGames = Math.max(1, ...rows.map((r) => n(r.total_matches)));

  const metricLabel = (r: Row) => {
    switch (effectiveSort) {
      case "win":
        return `${n(r.win_percentage).toFixed(0)}% wins`;
      case "played":
        return `${r.total_matches} matches`;
      case "gd": {
        const gd = n(r.goals_forwarded) - n(r.goals_accepted);
        return `${gd > 0 ? "+" : ""}${gd} GD`;
      }
      case "gf":
        return `${r.goals_forwarded} goals`;
      case "elo":
        return `${r.elo ?? "—"} Elo`;
      default:
        return `${r.points} pts`;
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Standings"
        title="League Table"
        description="Three points for a win, one for a draw. Elo and form are all-time; everything else follows the date range."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Segmented<Range> value={range} onChange={setRange} options={[...RANGES, { value: "custom", label: <CalendarRange className="size-4" /> }]} size="sm" />
            {range === "custom" && (
              <input type="date" value={custom} onChange={(e) => setCustom(e.target.value)} className="input h-9 w-auto" />
            )}
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <Segmented<Tab>
          value={tab}
          onChange={(t) => {
            setTab(t);
            setMinGames(t === "duos" ? 3 : 0);
          }}
          options={[
            { value: "players", label: "Players" },
            { value: "clubs", label: "Clubs" },
            { value: "duos", label: "Duos" },
          ]}
        />
        <div className="ml-auto flex items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2">
          <span className="text-xs whitespace-nowrap text-muted">Min. games</span>
          <input
            type="range"
            min={0}
            max={Math.min(20, maxGames)}
            value={minGames}
            onChange={(e) => setMinGames(Number(e.target.value))}
            className="range w-28"
            style={{ ["--fill" as string]: `${(minGames / Math.max(1, Math.min(20, maxGames))) * 100}%` }}
          />
          <span className="tabular w-5 text-right text-sm font-semibold">{minGames}</span>
        </div>
      </div>

      {q.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-56 rounded-2xl" />
          <Skeleton className="h-96 rounded-2xl" />
        </div>
      ) : !visible.length ? (
        <div className="card">
          <EmptyState icon={<Trophy className="size-5" />} title="No matches in this range" description="Try a wider date range or lower the minimum games." />
        </div>
      ) : (
        <>
          <Panel className="overflow-hidden" bodyClassName="px-4 pt-8 pb-0 sm:px-10">
            <div className="mx-auto max-w-2xl">
              <Podium rows={visible.slice(0, 3)} metric={metricLabel} />
            </div>
          </Panel>

          <section className={cn("card overflow-hidden transition-opacity", q.isFetching && "opacity-70")}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-sm">
                <thead className="border-b border-line bg-surface-2/50">
                  <tr>
                    <th className="w-12 px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-faint">#</th>
                    <th className="sticky left-0 z-10 bg-surface-2 px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-faint sm:bg-transparent">
                      {tab === "players" ? "Player" : tab === "clubs" ? "Club" : "Duo"}
                    </th>
                    {tab !== "duos" && (
                      <Th sort="elo" active={effectiveSort} onSort={setSort}>
                        Elo
                      </Th>
                    )}
                    {tab === "players" && <Th className="text-left">Form</Th>}
                    <Th sort="played" active={effectiveSort} onSort={setSort}>
                      MP
                    </Th>
                    <Th>W</Th>
                    <Th>D</Th>
                    <Th>L</Th>
                    <Th sort="gf" active={effectiveSort} onSort={setSort}>
                      GF
                    </Th>
                    <Th>GA</Th>
                    <Th sort="gd" active={effectiveSort} onSort={setSort}>
                      GD
                    </Th>
                    <Th sort="win" active={effectiveSort} onSort={setSort} className="w-36">
                      Win %
                    </Th>
                    <Th sort="points" active={effectiveSort} onSort={setSort} className="pr-5">
                      Pts
                    </Th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((r, i) => {
                    const gd = n(r.goals_forwarded) - n(r.goals_accepted);
                    const win = n(r.win_percentage);
                    const form = tab === "players" ? data.byName.get(cleanName(r.key))?.stats?.outcomes : undefined;
                    return (
                      <motion.tr
                        key={r.key}
                        layout
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: Math.min(i, 15) * 0.02 }}
                        className="group border-b border-line/60 last:border-0 hover:bg-surface-2/60"
                      >
                        <td className="px-3 py-3">
                          <span
                            className={cn(
                              "display tabular text-lg",
                              i === 0 ? "text-gold" : i === 1 ? "text-silver" : i === 2 ? "text-bronze" : "text-faint",
                            )}
                          >
                            {i + 1}
                          </span>
                        </td>
                        <td className="sticky left-0 z-10 bg-surface px-3 py-3 group-hover:bg-surface-2 sm:bg-transparent sm:group-hover:bg-transparent">
                          <div className="flex items-center gap-3">
                            {r.small}
                            <div className="min-w-0">
                              {r.to ? (
                                <BoardLink to={r.to} className="block truncate font-semibold hover:underline">
                                  {r.label}
                                </BoardLink>
                              ) : (
                                <span className="block truncate font-semibold">{r.label}</span>
                              )}
                              {r.extra && <span className="mt-0.5 block">{r.extra}</span>}
                            </div>
                          </div>
                        </td>
                        {tab !== "duos" && <td className="tabular px-3 py-3 text-right font-semibold">{r.elo ?? "—"}</td>}
                        {tab === "players" && (
                          <td className="px-3 py-3">
                            <FormPills outcomes={form ?? []} size="sm" />
                          </td>
                        )}
                        <td className="tabular px-3 py-3 text-right text-muted">{r.total_matches}</td>
                        <td className="tabular px-3 py-3 text-right text-win">{r.wins}</td>
                        <td className="tabular px-3 py-3 text-right text-draw">{r.draws}</td>
                        <td className="tabular px-3 py-3 text-right text-loss">{r.losses}</td>
                        <td className="tabular px-3 py-3 text-right text-muted">{r.goals_forwarded}</td>
                        <td className="tabular px-3 py-3 text-right text-muted">{r.goals_accepted}</td>
                        <td className={cn("tabular px-3 py-3 text-right font-medium", gd > 0 ? "text-win" : gd < 0 ? "text-loss" : "text-muted")}>
                          {gd > 0 ? "+" : ""}
                          {gd}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-3">
                              <div className="h-full rounded-full bg-accent" style={{ width: `${win}%` }} />
                            </div>
                            <span className="tabular w-11 text-right">{win.toFixed(0)}%</span>
                          </div>
                        </td>
                        <td className="px-3 py-3 pr-5 text-right">
                          <span className="display tabular text-xl">{r.points}</span>
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

export default function Standings() {
  return <DataGate>{(data) => <StandingsInner data={data} />}</DataGate>;
}
