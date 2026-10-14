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
import { NewPlayers, RankingRow } from "../components/ranking/Ranking";
import { useT } from "../hooks/useI18n";
import { defineMessages } from "../lib/i18n";

type Tab = "players" | "clubs" | "duos";
type View = "ranking" | "points";
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

const RANGES: Exclude<Range, "custom">[] = ["7", "30", "90", "365", "all"];

const msg = defineMessages({
  en: {
    r7: "7D",
    r30: "30D",
    r90: "90D",
    r365: "1Y",
    rall: "All",
    winsPct: "{pct}% wins",
    matches: "{n} match|{n} matches",
    gd: "{gd} GD",
    goals: "{n} goal|{n} goals",
    elo: "{elo} Elo",
    pts: "{n} pts",
    eyebrow: "Standings",
    title: "League Table",
    ranking: "Elo ranking",
    points: "Points table",
    rankingDescription:
      "Ranked by Elo, which weighs who you beat and with which club. New players join after {n} matches.",
    description: "Three points for a win, one for a draw. Elo and form are all-time; everything else follows the date range.",
    players: "Players",
    clubs: "Clubs",
    duos: "Duos",
    minGames: "Min. games",
    empty: "No matches in this range",
    emptyHint: "Try a wider date range or lower the minimum games.",
    player: "Player",
    club: "Club",
    duo: "Duo",
    colElo: "Elo",
    colForm: "Form",
    colMp: "MP",
    colW: "W",
    colD: "D",
    colL: "L",
    colGf: "GF",
    colGa: "GA",
    colGd: "GD",
    colWin: "Win %",
    colPts: "Pts",
  },
  tr: {
    r7: "7G",
    r30: "30G",
    r90: "90G",
    r365: "1Y",
    rall: "Tümü",
    winsPct: "%{pct} galibiyet",
    matches: "{n} maç|{n} maç",
    gd: "{gd} averaj",
    goals: "{n} gol|{n} gol",
    elo: "{elo} Elo",
    pts: "{n} puan",
    eyebrow: "Puan durumu",
    title: "Lig Tablosu",
    ranking: "Elo sıralaması",
    points: "Puan tablosu",
    rankingDescription:
      "Elo'ya göre: kimi, hangi kulüple yendiğin sayılır. Yeni oyuncular {n} maçtan sonra girer.",
    description: "Galibiyet üç, beraberlik bir puan. Elo ve form tüm zamanlara göre; geri kalan her şey seçilen tarih aralığına göre.",
    players: "Oyuncular",
    clubs: "Kulüpler",
    duos: "İkililer",
    minGames: "En az maç",
    empty: "Bu aralıkta maç yok",
    emptyHint: "Tarih aralığını genişlet ya da en az maç sayısını düşür.",
    player: "Oyuncu",
    club: "Kulüp",
    duo: "İkili",
    colElo: "Elo",
    colForm: "Form",
    colMp: "O",
    colW: "G",
    colD: "B",
    colL: "M",
    colGf: "AG",
    colGa: "YG",
    colGd: "AV",
    colWin: "Gal. %",
    colPts: "P",
  },
});

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

interface PodiumItem {
  key: string;
  label: string;
  entity: ReactNode;
  value: ReactNode;
  to?: string;
}

const MEDALS = [
  { rank: 2, height: "h-24", text: "text-silver", block: "border-silver/25 from-silver/15 to-silver/[0.03]" },
  { rank: 1, height: "h-32", text: "text-accent-text", block: "border-accent/30 from-accent/20 to-accent/[0.03]" },
  { rank: 3, height: "h-20", text: "text-bronze", block: "border-bronze/25 from-bronze/15 to-bronze/[0.03]" },
];

/** The top three on pedestals: second, first, third. */
function Podium({ items }: { items: PodiumItem[] }) {
  const order = [items[1], items[0], items[2]];
  return (
    <div className="grid grid-cols-3 items-end gap-3 sm:gap-5">
      {order.map((r, i) =>
        r ? (
          <motion.div
            key={r.key}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: [0.15, 0, 0.3][i], type: "spring", bounce: 0.3 }}
            className="flex min-w-0 flex-col items-center text-center"
          >
            {MEDALS[i].rank === 1 && (
              <Crown className="mb-1.5 size-6 fill-accent-text text-accent-text drop-shadow-[0_0_12px_var(--accent)]" />
            )}
            <div className="mb-2.5">{r.entity}</div>
            {r.to ? (
              <BoardLink to={r.to} className="max-w-full truncate text-sm font-semibold hover:underline">
                {r.label}
              </BoardLink>
            ) : (
              <span className="max-w-full truncate text-sm font-semibold">{r.label}</span>
            )}
            <div className="mt-1">{r.value}</div>
            <div
              className={cn(
                "mt-3 grid w-full place-items-center rounded-t-2xl border border-b-0 bg-gradient-to-b",
                MEDALS[i].height,
                MEDALS[i].block,
              )}
            >
              <span className={cn("display text-5xl", MEDALS[i].text)}>{MEDALS[i].rank}</span>
            </div>
          </motion.div>
        ) : (
          <div key={i} />
        ),
      )}
    </div>
  );
}

const PODIUM_RINGS = [
  "size-20 text-3xl ring-[3px] ring-accent ring-offset-4 ring-offset-surface shadow-[0_12px_40px_-6px_var(--accent)]",
  "ring-2 ring-silver ring-offset-[3px] ring-offset-surface",
  "ring-2 ring-bronze ring-offset-[3px] ring-offset-surface",
];

