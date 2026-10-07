import type { ReactNode } from "react";
import { Dna, MoonStar, RotateCcw, Scale, Shield, TrendingDown, TrendingUp } from "lucide-react";
import { scoreRate, type Appearance, type Bucket, type ClubEdge, type EloDna, type Role } from "../../lib/analysis";
import { cn } from "../../lib/cn";
import { displayName, formatDay } from "../../lib/format";
import { Delta, Panel } from "../ui/primitives";
import { RecordStrip } from "./RecordStrip";
import { useT } from "../../hooks/useI18n";
import { archetypeBlurb, archetypeTitle, insightMessages, type InsightT } from "./messages";

const ROLES = [
  { key: "favourite", label: "asFavourite", hint: "favouriteHint" },
  { key: "even", label: "coinFlips", hint: "coinFlipsHint" },
  { key: "underdog", label: "asUnderdog", hint: "underdogHint" },
] as const satisfies readonly { key: Role; label: string; hint: string }[];

const CLUBS = [
  { key: "stronger", label: "strongerClub" },
  { key: "level", label: "levelClubs" },
  { key: "weaker", label: "weakerClub" },
] as const satisfies readonly { key: ClubEdge; label: string }[];

function Situation({ label, hint, bucket, total }: { label: string; hint?: string; bucket: Bucket; total: number }) {
  const t = useT(insightMessages);
  return (
    <div className="rounded-2xl border border-line bg-surface-2/50 p-4">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-semibold">{label}</p>
        <Delta value={bucket.delta} className="text-sm" />
      </div>
      <p className="mt-0.5 text-[11px] text-faint">
        {hint ? `${hint} · ` : ""}
        {total
          ? t("gamesShare", { n: bucket.played, pct: Math.round((bucket.played / total) * 100) })
          : t("games", { n: bucket.played })}
      </p>
      {bucket.played > 0 && <RecordStrip record={bucket} className="mt-3" />}
    </div>
  );
}

function Fact({ icon, label, value, detail, tone }: { icon: ReactNode; label: string; value: ReactNode; detail: ReactNode; tone?: string }) {
  return (
    <div className="flex gap-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface-2 text-accent-text ring-1 ring-line">{icon}</span>
      <div className="min-w-0">
        <p className="text-[11px] text-muted">{label}</p>
        <p className={cn("display text-2xl", tone)}>{value}</p>
        <p className="text-[11px] text-faint">{detail}</p>
      </div>
    </div>
  );
}

const vs = (t: InsightT, a: Appearance) =>
  t("swingDetail", {
    gf: a.gf,
    ga: a.ga,
    opponents: a.opponents.map(displayName).join(" & "),
    pct: Math.round(a.expected * 100),
    date: formatDay(a.match.date),
  });

export function EloDnaPanel({ dna, name, className }: { dna: EloDna; name: string; className?: string }) {
  const t = useT(insightMessages);
  const total = dna.all.played;
  const pts = (b: Bucket) => t("pct", { n: Math.round(scoreRate(b)) });
  return (
    <Panel title={t("dna")} subtitle={t("dnaSub", { name: displayName(name) })} icon={<Dna className="size-4" />} className={className}>
      <div className="relative overflow-hidden rounded-2xl border border-accent/25 bg-accent/[0.06] p-5">
        <p className="label text-accent-text">{t("archetype")}</p>
        <p className="display mt-1.5 text-4xl">{archetypeTitle(t, dna.archetype)}</p>
        <p className="mt-1 text-sm text-muted">{archetypeBlurb(t, dna.archetype)}</p>
      </div>

      <p className="label mt-6 mb-3">{t("byOdds")}</p>
      <div className="grid gap-3 sm:grid-cols-3">
        {ROLES.map((r) => (
          <Situation key={r.key} label={t(r.label)} hint={t(r.hint)} bucket={dna.byRole[r.key]} total={total} />
        ))}
      </div>

      <p className="label mt-6 mb-3">{t("byClub")}</p>
      <div className="grid gap-3 sm:grid-cols-3">
        {CLUBS.map((c) => (
          <Situation key={c.key} label={t(c.label)} bucket={dna.byClub[c.key]} total={total} />
        ))}
      </div>

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <Fact
          icon={<Scale className="size-4" />}
          label={t("againstOdds")}
          value={`${dna.overPerformance >= 0 ? "+" : "−"}${Math.abs(dna.overPerformance).toFixed(1)}`}
          tone={dna.overPerformance >= 0 ? "text-win" : "text-loss"}
          detail={t("againstOddsDetail", { score: dna.all.score.toFixed(1), expected: dna.all.expected.toFixed(1) })}
        />
        <Fact
          icon={<RotateCcw className="size-4" />}
          label={t("afterLoss")}
          value={dna.afterLoss.played ? pts(dna.afterLoss) : "—"}
          detail={t("afterLossDetail", { n: dna.afterLoss.played, win: Math.round(scoreRate(dna.afterWin)) })}
        />
        <Fact
          icon={<MoonStar className="size-4" />}
          label={t("afterMidnight")}
          value={dna.afterMidnight.played ? pts(dna.afterMidnight) : "—"}
          detail={t("afterMidnightDetail", { n: dna.afterMidnight.played, before: Math.round(scoreRate(dna.beforeMidnight)) })}
        />
        <Fact
          icon={<Shield className="size-4" />}
          label={t("clubEdge")}
          value={`${dna.avgClubDiff >= 0 ? "+" : "−"}${Math.abs(Math.round(dna.avgClubDiff))}`}
          detail={t("clubEdgeDetail")}
        />
        {dna.best && dna.best.delta > 0 && (
          <Fact
            icon={<TrendingUp className="size-4" />}
            label={t("biggestGain")}
            value={`+${Math.round(dna.best.delta)}`}
            tone="text-win"
            detail={vs(t, dna.best)}
          />
        )}
        {dna.worst && dna.worst.delta < 0 && (
          <Fact
            icon={<TrendingDown className="size-4" />}
            label={t("biggestDrop")}
            value={`−${Math.abs(Math.round(dna.worst.delta))}`}
            tone="text-loss"
            detail={vs(t, dna.worst)}
          />
        )}
      </div>
    </Panel>
  );
}
