import { motion } from "motion/react";
import {
  ArrowRight,
  CalendarDays,
  Crown,
  Flame,
  FlaskConical,
  Goal,
  Handshake,
  Medal,
  Snowflake,
  Sparkles,
  Swords,
  Target,
  TrendingUp,
  Trophy,
  Users,
  Zap,
} from "lucide-react";
import { useMemo, type ReactNode } from "react";
import { DataGate } from "../components/DataGate";
import { EloRaceChart } from "../components/charts/EloCharts";
import { PageHeader } from "../components/layout/AppShell";
import { MatchCard } from "../components/match/MatchCard";
import { AwardCard } from "../components/insights/AwardCard";
import { NightRecapBanner } from "../components/insights/NightRecapBanner";
import { PlayerCard } from "../components/PlayerCard";
import { Avatar, ClubCrest } from "../components/ui/Identity";
import {
  AnimatedNumber,
  Button,
  Delta,
  EmptyState,
  FormPills,
  Panel,
  Pill,
  RankMove,
  Sparkline,
} from "../components/ui/primitives";
import type { Analytics } from "../hooks/analytics-context";
import { cn } from "../lib/cn";
import { dayFromKey, displayName, formatWeekday, relativeTime } from "../lib/format";
import { computeAwards } from "../lib/analysis";
import { nightSummary } from "../lib/insights";
import { winRate, type ParsedMatch } from "../lib/stats";
import { BoardLink } from "../components/board/BoardLink";
import { useBoard } from "../hooks/useBoard";
import { useBoardNavigate } from "../hooks/useBoardNavigate";
import { useT } from "../hooks/useI18n";
import { defineMessages } from "../lib/i18n";

