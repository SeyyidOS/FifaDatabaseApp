import { motion } from "motion/react";
import {
  ArrowRight,
  Flame,
  FlaskConical,
  Goal,
  Handshake,
  Medal,
  Snowflake,
  Sparkles,
  Target,
  TrendingUp,
  Zap,
} from "lucide-react";
import { useMemo, type ReactNode } from "react";
import { DataGate } from "../components/DataGate";
import { EloRaceChart } from "../components/charts/EloCharts";
import { PageHeader } from "../components/layout/AppShell";
import { AwardCard } from "../components/insights/AwardCard";
import { Avatar, ClubCrest } from "../components/ui/Identity";
import {
  AnimatedNumber,
  Button,
  Delta,
  FormPills,
  Panel,
  Pill,
} from "../components/ui/primitives";
import type { Analytics } from "../hooks/analytics-context";
import { cn } from "../lib/cn";
import { dayFromKey, displayName, formatDayShort, formatWeekday, nameLang } from "../lib/format";
import { computeAwards } from "../lib/analysis";
import { nightSummary, scoreOfTheNight } from "../lib/insights";
import { clubIdentity } from "../lib/identity";
import { winRate, type ParsedMatch } from "../lib/stats";
import { BoardLink } from "../components/board/BoardLink";
import { NewPlayers, RankingRow } from "../components/ranking/Ranking";
import { useBoard } from "../hooks/useBoard";
import { useT } from "../hooks/useI18n";
import { defineMessages, locale } from "../lib/i18n";

const msg = defineMessages({
  en: {
    king: "King of the night",
    lastNight: "Last match night",
    nightPost: "Night Post",
    nights: "Nights",
    perMatch: "Goals / match",
    perMatchShort: "Avg",
    scoreOfNight: "Score of the night",
    powerRankings: "Power rankings",
    powerSub: "Elo · movement since last matchday",
    fullTable: "Full table",
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
    matches: "Matches",
    goals: "Goals",
    race: "The race",
    raceSub: "Elo after every matchday · hover a name to focus, click to hide",
  },
  tr: {
    king: "Gecenin kralı",
    lastNight: "Son maç gecesi",
    nightPost: "Gece Postası",
    nights: "Gece",
    perMatch: "Maç başı gol",
    perMatchShort: "Gol/maç",
    scoreOfNight: "Gecenin skoru",
    powerRankings: "Güç sıralaması",
    powerSub: "Elo · son maç gecesinden beri değişim",
    fullTable: "Tüm tablo",
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
    matches: "Maçlar",
    goals: "Goller",
    race: "Yarış",
    raceSub: "Her maç gecesinden sonra Elo · odaklanmak için ismin üzerine gel, gizlemek için tıkla",
  },
});

const fade = (i: number) => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { delay: 0.05 * i, duration: 0.5, ease: [0.16, 1, 0.3, 1] as const },
});

/** The latest night at a glance: its headline score, how big it was and who won it. */
function LastNight({ data }: { data: Analytics }) {
  const t = useT(msg);
  const day = data.matchdays[0];
  const best = day && scoreOfTheNight(day);
  if (!day || !best) return null;
  const king = nightSummary(day, data.engine)[0];
  const side = (club: string, team: string[], dim: boolean) => (
    <div className="flex min-w-0 flex-col items-center gap-2 text-center">
      <ClubCrest name={club} size="xl" />
      <span lang={nameLang(club)} className={cn("display max-w-full truncate text-lg sm:text-xl", dim && "text-muted")}>
        {club}
      </span>
      <span className="max-w-full truncate text-xs text-muted">{team.map(displayName).join(" & ")}</span>
    </div>
  );
  const glow = (club: string, at: string) => (
    <span
      aria-hidden
      className={cn("pointer-events-none absolute -top-20 size-72 rounded-full opacity-25 blur-3xl", at)}
      style={{ background: clubIdentity(club).primary }}
    />
  );
  return (
    <motion.section {...fade(0)} className="card overflow-hidden">
      {glow(best.clubA, "-left-20")}
      {glow(best.clubB, "-right-20")}
      <div className="relative flex items-center justify-between gap-3 px-5 pt-5 sm:px-6">
        <span className="label truncate text-accent-text">
          {t("lastNight")} · <span className="sm:hidden">{formatDayShort(dayFromKey(day.key))}</span>
          <span className="hidden sm:inline">{formatWeekday(dayFromKey(day.key))}</span>
        </span>
        <BoardLink
          to={`/night/${day.key}`}
          className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-accent-text hover:underline"
        >
          {t("nightPost")} <ArrowRight className="size-3.5" />
        </BoardLink>
      </div>
      <div className="relative grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 px-4 pt-5 sm:px-6">
        {side(best.clubA, best.teamA, best.result === "B")}
        <div className="display tabular flex items-center gap-3 text-6xl sm:text-7xl">
          <span className={cn(best.result === "B" && "text-muted")}>{best.scoreA}</span>
          <span className="h-1 w-3 rounded-full bg-line-strong" />
          <span className={cn(best.result === "A" && "text-muted")}>{best.scoreB}</span>
        </div>
        {side(best.clubB, best.teamB, best.result === "A")}
      </div>
      <p className="relative pt-3 pb-4 text-center text-xs text-muted">{t("scoreOfNight")}</p>
      <div className="relative grid grid-cols-[1fr_1fr_2.2fr] border-t border-line">
        <div className="px-3 py-3 sm:px-5">
          <p className="display tabular text-2xl">{day.matches.length}</p>
          <p className="label mt-1 tracking-[0.08em]">{t("matches")}</p>
        </div>
        <div className="border-l border-line px-3 py-3 sm:px-5">
          <p className="display tabular text-2xl">{day.goals}</p>
          <p className="label mt-1 tracking-[0.08em]">{t("goals")}</p>
        </div>
        {king && (
          <BoardLink
            to={`/players/${encodeURIComponent(king.name)}`}
            className="flex min-w-0 items-center gap-2.5 border-l border-line px-3 py-3 transition-colors hover:bg-surface-2/60 sm:gap-3 sm:px-5"
          >
            <Avatar name={king.name} size="sm" ring="accent" className="sm:size-9 sm:text-sm" />
            <span className="min-w-0">
              <span className="flex items-center gap-1.5 truncate text-sm font-semibold">
                {displayName(king.name)} <Delta value={king.delta} />
              </span>
              <span className="label block truncate tracking-[0.08em]">{t("king")}</span>
            </span>
          </BoardLink>
        )}
      </div>
    </motion.section>
  );
}

