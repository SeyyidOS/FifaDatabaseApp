import { useMemo, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { Clock, Dna, FlaskConical, Grid3x3, HeartHandshake, Medal, Scale, Swords, TrendingUp } from "lucide-react";
import { SOURCE_SERIES, type EloSourceRow } from "../components/charts/eloSources";
import { EloSourcesChart, GoalsByHourChart, OddsChart, PEAK_MIN_MATCHES, type OddsRow } from "../components/charts/InsightCharts";
import { DataGate } from "../components/DataGate";
import { AwardCard } from "../components/insights/AwardCard";
import { DuoExplorer } from "../components/insights/DuoExplorer";
import { DuoMatrix } from "../components/insights/DuoMatrix";
import { BoardLink } from "../components/board/BoardLink";
import { PageHeader } from "../components/layout/AppShell";
import { Avatar } from "../components/ui/Identity";
import { EmptyState, Panel } from "../components/ui/primitives";
import type { Analytics } from "../hooks/analytics-context";
import { useSessionState } from "../hooks/useSessionState";
import { computeAwards, duoRivalries, goalsByHour, MIN_MATCHES, type Rivalry } from "../lib/analysis";
import { displayName } from "../lib/format";
import { useT } from "../hooks/useI18n";
import { archetypeBlurb, archetypeTitle, insightMessages } from "../components/insights/messages";

function RivalryRow({ r }: { r: Rivalry }) {
  const t = useT(insightMessages);
  const { wins, draws, losses, played } = r.record;
  const w = (n: number) => `${(n / played) * 100}%`;
  const side = (names: string[], align: "left" | "right") => (
    <div className={align === "right" ? "flex min-w-0 flex-row-reverse items-center gap-2 text-right" : "flex min-w-0 items-center gap-2"}>
      <span className="flex shrink-0 -space-x-2">
        {names.map((n) => (
          <Avatar key={n} name={n} size="sm" className="ring-2 ring-surface" />
        ))}
      </span>
      <span className="truncate text-sm font-medium">{names.map(displayName).join(" & ")}</span>
    </div>
  );
  return (
    <li className="rounded-2xl border border-line bg-surface-2/40 p-4">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        {side(r.a, "left")}
        <span className="display tabular text-2xl whitespace-nowrap">
          <span className="text-team-a">{wins}</span>
          <span className="mx-1.5 text-draw">{draws}</span>
          <span className="text-team-b">{losses}</span>
        </span>
        {side(r.b, "right")}
      </div>
      <div className="mt-3 flex h-1.5 overflow-hidden rounded-full bg-surface-3">
        <span className="h-full bg-team-a" style={{ width: w(wins) }} />
        <span className="h-full bg-draw" style={{ width: w(draws) }} />
        <span className="h-full bg-team-b" style={{ width: w(losses) }} />
      </div>
      <p className="mt-2 text-center text-[11px] text-faint">
        {t("meetings", { n: played, gf: r.record.gf, ga: r.record.ga })}
      </p>
    </li>
  );
}

function InsightsInner({ data }: { data: Analytics }) {
  const t = useT(insightMessages);
  const [params, setParams] = useSearchParams();
  const [minGames, setMinGames] = useSessionState("in-min-games", 3);
  const explorer = useRef<HTMLDivElement>(null);
  const active = data.ranking.map((p) => p.name);

  const awards = useMemo(() => computeAwards(data.dna, active), [data.dna, active]);
  const sources: EloSourceRow[] = useMemo(
    () =>
      data.ranking
        .filter((p) => (data.dna.get(p.name)?.all.played ?? 0) > 0)
        .map((p) => {
          const s = data.dna.get(p.name)!.sources;
          return {
            name: p.name,
            favW: s.favourite.W,
            evenW: s.even.W,
            dogW: s.underdog.W,
            draws: s.favourite.D + s.even.D + s.underdog.D,
            dogL: s.underdog.L,
            evenL: s.even.L,
            favL: s.favourite.L,
          };
        }),
    [data],
  );
  const odds: OddsRow[] = useMemo(
    () =>
      data.ranking
        .map((p) => ({ p, d: data.dna.get(p.name) }))
        .filter(({ d }) => d && d.all.played > 0)
        .map(({ p, d }) => ({
          name: p.name,
          over: Math.round(d!.overPerformance * 10) / 10,
          expected: d!.all.expected,
          actual: d!.all.score,
          played: d!.all.played,
        }))
        .sort((a, b) => b.over - a.over),
    [data],
  );
  const duos = useMemo(() => [...data.duos].sort((a, b) => b.record.played - a.record.played), [data.duos]);
  const matrixDuos = duos.filter((d) => d.record.played >= minGames);
  const rivalries = useMemo(() => duoRivalries(data.duos).filter((r) => r.record.played >= 2).slice(0, 6), [data.duos]);
  const hours = useMemo(() => goalsByHour(data.parsed), [data.parsed]);
  const peak = hours
    .filter((h) => h.matches >= PEAK_MIN_MATCHES)
    .reduce<(typeof hours)[number] | undefined>((a, b) => (!a || b.goals / b.matches > a.goals / a.matches ? b : a), undefined);

  const selected = duos.find((d) => d.key === params.get("duo")) ?? duos[0];
  const selectDuo = (key: string, scroll = false) => {
    const next = new URLSearchParams(params);
    next.set("duo", key);
    setParams(next, { replace: true });
    if (scroll) explorer.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (data.parsed.length < 10)
    return (
      <div className="card">
        <EmptyState
          icon={<FlaskConical className="size-5" />}
          title={t("needData")}
          description={t("needDataHint", { n: data.parsed.length })}
        />
      </div>
    );

  return (
    <div className="space-y-8">
      <section>
        <div className="mb-4 flex items-center gap-2">
          <Medal className="size-4 text-gold" />
          <h2 className="text-[15px] font-semibold">{t("awards")}</h2>
          <span className="text-xs text-faint">{t("awardsHint", { n: MIN_MATCHES })}</span>
        </div>
        <div className="grid gap-4 [perspective:1000px] sm:grid-cols-2 xl:grid-cols-4">
          {awards.map((a, i) => (
            <AwardCard key={a.key} award={a} index={i} />
          ))}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-12">
        <Panel
          title={t("sources")}
          subtitle={t("sourcesSub")}
          icon={<TrendingUp className="size-4" />}
          className="lg:col-span-7"
        >
          <div className="mb-4 flex flex-wrap gap-x-4 gap-y-1.5">
            {SOURCE_SERIES.map((s) => (
              <span key={s.key} className="inline-flex items-center gap-1.5 text-[11px] text-muted">
                <span className="size-2 rounded-full" style={{ background: s.color }} />
                {t(s.label)}
              </span>
            ))}
          </div>
          <EloSourcesChart rows={sources} />
        </Panel>
        <Panel title={t("archetypes")} subtitle={t("archetypesSub")} icon={<Dna className="size-4" />} className="lg:col-span-5" bodyClassName="p-2">
          <ul>
            {data.ranking.map((p) => {
              const a = data.dna.get(p.name)?.archetype;
              if (!a) return null;
              return (
                <li key={p.id}>
                  <BoardLink to={`/players/${encodeURIComponent(p.name)}`} className="flex gap-3 rounded-xl px-3 py-2.5 hover:bg-surface-2/60">
                    <Avatar name={p.name} size="sm" />
                    <div className="min-w-0">
                      <p className="text-sm">
                        <span className="font-semibold">{displayName(p.name)}</span>
                        <span className="text-faint"> · </span>
                        <span className="font-semibold text-accent-text">{archetypeTitle(t, a)}</span>
                      </p>
                      <p className="text-xs text-muted">{archetypeBlurb(t, a)}</p>
                    </div>
                  </BoardLink>
                </li>
              );
            })}
          </ul>
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title={t("odds")} subtitle={t("oddsSub")} icon={<Scale className="size-4" />}>
          <OddsChart rows={odds} />
        </Panel>
        <Panel
          title={t("goals")}
          subtitle={peak ? t("goalsSubPeak", { hour: `${String(peak.hour).padStart(2, "0")}:00` }) : t("goalsSub")}
          icon={<Clock className="size-4" />}
        >
          <GoalsByHourChart hours={hours} />
        </Panel>
      </div>

      <div ref={explorer} className="scroll-mt-24">
        <Panel
          title={t("explorer")}
          subtitle={t("explorerSub")}
          icon={<HeartHandshake className="size-4" />}
        >
          <DuoExplorer duos={duos} selected={selected} onSelect={(k) => selectDuo(k)} engine={data.engine} />
        </Panel>
      </div>

      <Panel
        title={t("matrix")}
        subtitle={t("matrixSub")}
        icon={<Grid3x3 className="size-4" />}
        action={
          <label className="flex items-center gap-2 text-xs whitespace-nowrap text-muted">
            {t("minGames")}
            <input
              type="range"
              min={1}
              max={10}
              value={minGames}
              onChange={(e) => setMinGames(Number(e.target.value))}
              className="range w-24"
              style={{ ["--fill" as string]: `${((minGames - 1) / 9) * 100}%` }}
            />
            <span className="tabular w-4 font-semibold text-fg">{minGames}</span>
          </label>
        }
      >
        {matrixDuos.length ? (
          <DuoMatrix duos={matrixDuos} players={active} selected={selected?.key} onSelect={(k) => selectDuo(k, true)} />
        ) : (
          <p className="text-sm text-muted">{t("noDuoGames", { n: minGames })}</p>
        )}
      </Panel>

      {rivalries.length > 0 && (
        <Panel title={t("rivalries")} subtitle={t("rivalriesSub")} icon={<Swords className="size-4" />}>
          <ul className="grid gap-3 md:grid-cols-2">
            {rivalries.map((r) => (
              <RivalryRow key={`${r.a.join()}-${r.b.join()}`} r={r} />
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}

export default function Insights() {
  const t = useT(insightMessages);
  return (
    <div>
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("description")}
      />
      <DataGate>{(data) => <InsightsInner data={data} />}</DataGate>
    </div>
  );
}