const msg = defineMessages({
  en: {
    topOfTable: "Top of the table",
    leadsBefore: "Leads {name} by ",
    leadsAfter: "",
    leadsRatings: "Leads the ratings",
    leaderRecord: " · {w}W {d}D {l}L · {pct}% win rate",
    elo: "Elo",
    peak: "Peak",
    form: "Form",
    viewProfile: "View profile",
    versus: "vs {name}",
    powerRankings: "Power rankings",
    powerSub: "Elo · movement since last matchday",
    fullTable: "Full table",
    prov: "PROV",
    lastMatchday: "Last matchday",
    noMatches: "No matches yet",
    lastSub: "Last matchday · {when} · {matches} matches · {goals} goals",
    allMatches: "All matches",
    potn: "Player of the night",
    winsOf: "{w}/{n} wins",
    hotCold: "Hot & cold",
    hotSub: "Current streaks and form",
    winStreak: "{n} win|{n} wins",
    lossStreak: "{n} loss|{n} losses",
    noStreaks: "No active streaks right now.",
    formTable: "Form table · last 5",
    pts: "PTS",
    hall: "Hall of records",
    biggestWin: "Biggest win",
    goalFest: "Goal fest",
    goalsN: "{n} goal|{n} goals",
    longestWin: "Longest win streak",
    winsInRow: "{n} win in a row|{n} wins in a row",
    longestUnbeaten: "Longest unbeaten run",
    unbeatenN: "{n} match without defeat|{n} matches without defeat",
    deadliestDuo: "Deadliest duo",
    duoDetail: "{pct}% wins · {w}W {d}D {l}L",
    marathon: "Marathon night",
    marathonDetail: "{matches} matches · {goals} goals",
    teams: "{a} vs {b}",
    welcome: "Welcome",
    emptyDesc: "Your board is empty for now. Three steps and the stories start writing themselves.",
    step1: "Add your players",
    step1Text: "Everyone starts at 1000 Elo.",
    step1Cta: "Add players",
    step2: "Log the first match",
    step2Text: "Draft fair teams, pick clubs, enter the score.",
    step2Cta: "Match center",
    step3: "Invite the group",
    step3Text: "Share the link and the board password.",
    step3Cta: "Invite",
    fromLab: "From the lab",
    labLink: "All awards, Elo DNA & duo matchups",
    eyebrow: "Season overview",
    title: "The Pitch",
    description: "Ratings, streaks and stories from every FIFA night.",
    matches: "Matches",
    matchdays: "{n} matchday|{n} matchdays",
    goals: "Goals",
    draws: "{n} draw|{n} draws",
    perMatch: "Goals / match",
    bothSides: "Both sides combined",
    players: "Players",
    kFactor: "K-factor {k}",
    race: "The race",
    raceSub: "Elo after every matchday · hover a name to focus, click to hide",
  },
  tr: {
    topOfTable: "Zirvede",
    leadsBefore: "{name} karşısında ",
    leadsAfter: " önde",
    leadsRatings: "Sıralamanın zirvesinde",
    leaderRecord: " · {w}G {d}B {l}M · %{pct} galibiyet",
    elo: "Elo",
    peak: "Zirve",
    form: "Form",
    viewProfile: "Profili gör",
    versus: "{name} ile kıyasla",
    powerRankings: "Güç sıralaması",
    powerSub: "Elo · son maç gecesinden beri değişim",
    fullTable: "Tüm tablo",
    prov: "GEÇİCİ",
    lastMatchday: "Son maç gecesi",
    noMatches: "Henüz maç yok",
    lastSub: "Son maç gecesi · {when} · {matches} maç · {goals} gol",
    allMatches: "Tüm maçlar",
    potn: "Gecenin oyuncusu",
    winsOf: "{n} maçta {w} galibiyet",
    hotCold: "Sıcak & soğuk",
    hotSub: "Güncel seriler ve form",
    winStreak: "{n} galibiyet|{n} galibiyet",
    lossStreak: "{n} mağlubiyet|{n} mağlubiyet",
    noStreaks: "Şu an devam eden seri yok.",
    formTable: "Form tablosu · son 5",
    pts: "PUAN",
    hall: "Rekorlar kitabı",
    biggestWin: "En farklı galibiyet",
    goalFest: "Gol şöleni",
    goalsN: "{n} gol|{n} gol",
    longestWin: "En uzun galibiyet serisi",
    winsInRow: "Üst üste {n} galibiyet|Üst üste {n} galibiyet",
    longestUnbeaten: "En uzun yenilmezlik serisi",
    unbeatenN: "{n} maç yenilgisiz|{n} maç yenilgisiz",
    deadliestDuo: "En ölümcül ikili",
    duoDetail: "%{pct} galibiyet · {w}G {d}B {l}M",
    marathon: "Maraton gecesi",
    marathonDetail: "{matches} maç · {goals} gol",
    teams: "{a} - {b}",
    welcome: "Hoş geldin",
    emptyDesc: "Board'un şimdilik boş. Üç adım sonra hikâyeler kendiliğinden yazılmaya başlar.",
    step1: "Oyuncularını ekle",
    step1Text: "Herkes 1000 Elo ile başlar.",
    step1Cta: "Oyuncu ekle",
    step2: "İlk maçı gir",
    step2Text: "Adil takımlar kur, kulüpleri seç, skoru gir.",
    step2Cta: "Maç merkezi",
    step3: "Grubu davet et",
    step3Text: "Linki ve board şifresini paylaş.",
    step3Cta: "Davet et",
    fromLab: "Laboratuvardan",
    labLink: "Tüm ödüller, Elo DNA'sı ve ikili eşleşmeler",
    eyebrow: "Sezon özeti",
    title: "Saha",
    description: "Her FIFA gecesinden puanlar, seriler ve hikâyeler.",
    matches: "Maçlar",
    matchdays: "{n} maç gecesi|{n} maç gecesi",
    goals: "Goller",
    draws: "{n} beraberlik|{n} beraberlik",
    perMatch: "Maç başı gol",
    bothSides: "İki tarafın toplamı",
    players: "Oyuncular",
    kFactor: "K-faktörü {k}",
    race: "Yarış",
    raceSub: "Her maç gecesinden sonra Elo · odaklanmak için ismin üzerine gel, gizlemek için tıkla",
  },
});

const fade = (i: number) => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { delay: 0.05 * i, duration: 0.5, ease: [0.16, 1, 0.3, 1] as const },
});

function Kpi({
  label,
  value,
  icon,
  format,
  hint,
  i,
}: {
  label: string;
  value: number;
  icon: ReactNode;
  format?: (n: number) => string;
  hint?: ReactNode;
  i: number;
}) {
  return (
    <motion.div {...fade(i)} className="card p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <span className="label">{label}</span>
        <span className="text-faint">{icon}</span>
      </div>
      <AnimatedNumber value={value} format={format} className="display mt-3 block text-4xl sm:text-5xl" />
      {hint && <p className="mt-1.5 truncate text-xs text-muted">{hint}</p>}
    </motion.div>
  );
}

