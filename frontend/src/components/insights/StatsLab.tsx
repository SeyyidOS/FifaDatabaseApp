import { ArrowDown, ArrowUp, BarChart3 } from "lucide-react";
import { useMemo, useState } from "react";
import type { Analytics } from "../../hooks/analytics-context";
import { useT } from "../../hooks/useI18n";
import { cn } from "../../lib/cn";
import { displayName } from "../../lib/format";
import { defineMessages } from "../../lib/i18n";
import {
  formatMetric,
  groupAverage,
  METRICS,
  metricValue,
  playerStatLines,
  type MetricDef,
  type MetricKey,
  type PlayerStatLine,
} from "../../lib/matchStats";
import { BoardLink } from "../board/BoardLink";
import { statMessages } from "../match/messages";
import { Avatar } from "../ui/Identity";
import { Panel } from "../ui/primitives";

const m = defineMessages({
  en: {
    lab: "Stats lab",
    labSub: "From the summary screens of {n} matches · a side's numbers count for both its players",
    player: "Player",
    matches: "Matches",
    few: "Fewer than {n} matches: read with care",
    profile: "Match stats",
    profileSub: "Per match, from {n} matches with stats · group average beside it",
    avg: "group {v}",
  },
  tr: {
    lab: "İstatistik laboratuvarı",
    labSub: "{n} maçın özet ekranından · bir tarafın sayıları iki oyuncusuna da yazılır",
    player: "Oyuncu",
    matches: "Maç",
    few: "{n} maçtan az: temkinli oku",
    profile: "Maç istatistikleri",
    profileSub: "Maç başına, istatistiği olan {n} maçtan · yanında grup ortalaması",
    avg: "grup {v}",
  },
});

/** Below this many matches with stats a player's figures are shown faint. */
const SOLID_AT = 3;

const useLines = (data: Analytics) => useMemo(() => [...playerStatLines(data.parsed).values()], [data.parsed]);

const isBetter = (def: MetricDef, a: number, b: number) => (def.better === "high" ? a > b : a < b);

/** Every player's per-match figures from the stats, sortable by any column. */
export function StatsLab({ data }: { data: Analytics }) {
  const t = useT(m);
  const ts = useT(statMessages);
  const all = useLines(data);
  const lines = all.filter((l) => data.byName.get(l.name) && !data.byName.get(l.name)!.archived);
  const [sort, setSort] = useState<MetricKey>("xg");
  const [desc, setDesc] = useState(true);
  const statMatches = data.parsed.filter((p) => p.stats).length;
  if (!lines.length) return null;

  const def = METRICS.find((d) => d.key === sort)!;
  const sorted = [...lines].sort((a, b) => {
    const va = metricValue(a, sort);
    const vb = metricValue(b, sort);
    if (va === null) return 1;
    if (vb === null) return -1;
    return desc ? vb - va : va - vb;
  });
  // the best figure of each column among players with enough matches
  const best = new Map(
    METRICS.map((d) => {
      const values = lines
        .filter((l) => l.matches >= SOLID_AT)
        .map((l) => metricValue(l, d.key))
        .filter((v): v is number => v !== null);
      return [d.key, values.length ? values.reduce((x, y) => (isBetter(d, y, x) ? y : x)) : null] as const;
    }),
  );

  const header = (d: MetricDef) => {
    const on = d.key === sort;
    return (
      <th key={d.key} className="px-2 py-2 text-right font-semibold whitespace-nowrap">
        <button
          type="button"
          title={ts(`m_${d.key}Hint`)}
          onClick={() => {
            if (on) setDesc(!desc);
            else {
              setSort(d.key);
              setDesc(d.better === "high");
            }
          }}
          className={cn("inline-flex items-center gap-1 uppercase hover:text-fg", on ? "text-fg" : "text-faint")}
        >
          {ts(`m_${d.key}`)}
          {on && (desc ? <ArrowDown className="size-3" /> : <ArrowUp className="size-3" />)}
        </button>
      </th>
    );
  };

  return (
    <Panel title={t("lab")} subtitle={t("labSub", { n: statMatches })} icon={<BarChart3 className="size-4" />} bodyClassName="p-0 pb-2">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-[11px] tracking-wide">
            <tr className="border-b border-line">
              <th className="sticky left-0 z-10 bg-surface px-4 py-2 text-left font-semibold text-faint uppercase">{t("player")}</th>
              <th className="px-2 py-2 text-right font-semibold text-faint uppercase">{t("matches")}</th>
              {METRICS.map(header)}
            </tr>
          </thead>
          <tbody>
            {sorted.map((l) => (
              <tr key={l.name} className={cn("border-b border-line/50 last:border-0", l.matches < SOLID_AT && "opacity-55")} title={l.matches < SOLID_AT ? t("few", { n: SOLID_AT }) : undefined}>
                <td className="sticky left-0 z-10 bg-surface px-4 py-2">
                  <BoardLink to={`/players/${encodeURIComponent(l.name)}`} className="flex items-center gap-2 font-medium hover:text-fg">
                    <Avatar name={l.name} size="xs" />
                    <span className="whitespace-nowrap">{displayName(l.name)}</span>
                  </BoardLink>
                </td>
                <td className="tabular px-2 py-2 text-right text-muted">{l.matches}</td>
                {METRICS.map((d) => {
                  const v = metricValue(l, d.key);
                  const top = v !== null && l.matches >= SOLID_AT && best.get(d.key) === v;
                  return (
                    <td
                      key={d.key}
                      className={cn(
                        "tabular px-2 py-2 text-right whitespace-nowrap",
                        d.key === def.key && "bg-surface-2/50",
                        top ? "font-bold text-accent-text" : "text-muted",
                      )}
                    >
                      {formatMetric(d, v)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function MetricTile({ d, line, all }: { d: MetricDef; line: PlayerStatLine; all: PlayerStatLine[] }) {
  const t = useT(m);
  const ts = useT(statMessages);
  const v = metricValue(line, d.key);
  const group = groupAverage(all, d.key);
  const good = v !== null && group !== null && v !== group ? isBetter(d, v, group) : null;
  return (
    <div className="rounded-xl border border-line bg-surface-2/40 px-3 py-2.5" title={ts(`m_${d.key}Hint`)}>
      <p className="label truncate">{ts(`m_${d.key}`)}</p>
      <p className={cn("display tabular mt-1 text-2xl", good === true && "text-win", good === false && "text-loss")}>{formatMetric(d, v)}</p>
      <p className="tabular text-[11px] text-faint">{t("avg", { v: formatMetric(d, group) })}</p>
    </div>
  );
}

/** One player's per-match figures from the stats, each next to the group's average. */
export function PlayerStatsPanel({ data, name }: { data: Analytics; name: string }) {
  const t = useT(m);
  const all = useLines(data);
  const line = all.find((l) => l.name === name);
  if (!line) return null;
  return (
    <Panel title={t("profile")} subtitle={t("profileSub", { n: line.matches })} icon={<BarChart3 className="size-4" />}>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {METRICS.map((d) => (
          <MetricTile key={d.key} d={d} line={line} all={all} />
        ))}
      </div>
    </Panel>
  );
}
