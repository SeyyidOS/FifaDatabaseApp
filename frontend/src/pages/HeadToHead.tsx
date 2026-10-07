import { motion } from "motion/react";
import { useSearchParams } from "react-router-dom";
import { ArrowLeftRight, HeartHandshake, Swords } from "lucide-react";
import type { ReactNode } from "react";
import { DataGate } from "../components/DataGate";
import { EloRaceChart } from "../components/charts/EloCharts";
import { PageHeader } from "../components/layout/AppShell";
import { MatchCard } from "../components/match/MatchCard";
import { Avatar } from "../components/ui/Identity";
import { Button, EmptyState, FormPills, Panel } from "../components/ui/primitives";
import type { Analytics, RankedPlayer } from "../hooks/analytics-context";
import { cn } from "../lib/cn";
import { expectedScore } from "../lib/elo";
import { cleanName, displayName } from "../lib/format";
import { headToHead, winRate } from "../lib/stats";
import { useT } from "../hooks/useI18n";
import { defineMessages } from "../lib/i18n";

const msg = defineMessages({
  en: {
    pick: "Pick a player",
    archived: "Archived",
    eyebrow: "Rivalries",
    title: "Head to Head",
    description: "Pick any two players to see their record against each other, as partners, and how they stack up.",
    swap: "Swap",
    vs: "VS",
    odds: "1v1 odds",
    rivals: "As rivals",
    rivalsSub: "{n} meeting on opposite sides|{n} meetings on opposite sides",
    nameWins: "{name} wins",
    draws: "draws",
    goals: "Goals:",
    neverFaced: "Never faced each other",
    partners: "As partners",
    partnersSub: "{n} match on the same side|{n} matches on the same side",
    partnerRecord: "{w}W {d}D {l}L · {gf}–{ga} goals",
    neverTeamed: "Never teamed up",
    tape: "Tale of the tape",
    elo: "Elo",
    peak: "Peak Elo",
    winRate: "Win rate",
    scored: "Goals / game",
    conceded: "Conceded / game",
    matches: "Matches",
    bestStreak: "Best win streak",
    overTime: "Elo over time",
    shared: "Shared matches",
    choose: "Choose two players",
    chooseHint: "Tap the avatars under each side to start the comparison.",
  },
  tr: {
    pick: "Bir oyuncu seç",
    archived: "Arşivde",
    eyebrow: "Rekabetler",
    title: "Karşılaştır",
    description: "İki oyuncu seç: birbirlerine karşı ve ortak olarak kayıtlarını, kimin daha iyi olduğunu gör.",
    swap: "Yer değiştir",
    vs: "VS",
    odds: "1'e 1 ihtimal",
    rivals: "Rakip olarak",
    rivalsSub: "Karşı karşıya {n} maç|Karşı karşıya {n} maç",
    nameWins: "{name} kazandı",
    draws: "beraberlik",
    goals: "Goller:",
    neverFaced: "Hiç karşılaşmadılar",
    partners: "Ortak olarak",
    partnersSub: "Aynı tarafta {n} maç|Aynı tarafta {n} maç",
    partnerRecord: "{w}G {d}B {l}M · {gf}–{ga} gol",
    neverTeamed: "Hiç aynı takımda oynamadılar",
    tape: "Kozlar",
    elo: "Elo",
    peak: "Zirve Elo",
    winRate: "Galibiyet oranı",
    scored: "Maç başı attığı",
    conceded: "Maç başı yediği",
    matches: "Maç",
    bestStreak: "En iyi galibiyet serisi",
    overTime: "Zaman içinde Elo",
    shared: "Ortak maçlar",
    choose: "İki oyuncu seç",
    chooseHint: "Karşılaştırmayı başlatmak için iki taraftaki avatarlara dokun.",
  },
});

function PlayerSelect({
  ranking,
  value,
  exclude,
  onChange,
  side,
}: {
  ranking: RankedPlayer[];
  value?: string;
  exclude?: string;
  onChange: (n: string) => void;
  side: "A" | "B";
}) {
  return (
    <div className="flex flex-wrap justify-center gap-1.5">
      {ranking
        .filter((p) => p.name !== exclude)
        .map((p) => (
          <button
            key={p.id}
            onClick={() => onChange(p.name)}
            title={displayName(p.name)}
            className={cn(
              "rounded-full transition-all",
              value === p.name ? "scale-110" : "opacity-50 grayscale hover:opacity-100 hover:grayscale-0",
            )}
          >
            <Avatar name={p.name} size="sm" ring={value === p.name ? (side === "A" ? "a" : "b") : undefined} />
          </button>
        ))}
    </div>
  );
}