function LeaderHero({ data }: { data: Analytics }) {
  const t = useT(msg);
  const navigate = useBoardNavigate();
  const leader = data.ranking.find((p) => !p.provisional) ?? data.ranking[0];
  if (!leader) return null;
  const s = leader.stats;
  const second = data.ranking.find((p) => p.id !== leader.id && !p.provisional);
  return (
    <motion.section {...fade(0)} className="card sheen overflow-hidden lg:col-span-8">
      <div className="pointer-events-none absolute -right-24 -top-24 size-96 rounded-full bg-accent/10 blur-3xl" />
      <div className="relative flex flex-col items-center gap-8 p-6 sm:p-8 md:flex-row md:items-center">
        <div className="shrink-0">
          <PlayerCard player={leader} size="md" />
        </div>
        <div className="min-w-0 flex-1 text-center md:text-left">
          <Pill tone="accent" className="mb-4">
            <Crown className="size-3" /> {t("topOfTable")}
          </Pill>
          <h2 className="display text-5xl sm:text-6xl">{displayName(leader.name)}</h2>
          <p className="mt-3 text-sm text-muted">
            {second ? (
              <>
                {t("leadsBefore", { name: displayName(second.name) })}
                <span className="font-semibold text-fg">{leader.elo - second.elo} Elo</span>
                {t("leadsAfter", { name: displayName(second.name) })}
              </>
            ) : (
              t("leadsRatings")
            )}
            {s && (
              <>
                {t("leaderRecord", { w: s.wins, d: s.draws, l: s.losses, pct: winRate(s).toFixed(0) })}
              </>
            )}
          </p>
          <div className="mt-6 grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-line bg-surface-2/60 p-3">
              <p className="label">{t("elo")}</p>
              <p className="display mt-1.5 text-3xl">
                <AnimatedNumber value={leader.elo} />
              </p>
            </div>
            <div className="rounded-xl border border-line bg-surface-2/60 p-3">
              <p className="label">{t("peak")}</p>
              <p className="display mt-1.5 text-3xl text-gold">{leader.peak}</p>
            </div>
            <div className="rounded-xl border border-line bg-surface-2/60 p-3">
              <p className="label">{t("form")}</p>
              <div className="mt-2.5">
                <FormPills outcomes={s?.outcomes ?? []} size="sm" />
              </div>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap justify-center gap-2 md:justify-start">
            <Button variant="primary" onClick={() => navigate(`/players/${encodeURIComponent(leader.name)}`)}>
              {t("viewProfile")} <ArrowRight className="size-4" />
            </Button>
            {second && (
              <Button
                variant="secondary"
                onClick={() =>
                  navigate(`/h2h?a=${encodeURIComponent(leader.name)}&b=${encodeURIComponent(second.name)}`)
                }
              >
                <Swords className="size-4" /> {t("versus", { name: displayName(second.name) })}
              </Button>
            )}
          </div>
        </div>
      </div>
    </motion.section>
  );
}

function PowerRankings({ data }: { data: Analytics }) {
  const t = useT(msg);
  return (
    <Panel
      title={t("powerRankings")}
      subtitle={t("powerSub")}
      icon={<TrendingUp className="size-4" />}
      className="lg:col-span-4"
      bodyClassName="px-2 pb-3 pt-3"
      action={
        <BoardLink to="/leaderboard" className="text-xs font-medium text-muted hover:text-fg">
          {t("fullTable")}
        </BoardLink>
      }
    >
      <ol>
        {data.ranking.map((p, i) => (
          <motion.li key={p.id} {...fade(i + 2)}>
            <BoardLink
              to={`/players/${encodeURIComponent(p.name)}`}
              className="group flex items-center gap-3 rounded-xl px-3 py-2 transition-colors hover:bg-surface-2"
            >
              <span
                className={cn(
                  "display tabular w-5 text-center text-lg",
                  p.rank === 1 ? "text-gold" : p.rank === 2 ? "text-silver" : p.rank === 3 ? "text-bronze" : "text-faint",
                )}
              >
                {p.rank}
              </span>
              <Avatar name={p.name} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 truncate text-sm font-medium">
                  {displayName(p.name)}
                  {p.provisional && <span className="text-[10px] font-semibold text-faint">{t("prov")}</span>}
                </span>
              </span>
              <Sparkline values={[1000, ...p.history.slice(-12).map((h) => h.elo)]} width={64} height={22} />
              <span className="w-10 text-right">
                <RankMove value={p.rankDelta} />
              </span>
              <span className="display tabular w-12 text-right text-xl">{p.elo}</span>
            </BoardLink>
          </motion.li>
        ))}
      </ol>
    </Panel>
  );
}

