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
import { useT } from "../hooks/useI18n";
import { defineMessages } from "../lib/i18n";
import { common } from "../lib/messages";

const MIN_PAIR = 3;

const msg = defineMessages({
  en: {
    record: "{w}W {d}D {l}L",
    notEnough: "Not enough games yet ({n}+ needed)",
    allPlayers: "All players",
    archived: "Archived",
    rankByElo: "#{rank} by Elo",
    provisional: "Provisional",
    streakW: "{n} win in a row|{n} wins in a row",
    streakL: "{n} loss in a row|{n} losses in a row",
    streakD: "{n} draw in a row|{n} draws in a row",
    matchesN: "{n} match|{n} matches",
    lastPlayed: " · last played {when}",
    elo: "Elo",
    lastMatchday: "last matchday",
    peak: "Peak",
    allTimeHigh: "All-time high",
    winRate: "Win rate",
    goalDiff: "Goal diff",
    perGame: "{f} for · {a} against /g",
    form: "Form",
    compare: "Compare",
    journey: "Elo journey",
    journeySub: "{n} rated matches · K {k}",
    noRated: "No rated matches yet.",
    milestones: "Milestones",
    bestStreak: "Best streak",
    winsInRow: "wins in a row",
    unbeaten: "Unbeaten",
    longestRun: "longest run",
    cleanSheets: "Clean sheets",
    zeroConceded: "0 goals conceded",
    biggestWin: "Biggest win",
    clubs: "{a} v {b}",
    matchMap: "Match map",
    matchMapSub: "Each dot is a match: win probability before kick-off vs Elo won or lost",
    againstDuos: "Against duos",
    againstDuosSub: "Record against each pair faced",
    noDuos: "No duos faced yet.",
    bestPartner: "Best partner",
    worstPartner: "Worst partner",
    victim: "Favourite victim",
    nemesis: "Nemesis",
    together: "together",
    against: "against",
    partnerships: "Partnerships",
    partnershipsSub: "Record with each teammate",
    noPartnerships: "No partnerships yet.",
    favClubs: "Favourite clubs",
    favClubsSub: "Most picked, with win rate",
    noClubs: "No clubs yet.",
    gp: "{n} gp",
    recent: "Recent matches",
    total: "{n} total",
    showAll: "Show all {n} matches",
  },
  tr: {
    record: "{w}G {d}B {l}M",
    notEnough: "Henüz yeterli maç yok (en az {n})",
    allPlayers: "Tüm oyuncular",
    archived: "Arşivde",
    rankByElo: "Elo'da {rank}.",
    provisional: "Geçici",
    streakW: "Üst üste {n} galibiyet|Üst üste {n} galibiyet",
    streakL: "Üst üste {n} mağlubiyet|Üst üste {n} mağlubiyet",
    streakD: "Üst üste {n} beraberlik|Üst üste {n} beraberlik",
    matchesN: "{n} maç|{n} maç",
    lastPlayed: " · son maç {when}",
    elo: "Elo",
    lastMatchday: "son maç gecesi",
    peak: "Zirve",
    allTimeHigh: "Tüm zamanların en yükseği",
    winRate: "Galibiyet oranı",
    goalDiff: "Averaj",
    perGame: "Maç başı {f} attı · {a} yedi",
    form: "Form",
    compare: "Karşılaştır",
    journey: "Elo yolculuğu",
    journeySub: "{n} puanlı maç · K {k}",
    noRated: "Henüz puanlı maç yok.",
    milestones: "Kilometre taşları",
    bestStreak: "En iyi seri",
    winsInRow: "üst üste galibiyet",
    unbeaten: "Yenilmezlik",
    longestRun: "en uzun seri",
    cleanSheets: "Gol yemeden",
    zeroConceded: "0 gol yenen maç",
    biggestWin: "En farklı galibiyet",
    clubs: "{a} - {b}",
    matchMap: "Maç haritası",
    matchMapSub: "Her nokta bir maç: maç öncesi kazanma ihtimaline karşı kazanılan ya da kaybedilen Elo",
    againstDuos: "İkililere karşı",
    againstDuosSub: "Karşılaşılan her ikiliye karşı kayıt",
    noDuos: "Henüz ikiliyle karşılaşmadı.",
    bestPartner: "En iyi ortak",
    worstPartner: "En kötü ortak",
    victim: "Favori kurban",
    nemesis: "Kâbus",
    together: "birlikte",
    against: "karşısında",
    partnerships: "Ortaklıklar",
    partnershipsSub: "Her takım arkadaşıyla kayıt",
    noPartnerships: "Henüz ortaklık yok.",
    favClubs: "Favori kulüpler",
    favClubsSub: "En çok seçilenler, galibiyet oranıyla",
    noClubs: "Henüz kulüp yok.",
    gp: "{n} maç",
    recent: "Son maçlar",
    total: "toplam {n}",
    showAll: "{n} maçın hepsini göster",
  },
});

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
  const t = useT(msg);
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
              {t("record", { w: record.wins, d: record.draws, l: record.losses })} · {caption}
            </p>
          </div>
          <span className={cn("display tabular text-2xl", tone === "win" ? "text-win" : "text-loss")}>
            {winRate(record).toFixed(0)}%
          </span>
        </BoardLink>
      ) : (
        <p className="mt-3 text-sm text-muted">{t("notEnough", { n: MIN_PAIR })}</p>
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
  const t = useT(msg);
  const tc = useT(common);
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
        <ArrowLeft className="size-4" /> {t("allPlayers")}
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
              {player.archived ? <Pill>{t("archived")}</Pill> : <Pill tone="accent">{t("rankByElo", { rank: player.rank })}</Pill>}
              <RankMove value={player.rankDelta} hideZero />
              {player.provisional && <Pill>{t("provisional")}</Pill>}
              {current && current.count >= 2 && (
                <Pill tone={current.type === "W" ? "win" : current.type === "L" ? "loss" : "draw"}>
                  <Flame className="size-3" /> {t(current.type === "W" ? "streakW" : current.type === "L" ? "streakL" : "streakD", { n: current.count })}
                </Pill>
              )}
            </div>
            <h1 className="display mt-3 text-6xl sm:text-7xl">{displayName(player.name)}</h1>
            <p className="mt-2 text-sm text-muted">
              {t("matchesN", { n: played })}{s?.lastPlayed && t("lastPlayed", { when: relativeTime(s.lastPlayed) })}
            </p>

            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatTile
                label={t("elo")}
                value={<AnimatedNumber value={player.elo} />}
                sub={
                  <span className="inline-flex items-center gap-1">
                    <Delta value={player.eloDelta} /> {t("lastMatchday")}
                  </span>
                }
              />
              <StatTile label={t("peak")} value={player.peak} tone="text-gold" sub={t("allTimeHigh")} />
              <StatTile label={t("winRate")} value={`${s ? winRate(s).toFixed(0) : 0}%`} sub={t("record", { w: s?.wins ?? 0, d: s?.draws ?? 0, l: s?.losses ?? 0 })} />
              <StatTile
                label={t("goalDiff")}
                value={`${(s?.gf ?? 0) - (s?.ga ?? 0) > 0 ? "+" : ""}${(s?.gf ?? 0) - (s?.ga ?? 0)}`}
                tone={(s?.gf ?? 0) >= (s?.ga ?? 0) ? "text-win" : "text-loss"}
                sub={t("perGame", { f: played ? ((s?.gf ?? 0) / played).toFixed(1) : 0, a: played ? ((s?.ga ?? 0) / played).toFixed(1) : 0 })}
              />
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="label">{t("form")}</span>
                <FormPills outcomes={s?.outcomes ?? []} />
              </div>
              <Button variant="secondary" className="ml-auto" onClick={() => navigate(`/h2h?a=${encodeURIComponent(player.name)}`)}>
                <Swords className="size-4" /> {t("compare")}
              </Button>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-12">
        <Panel
          title={t("journey")}
          subtitle={t("journeySub", { n: player.history.length, k: data.k })}
          icon={<TrendingUp className="size-4" />}
          className="lg:col-span-8"
        >
          {player.history.length ? (
            <PlayerEloChart history={player.history} />
          ) : (
            <p className="py-16 text-center text-sm text-muted">{t("noRated")}</p>
          )}
        </Panel>
        <Panel title={t("milestones")} icon={<Trophy className="size-4" />} className="lg:col-span-4" bodyClassName="grid grid-cols-2 gap-3 p-5">
          <StatTile label={t("bestStreak")} value={s?.longestWin ?? 0} sub={t("winsInRow")} />
          <StatTile label={t("unbeaten")} value={s?.longestUnbeaten ?? 0} sub={t("longestRun")} />
          <StatTile label={t("cleanSheets")} value={s?.cleanSheets ?? 0} sub={t("zeroConceded")} />
          <StatTile
            label={t("biggestWin")}
            value={s?.biggestWin ? `${Math.max(s.biggestWin.scoreA, s.biggestWin.scoreB)}–${Math.min(s.biggestWin.scoreA, s.biggestWin.scoreB)}` : "—"}
            sub={s?.biggestWin ? t("clubs", { a: s.biggestWin.clubA, b: s.biggestWin.clubB }) : undefined}
          />
        </Panel>
      </div>

      {dna && apps.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-12">
          <EloDnaPanel dna={dna} name={player.name} className="lg:col-span-7" />
          <div className="min-w-0 space-y-6 lg:col-span-5">
            <Panel
              title={t("matchMap")}
              subtitle={t("matchMapSub")}
              icon={<Crosshair className="size-4" />}
            >
              <MatchMapChart apps={apps} />
              <div className="mt-3 flex justify-center gap-4 text-[11px] text-muted">
                {[tc("win"), tc("draw"), tc("loss")].map((l, i) => (
                  <span key={l} className="inline-flex items-center gap-1.5">
                    <span className="size-2 rounded-full" style={{ background: ["var(--win)", "var(--draw)", "var(--loss)"][i] }} />
                    {l}
                  </span>
                ))}
              </div>
            </Panel>
            <Panel title={t("againstDuos")} subtitle={t("againstDuosSub")} icon={<Swords className="size-4" />}>
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
                <p className="text-sm text-muted">{t("noDuos")}</p>
              )}
            </Panel>
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <RelationCard title={t("bestPartner")} icon={<HeartHandshake className="size-4" />} name={partnerBest?.[0]} record={partnerBest?.[1]} tone="win" caption={t("together")} />
        <RelationCard title={t("worstPartner")} icon={<Shield className="size-4" />} name={partnerWorst?.[0]} record={partnerWorst?.[1]} tone="loss" caption={t("together")} />
        <RelationCard
          title={t("victim")}
          icon={<Target className="size-4" />}
          name={victim?.[0]}
          record={victim?.[1]}
          tone="win"
          caption={t("against")}
          to={victim ? `/h2h?a=${encodeURIComponent(player.name)}&b=${encodeURIComponent(victim[0])}` : undefined}
        />
        <RelationCard
          title={t("nemesis")}
          icon={<Skull className="size-4" />}
          name={nemesis?.[0]}
          record={nemesis?.[1]}
          tone="loss"
          caption={t("against")}
          to={nemesis ? `/h2h?a=${encodeURIComponent(player.name)}&b=${encodeURIComponent(nemesis[0])}` : undefined}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title={t("partnerships")} subtitle={t("partnershipsSub")} icon={<HeartHandshake className="size-4" />}>
          <div className="space-y-3">
            {teammates.map(([name, r]) => (
              <BoardLink key={name} to={`/players/${encodeURIComponent(name)}`} className="flex items-center gap-3 rounded-lg hover:bg-surface-2/60">
                <Avatar name={name} size="sm" />
                <span className="w-24 truncate text-sm font-medium">{displayName(name)}</span>
                <ProgressBar value={winRate(r)} className="flex-1" barClassName={winRate(r) >= 50 ? "bg-win" : "bg-loss"} />
                <span className="tabular w-10 text-right text-sm">{winRate(r).toFixed(0)}%</span>
                <span className="tabular w-14 text-right text-xs text-muted">{t("gp", { n: r.played })}</span>
              </BoardLink>
            ))}
            {!teammates.length && <p className="text-sm text-muted">{t("noPartnerships")}</p>}
          </div>
        </Panel>
        <Panel title={t("favClubs")} subtitle={t("favClubsSub")} icon={<Shield className="size-4" />}>
          <div className="space-y-3">
            {clubs.map(([name, r]) => (
              <div key={name} className="flex items-center gap-3">
                <ClubCrest name={name} size="sm" />
                <span className="w-36 truncate text-sm font-medium">{name}</span>
                <ProgressBar value={winRate(r)} className="flex-1" barClassName={winRate(r) >= 50 ? "bg-win" : "bg-loss"} />
                <span className="tabular w-10 text-right text-sm">{winRate(r).toFixed(0)}%</span>
                <span className="tabular w-14 text-right text-xs text-muted">{t("gp", { n: r.played })}</span>
              </div>
            ))}
            {!clubs.length && <p className="text-sm text-muted">{t("noClubs")}</p>}
          </div>
        </Panel>
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[15px] font-semibold">{t("recent")}</h2>
          <span className="text-xs text-muted">{t("total", { n: matches.length })}</span>
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
              {t("showAll", { n: matches.length })}
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