function KpiStrip({ data }: { data: Analytics }) {
  const t = useT(msg);
  const matches = data.parsed.length;
  const goals = data.parsed.reduce((a, m) => a + m.scoreA + m.scoreB, 0);
  const whole = (n: number) => Math.round(n).toLocaleString(locale());
  const oneDecimal = (n: number) => n.toLocaleString(locale(), { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  // [label, wider label for wider screens, value, format]
  const cells: [string, string, number, (n: number) => string][] = [
    [t("matches"), t("matches"), matches, whole],
    [t("goals"), t("goals"), goals, whole],
    [t("nights"), t("nights"), data.matchdays.length, whole],
    [t("perMatchShort"), t("perMatch"), matches ? goals / matches : 0, oneDecimal],
  ];
  return (
    <motion.div {...fade(1)} className="card grid grid-cols-4 divide-x divide-line">
      {cells.map(([label, wide, value, format]) => (
        <div key={label} className="min-w-0 px-3 py-3 sm:px-5 sm:py-4">
          <AnimatedNumber value={value} format={format} className="display block text-2xl sm:text-3xl" />
          <p className="label mt-1 truncate tracking-[0.08em]">
            <span className="sm:hidden">{label}</span>
            <span className="hidden sm:inline">{wide}</span>
          </p>
        </div>
      ))}
    </motion.div>
  );
}

function PowerRankings({ data, className }: { data: Analytics; className?: string }) {
  const t = useT(msg);
  return (
    <Panel
      title={t("powerRankings")}
      subtitle={t("powerSub")}
      icon={<TrendingUp className="size-4" />}
      className={className}
      bodyClassName="px-2 pb-3 pt-3"
      action={
        <BoardLink to="/leaderboard" className="text-xs font-medium text-muted hover:text-fg">
          {t("fullTable")}
        </BoardLink>
      }
    >
      <ol>
        {data.ranking
          .filter((p) => !p.provisional)
          .map((p, i) => (
            <motion.li key={p.id} {...fade(i + 2)}>
              <RankingRow player={p} rankedAfter={data.rankedAfter} />
            </motion.li>
          ))}
      </ol>
      <NewPlayers players={data.ranking.filter((p) => p.provisional)} rankedAfter={data.rankedAfter} />
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
    <Panel title={t("hotCold")} subtitle={t("hotSub")} icon={<Flame className="size-4" />} className="lg:col-span-4">
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
  const { name } = useBoard();
  return (
    <DataGate>
      {(data) => {
        const top = data.ranking.slice(0, 6).map((p) => ({ name: p.name, history: p.history }));
        if (!data.parsed.length) return <GettingStarted players={data.ranking.length} />;
        return (
          <div className="space-y-6">
            <header className="min-w-0">
              <p className="label text-accent-text">{data.season?.name ?? t("eyebrow")}</p>
              <h1 lang={nameLang(name)} className="display mt-2 truncate text-4xl sm:text-5xl">
                {name}
              </h1>
            </header>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
              <div className="min-w-0 space-y-4 lg:col-span-7">
                <LastNight data={data} />
                <KpiStrip data={data} />
              </div>
              <PowerRankings data={data} className="lg:col-span-5" />
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
              <Panel
                title={t("race")}
                subtitle={t("raceSub")}
                icon={<TrendingUp className="size-4" />}
                className="lg:col-span-8"
              >
                <EloRaceChart series={top} />
              </Panel>
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