function LastMatchday({ data }: { data: Analytics }) {
  const t = useT(msg);
  const day = data.matchdays[0];
  if (!day)
    return (
      <Panel title={t("lastMatchday")} className="lg:col-span-7">
        <EmptyState icon={<CalendarDays className="size-5" />} title={t("noMatches")} />
      </Panel>
    );
  const summary = nightSummary(day, data.engine);
  const mvp = summary[0];
  const date = dayFromKey(day.key);
  return (
    <Panel
      title={formatWeekday(date)}
      subtitle={t("lastSub", { when: relativeTime(day.matches[0].date), matches: day.matches.length, goals: day.goals })}
      icon={<CalendarDays className="size-4" />}
      className="lg:col-span-7"
      action={
        <BoardLink to="/matches" className="text-xs font-medium text-muted hover:text-fg">
          {t("allMatches")}
        </BoardLink>
      }
    >
      {mvp && (
        <div className="mb-4 flex items-center gap-4 rounded-2xl border border-accent/25 bg-accent/[0.06] p-4">
          <Avatar name={mvp.name} size="lg" ring="accent" />
          <div className="min-w-0 flex-1">
            <p className="label text-accent-text">{t("potn")}</p>
            <p className="display mt-1 text-2xl">{displayName(mvp.name)}</p>
            <p className="text-xs text-muted">
              {t("winsOf", { w: mvp.wins, n: mvp.played })}
            </p>
          </div>
          <div className="text-right">
            <Delta value={mvp.delta} className="display text-3xl" />
            <p className="text-[11px] text-faint">{t("elo")}</p>
          </div>
        </div>
      )}
      <div className="space-y-2">
        {day.matches.slice(0, 5).map((m) => (
          <MatchCard key={m.id} match={m} elo={data.engine.perMatch.get(m.id)} className="shadow-none" />
        ))}
      </div>
      {summary.length > 1 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {summary.map((s) => (
            <span key={s.name} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 py-1 pl-1 pr-2.5 text-xs">
              <Avatar name={s.name} size="xs" />
              {displayName(s.name)}
              <Delta value={s.delta} />
            </span>
          ))}
        </div>
      )}
    </Panel>
  );
}