function CompareRow({
  label,
  a,
  b,
  format = (v) => String(v),
  higherIsBetter = true,
}: {
  label: string;
  a: number;
  b: number;
  format?: (v: number) => ReactNode;
  higherIsBetter?: boolean;
}) {
  const total = Math.abs(a) + Math.abs(b) || 1;
  const aWins = higherIsBetter ? a > b : a < b;
  const bWins = higherIsBetter ? b > a : b < a;
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-sm">
        <span className={cn("tabular font-semibold", aWins ? "text-team-a" : "text-muted")}>{format(a)}</span>
        <span className="label">{label}</span>
        <span className={cn("tabular font-semibold", bWins ? "text-team-b" : "text-muted")}>{format(b)}</span>
      </div>
      <div className="flex h-1.5 gap-1">
        <div className="flex flex-1 justify-end overflow-hidden rounded-l-full bg-surface-3">
          <motion.div
            className={cn("h-full rounded-l-full", aWins ? "bg-team-a" : "bg-team-a/35")}
            initial={{ width: 0 }}
            animate={{ width: `${(Math.abs(a) / total) * 100}%` }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          />
        </div>
        <div className="flex-1 overflow-hidden rounded-r-full bg-surface-3">
          <motion.div
            className={cn("h-full rounded-r-full", bWins ? "bg-team-b" : "bg-team-b/35")}
            initial={{ width: 0 }}
            animate={{ width: `${(Math.abs(b) / total) * 100}%` }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          />
        </div>
      </div>
    </div>
  );
}

function Fighter({ p, side }: { p?: RankedPlayer; side: "A" | "B" }) {
  const t = useT(msg);
  if (!p)
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="grid size-28 place-items-center rounded-full border-2 border-dashed border-line-strong text-3xl text-faint">?</div>
        <p className="text-sm text-muted">{t("pick")}</p>
      </div>
    );
  return (
    <motion.div
      key={p.name}
      initial={{ opacity: 0, x: side === "A" ? -24 : 24 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex flex-col items-center gap-3 text-center"
    >
      <div className="relative">
        <div
          className="absolute inset-0 rounded-full blur-2xl"
          style={{ background: side === "A" ? "var(--team-a)" : "var(--team-b)", opacity: 0.35 }}
        />
        <Avatar name={p.name} size="2xl" ring={side === "A" ? "a" : "b"} />
      </div>
      <div>
        <p className="display text-3xl sm:text-4xl">{displayName(p.name)}</p>
        <p className="mt-1 text-xs text-muted">
          {p.rank ? `#${p.rank}` : t("archived")} · <span className="tabular font-semibold text-fg">{p.elo}</span> Elo
        </p>
      </div>
      <FormPills outcomes={p.stats?.outcomes ?? []} size="sm" />
    </motion.div>
  );
}

function H2HInner({ data }: { data: Analytics }) {
  const t = useT(msg);
  const [params, setParams] = useSearchParams();
  const find = (n: string | null) => (n ? data.byName.get(cleanName(n)) : undefined);
  const a = find(params.get("a"));
  const b = find(params.get("b"));
  const set = (key: "a" | "b", name: string) => {
    const next = new URLSearchParams(params);
    next.set(key, name);
    setParams(next, { replace: true });
  };
  const swap = () => {
    const next = new URLSearchParams();
    if (b) next.set("a", b.name);
    if (a) next.set("b", a.name);
    setParams(next, { replace: true });
  };

  const h = a && b ? headToHead(data.parsed, cleanName(a.name), cleanName(b.name)) : null;
  const sa = a?.stats;
  const sb = b?.stats;
  const per = (v: number | undefined, p: number | undefined) => (p ? (v ?? 0) / p : 0);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("description")}
        actions={
          <Button variant="ghost" onClick={swap} disabled={!a && !b}>
            <ArrowLeftRight className="size-4" /> {t("swap")}
          </Button>
        }
      />

      <section className="card overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(30rem 16rem at 0% 50%, color-mix(in oklab, var(--team-a) 14%, transparent), transparent 70%), radial-gradient(30rem 16rem at 100% 50%, color-mix(in oklab, var(--team-b) 14%, transparent), transparent 70%)",
          }}
        />
        <div className="relative grid grid-cols-[1fr_auto_1fr] items-center gap-4 p-6 sm:p-10">
          <Fighter p={a} side="A" />
          <div className="flex flex-col items-center gap-3">
            <span className="display text-4xl text-faint sm:text-6xl">{t("vs")}</span>
            {a && b && (
              <div className="text-center">
                <p className="label">{t("odds")}</p>
                <p className="tabular mt-1 text-sm font-semibold">
                  <span className="text-team-a">{Math.round(expectedScore(a.elo, b.elo) * 100)}%</span>
                  <span className="text-faint"> · </span>
                  <span className="text-team-b">{Math.round(expectedScore(b.elo, a.elo) * 100)}%</span>
                </p>
              </div>
            )}
          </div>
          <Fighter p={b} side="B" />
        </div>
        <div className="relative grid gap-4 border-t border-line p-4 sm:grid-cols-2">
          <PlayerSelect ranking={data.ranking} value={a?.name} exclude={b?.name} onChange={(n) => set("a", n)} side="A" />
          <PlayerSelect ranking={data.ranking} value={b?.name} exclude={a?.name} onChange={(n) => set("b", n)} side="B" />
        </div>
      </section>

      {a && b && h ? (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            <Panel title={t("rivals")} subtitle={t("rivalsSub", { n: h.rivals.played })} icon={<Swords className="size-4" />}>
              {h.rivals.played ? (
                <>
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="display text-6xl text-team-a">{h.rivals.aWins}</p>
                      <p className="text-xs text-muted">{t("nameWins", { name: displayName(a.name) })}</p>
                    </div>
                    <div className="text-center">
                      <p className="display text-4xl text-draw">{h.rivals.draws}</p>
                      <p className="text-xs text-muted">{t("draws")}</p>
                    </div>
                    <div className="text-right">
                      <p className="display text-6xl text-team-b">{h.rivals.bWins}</p>
                      <p className="text-xs text-muted">{t("nameWins", { name: displayName(b.name) })}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex h-3 overflow-hidden rounded-full">
                    {[
                      [h.rivals.aWins, "bg-team-a"],
                      [h.rivals.draws, "bg-draw"],
                      [h.rivals.bWins, "bg-team-b"],
                    ].map(([v, c], i) => (
                      <motion.div
                        key={i}
                        className={cn("h-full", c as string)}
                        initial={{ width: 0 }}
                        animate={{ width: `${((v as number) / h.rivals.played) * 100}%` }}
                        transition={{ duration: 0.8, delay: i * 0.08 }}
                      />
                    ))}
                  </div>
                  <p className="mt-3 text-center text-xs text-muted">
                    {t("goals")} <span className="tabular font-semibold text-team-a">{h.rivals.aGoals}</span> –{" "}
                    <span className="tabular font-semibold text-team-b">{h.rivals.bGoals}</span>
                  </p>
                </>
              ) : (
                <EmptyState className="py-6" title={t("neverFaced")} />
              )}
            </Panel>
            <Panel title={t("partners")} subtitle={t("partnersSub", { n: h.partners.played })} icon={<HeartHandshake className="size-4" />}>
              {h.partners.played ? (
                <div className="flex items-center gap-6">
                  <div className="flex -space-x-4">
                    <Avatar name={a.name} size="xl" className="ring-4 ring-surface" />
                    <Avatar name={b.name} size="xl" className="ring-4 ring-surface" />
                  </div>
                  <div>
                    <p className="display text-6xl">{winRate(h.partners).toFixed(0)}%</p>
                    <p className="text-sm text-muted">
                      {t("partnerRecord", { w: h.partners.wins, d: h.partners.draws, l: h.partners.losses, gf: h.partners.gf, ga: h.partners.ga })}
                    </p>
                  </div>
                </div>
              ) : (
                <EmptyState className="py-6" title={t("neverTeamed")} />
              )}
            </Panel>
          </div>

          <div className="grid gap-6 lg:grid-cols-12">
            <Panel title={t("tape")} className="lg:col-span-5" bodyClassName="space-y-5 p-5">
              <CompareRow label={t("elo")} a={a.elo} b={b.elo} />
              <CompareRow label={t("peak")} a={a.peak} b={b.peak} />
              <CompareRow label={t("winRate")} a={sa ? winRate(sa) : 0} b={sb ? winRate(sb) : 0} format={(v) => `${v.toFixed(0)}%`} />
              <CompareRow label={t("scored")} a={per(sa?.gf, sa?.played)} b={per(sb?.gf, sb?.played)} format={(v) => v.toFixed(2)} />
              <CompareRow
                label={t("conceded")}
                a={per(sa?.ga, sa?.played)}
                b={per(sb?.ga, sb?.played)}
                format={(v) => v.toFixed(2)}
                higherIsBetter={false}
              />
              <CompareRow label={t("matches")} a={sa?.played ?? 0} b={sb?.played ?? 0} />
              <CompareRow label={t("bestStreak")} a={sa?.longestWin ?? 0} b={sb?.longestWin ?? 0} />
            </Panel>
            <Panel title={t("overTime")} className="lg:col-span-7">
              <EloRaceChart
                series={[
                  { name: a.name, history: a.history },
                  { name: b.name, history: b.history },
                ]}
                height={300}
                colors={["var(--team-a)", "var(--team-b)"]}
              />
            </Panel>
          </div>

          {[...h.rivals.matches, ...h.partners.matches].length > 0 && (
            <section>
              <h2 className="mb-3 text-[15px] font-semibold">{t("shared")}</h2>
              <div className="space-y-2">
                {[...h.rivals.matches, ...h.partners.matches]
                  .sort((x, y) => y.date.getTime() - x.date.getTime())
                  .slice(0, 12)
                  .map((m) => (
                    <MatchCard key={m.id} match={m} elo={data.engine.perMatch.get(m.id)} perspective={cleanName(a.name)} />
                  ))}
              </div>
            </section>
          )}
        </>
      ) : (
        <div className="card">
          <EmptyState icon={<Swords className="size-5" />} title={t("choose")} description={t("chooseHint")} />
        </div>
      )}
    </div>
  );
}

export default function HeadToHead() {
  return <DataGate>{(data) => <H2HInner data={data} />}</DataGate>;
}