/** Players by Elo: the top three on the podium, the rest in a list, new players folded at the end. */
function EloRanking({ data }: { data: Analytics }) {
  const ranked = data.ranking.filter((p) => !p.provisional);
  const fresh = data.ranking.filter((p) => p.provisional);
  const items: PodiumItem[] = ranked.slice(0, 3).map((p, i) => ({
    key: p.name,
    label: displayName(p.name),
    to: `/players/${encodeURIComponent(p.name)}`,
    entity: <Avatar name={p.name} size="lg" className={PODIUM_RINGS[i]} />,
    value: <span className={cn("display tabular text-2xl", i === 0 && "text-accent-text")}>{p.elo}</span>,
  }));
  const rest = ranked.slice(3);
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
      <Panel className="overflow-hidden lg:col-span-7" bodyClassName="px-4 pt-8 pb-0 sm:px-10">
        <div className="mx-auto max-w-xl">
          <Podium items={items} />
        </div>
      </Panel>
      {(rest.length > 0 || fresh.length > 0) && (
        <Panel className="lg:col-span-5" bodyClassName="px-2 py-3">
          <ol>
            {rest.map((p, i) => (
              <motion.li
                key={p.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 * Math.min(i, 10) }}
              >
                <RankingRow player={p} rankedAfter={data.rankedAfter} />
              </motion.li>
            ))}
          </ol>
          <NewPlayers players={fresh} rankedAfter={data.rankedAfter} />
        </Panel>
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
  const t = useT(msg);
  const [tab, setTab] = useSessionState<Tab>("st-tab", "players");
  const [playersView, setPlayersView] = useSessionState<View>("st-view", "ranking");
  const view: View = tab === "players" ? playersView : "points";
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
        return t("winsPct", { pct: n(r.win_percentage).toFixed(0) });
      case "played":
        return t("matches", { n: r.total_matches });
      case "gd": {
        const gd = n(r.goals_forwarded) - n(r.goals_accepted);
        return t("gd", { gd: `${gd > 0 ? "+" : ""}${gd}` });
      }
      case "gf":
        return t("goals", { n: r.goals_forwarded });
      case "elo":
        return t("elo", { elo: r.elo ?? "—" });
      default:
        return t("pts", { n: r.points });
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={view === "ranking" ? t("rankingDescription", { n: data.rankedAfter }) : t("description")}
        actions={
          view === "points" && (
            <div className="flex flex-wrap items-center gap-2">
              <Segmented<Range> value={range} onChange={setRange} options={[...RANGES.map((r) => ({ value: r, label: t(`r${r}`) })), { value: "custom", label: <CalendarRange className="size-4" /> }]} size="sm" />
              {range === "custom" && (
                <input type="date" value={custom} onChange={(e) => setCustom(e.target.value)} className="input h-9 w-auto" />
              )}
            </div>
          )
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
            { value: "players", label: t("players") },
            { value: "duos", label: t("duos") },
            { value: "clubs", label: t("clubs") },
          ]}
        />
        {tab === "players" && (
          <Segmented<View>
            value={playersView}
            onChange={setPlayersView}
            size="sm"
            options={[
              { value: "ranking", label: t("ranking") },
              { value: "points", label: t("points") },
            ]}
          />
        )}
        {view === "points" && (
          <div className="ml-auto flex items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2">
            <span className="text-xs whitespace-nowrap text-muted">{t("minGames")}</span>
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
        )}
      </div>

      {view === "ranking" ? (
        <EloRanking data={data} />
      ) : q.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-56 rounded-2xl" />
          <Skeleton className="h-96 rounded-2xl" />
        </div>
      ) : !visible.length ? (
        <div className="card">
          <EmptyState icon={<Trophy className="size-5" />} title={t("empty")} description={t("emptyHint")} />
        </div>
      ) : (
        <>
          <Panel className="overflow-hidden" bodyClassName="px-4 pt-8 pb-0 sm:px-10">
            <div className="mx-auto max-w-2xl">
              <Podium
                items={visible.slice(0, 3).map((r) => ({
                  key: r.key,
                  label: r.label,
                  entity: r.entity,
                  to: r.to,
                  value: <p className="text-xs text-muted">{metricLabel(r)}</p>,
                }))}
              />
            </div>
          </Panel>

          <section className={cn("card overflow-hidden transition-opacity", q.isFetching && "opacity-70")}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-sm">
                <thead className="border-b border-line bg-surface-2/50">
                  <tr>
                    <th className="w-12 px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-faint">#</th>
                    <th className="sticky left-0 z-10 bg-surface-2 px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-faint sm:bg-transparent">
                      {tab === "players" ? t("player") : tab === "clubs" ? t("club") : t("duo")}
                    </th>
                    {tab !== "duos" && (
                      <Th sort="elo" active={effectiveSort} onSort={setSort}>
                        {t("colElo")}
                      </Th>
                    )}
                    {tab === "players" && <Th className="text-left">{t("colForm")}</Th>}
                    <Th sort="played" active={effectiveSort} onSort={setSort}>
                      {t("colMp")}
                    </Th>
                    <Th>{t("colW")}</Th>
                    <Th>{t("colD")}</Th>
                    <Th>{t("colL")}</Th>
                    <Th sort="gf" active={effectiveSort} onSort={setSort}>
                      {t("colGf")}
                    </Th>
                    <Th>{t("colGa")}</Th>
                    <Th sort="gd" active={effectiveSort} onSort={setSort}>
                      {t("colGd")}
                    </Th>
                    <Th sort="win" active={effectiveSort} onSort={setSort} className="w-36">
                      {t("colWin")}
                    </Th>
                    <Th sort="points" active={effectiveSort} onSort={setSort} className="pr-5">
                      {t("colPts")}
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