function HotCold({ data }: { data: Analytics }) {
  const t = useT(msg);
  const streaks = data.ranking
    .filter((p) => p.stats?.current && p.stats.current.count >= 2)
    .map((p) => ({ p, s: p.stats!.current! }));
  const hot = streaks.filter((x) => x.s.type === "W").sort((a, b) => b.s.count - a.s.count);
  const cold = streaks.filter((x) => x.s.type === "L").sort((a, b) => b.s.count - a.s.count);
  const row = (name: string, label: string, tone: "win" | "loss" | "draw", icon: ReactNode) => (
    <BoardLink
      key={name + label}
      to={`/players/${encodeURIComponent(name)}`}
      className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-surface-2"
    >
      <Avatar name={name} size="sm" />
      <span className="flex-1 text-sm font-medium">{displayName(name)}</span>
      <Pill tone={tone}>
        {icon} {label}
      </Pill>
    </BoardLink>
  );
  const formTable = [...data.ranking]
    .filter((p) => (p.stats?.outcomes.length ?? 0) >= 3)
    .map((p) => ({
      p,
      pts: p.stats!.outcomes.slice(0, 5).reduce((a, o) => a + (o === "W" ? 3 : o === "D" ? 1 : 0), 0),
    }))
    .sort((a, b) => b.pts - a.pts);

  return (
    <Panel title={t("hotCold")} subtitle={t("hotSub")} icon={<Flame className="size-4" />} className="lg:col-span-5">
      <div className="space-y-1">
        {hot.map(({ p, s }) => row(p.name, t("winStreak", { n: s.count }), "win", <Flame className="size-3" />))}
        {cold.map(({ p, s }) => row(p.name, t("lossStreak", { n: s.count }), "loss", <Snowflake className="size-3" />))}
        {!hot.length && !cold.length && <p className="px-2 py-3 text-sm text-muted">{t("noStreaks")}</p>}
      </div>
      <div className="hairline my-4" />
      <p className="label mb-3">{t("formTable")}</p>
      <div className="space-y-2.5">
        {formTable.slice(0, 6).map(({ p, pts }) => (
          <div key={p.id} className="flex items-center gap-3">
            <Avatar name={p.name} size="xs" />
            <span className="w-20 truncate text-sm">{displayName(p.name)}</span>
            <FormPills outcomes={p.stats!.outcomes} size="sm" />
            <span className="ml-auto display tabular text-lg">{pts}</span>
            <span className="text-[10px] text-faint">{t("pts")}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function RecordTile({
  icon,
  label,
  title,
  detail,
  to,
  i,
}: {
  icon: ReactNode;
  label: string;
  title: ReactNode;
  detail: ReactNode;
  to?: string;
  i: number;
}) {
  const body = (
    <motion.div {...fade(i)} className="card card-hover h-full p-5">
      <div className="flex items-center gap-2 text-accent-text">
        {icon}
        <span className="label text-accent-text">{label}</span>
      </div>
      <div className="mt-3 text-lg font-semibold">{title}</div>
      <div className="mt-1 text-xs text-muted">{detail}</div>
    </motion.div>
  );
  return to ? <BoardLink to={to}>{body}</BoardLink> : body;
}

const scoreline = (m: ParsedMatch) => (
  <span className="inline-flex items-center gap-2">
    <ClubCrest name={m.clubA} size="xs" />
    <span className="tabular">
      {m.scoreA}–{m.scoreB}
    </span>
    <ClubCrest name={m.clubB} size="xs" />
  </span>
);

function Records({ data }: { data: Analytics }) {
  const t = useT(msg);
  const r = data.records;
  const teams = (m: ParsedMatch) =>
    t("teams", { a: m.teamA.map(displayName).join(" & "), b: m.teamB.map(displayName).join(" & ") });
  return (
    <section>
      <div className="mb-4 flex items-center gap-2">
        <Medal className="size-4 text-gold" />
        <h2 className="text-[15px] font-semibold">{t("hall")}</h2>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {r.biggestWin && (
          <RecordTile i={1} icon={<Target className="size-4" />} label={t("biggestWin")} title={scoreline(r.biggestWin)} detail={teams(r.biggestWin)} />
        )}
        {r.goalFest && (
          <RecordTile
            i={2}
            icon={<Goal className="size-4" />}
            label={t("goalFest")}
            title={
              <>
                {scoreline(r.goalFest)}{" "}
                <span className="text-sm text-muted">· {t("goalsN", { n: r.goalFest.scoreA + r.goalFest.scoreB })}</span>
              </>
            }
            detail={teams(r.goalFest)}
          />
        )}
        {r.longestWinStreak && (
          <RecordTile
            i={3}
            icon={<Flame className="size-4" />}
            label={t("longestWin")}
            to={`/players/${encodeURIComponent(r.longestWinStreak.name)}`}
            title={
              <span className="flex items-center gap-2">
                <Avatar name={r.longestWinStreak.name} size="sm" /> {displayName(r.longestWinStreak.name)}
              </span>
            }
            detail={t("winsInRow", { n: r.longestWinStreak.count })}
          />
        )}
        {r.longestUnbeaten && (
          <RecordTile
            i={4}
            icon={<Zap className="size-4" />}
            label={t("longestUnbeaten")}
            to={`/players/${encodeURIComponent(r.longestUnbeaten.name)}`}
            title={
              <span className="flex items-center gap-2">
                <Avatar name={r.longestUnbeaten.name} size="sm" /> {displayName(r.longestUnbeaten.name)}
              </span>
            }
            detail={t("unbeatenN", { n: r.longestUnbeaten.count })}
          />
        )}
        {r.bestDuo && (
          <RecordTile
            i={5}
            icon={<Handshake className="size-4" />}
            label={t("deadliestDuo")}
            title={
              <span className="flex items-center gap-2">
                <span className="flex -space-x-2">
                  {r.bestDuo.names.map((n) => (
                    <Avatar key={n} name={n} size="sm" className="ring-2 ring-surface" />
                  ))}
                </span>
                {r.bestDuo.names.map(displayName).join(" & ")}
              </span>
            }
            detail={t("duoDetail", { pct: winRate(r.bestDuo).toFixed(0), w: r.bestDuo.wins, d: r.bestDuo.draws, l: r.bestDuo.losses })}
          />
        )}
        {r.busiestNight && (
          <RecordTile
            i={6}
            icon={<Sparkles className="size-4" />}
            label={t("marathon")}
            title={formatWeekday(dayFromKey(r.busiestNight.key))}
            detail={t("marathonDetail", { matches: r.busiestNight.matches.length, goals: r.busiestNight.goals })}
          />
        )}
      </div>
    </section>
  );
}

function GettingStarted({ players }: { players: number }) {
  const t = useT(msg);
  const { name } = useBoard();
  const steps = [
    { done: players >= 2, title: t("step1"), text: t("step1Text"), to: "/play", cta: t("step1Cta") },
    { done: false, title: t("step2"), text: t("step2Text"), to: "/play", cta: t("step2Cta") },
    { done: false, title: t("step3"), text: t("step3Text"), to: "/settings", cta: t("step3Cta") },
  ];
  return (
    <div className="space-y-6">
      <PageHeader eyebrow={t("welcome")} title={name} description={t("emptyDesc")} />
      <div className="grid gap-4 md:grid-cols-3">
        {steps.map((s, i) => (
          <motion.div key={s.title} {...fade(i)} className="card flex flex-col p-6">
            <span
              className={cn(
                "grid size-9 place-items-center rounded-full font-display text-lg font-bold",
                s.done ? "bg-accent text-accent-ink" : "bg-surface-3 text-muted ring-1 ring-line-strong",
              )}
            >
              {i + 1}
            </span>
            <h2 className="mt-4 text-lg font-semibold">{s.title}</h2>
            <p className="mt-1 flex-1 text-sm text-muted">{s.text}</p>
            <BoardLink to={s.to} className="mt-5">
              <Button variant={i === (players >= 2 ? 1 : 0) ? "primary" : "secondary"} className="w-full">
                {s.cta} <ArrowRight className="size-4" />
              </Button>
            </BoardLink>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function FromTheLab({ data }: { data: Analytics }) {
  const t = useT(msg);
  const awards = useMemo(() => computeAwards(data.dna, data.ranking.map((p) => p.name)), [data]);
  if (data.parsed.length < 10 || !awards.length) return null;
  return (
    <section>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <FlaskConical className="size-4 text-accent-text" />
          <h2 className="text-[15px] font-semibold">{t("fromLab")}</h2>
        </div>
        <BoardLink to="/insights" className="inline-flex items-center gap-1 text-xs font-medium text-muted hover:text-fg">
          {t("labLink")} <ArrowRight className="size-3.5" />
        </BoardLink>
      </div>
      <div className="grid gap-4 [perspective:1000px] sm:grid-cols-2 xl:grid-cols-4">
        {awards.slice(0, 4).map((a, i) => (
          <AwardCard key={a.key} award={a} index={i} />
        ))}
      </div>
    </section>
  );
}

export default function Dashboard() {
  const t = useT(msg);
  return (
    <DataGate>
      {(data) => {
        const goals = data.parsed.reduce((a, m) => a + m.scoreA + m.scoreB, 0);
        const matches = data.parsed.length;
        const top = data.ranking.slice(0, 6).map((p) => ({ name: p.name, history: p.history }));
        if (!matches) return <GettingStarted players={data.ranking.length} />;
        return (
          <div className="space-y-6">
            <PageHeader
              eyebrow={t("eyebrow")}
              title={t("title")}
              description={t("description")}
            />

            <NightRecapBanner data={data} />

            <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
              <Kpi i={1} label={t("matches")} value={matches} icon={<Trophy className="size-4" />} hint={t("matchdays", { n: data.matchdays.length })} />
              <Kpi i={2} label={t("goals")} value={goals} icon={<Goal className="size-4" />} hint={t("draws", { n: data.parsed.filter((m) => m.result === "D").length })} />
              <Kpi
                i={3}
                label={t("perMatch")}
                value={matches ? goals / matches : 0}
                format={(n) => n.toFixed(2)}
                icon={<Target className="size-4" />}
                hint={t("bothSides")}
              />
              <Kpi i={4} label={t("players")} value={data.ranking.length} icon={<Users className="size-4" />} hint={t("kFactor", { k: data.k })} />
            </div>

            <div className="grid gap-4 lg:grid-cols-12">
              <LeaderHero data={data} />
              <PowerRankings data={data} />
            </div>

            <Panel
              title={t("race")}
              subtitle={t("raceSub")}
              icon={<TrendingUp className="size-4" />}
            >
              <EloRaceChart series={top} />
            </Panel>

            <div className="grid gap-4 lg:grid-cols-12">
              <LastMatchday data={data} />
              <HotCold data={data} />
            </div>

            <Records data={data} />

            <FromTheLab data={data} />
          </div>
        );
      }}
    </DataGate>
  );
}
