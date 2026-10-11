import { motion } from "motion/react";
import {
  BrickWall,
  Clock,
  Crown,
  Droplets,
  Dumbbell,
  Flame,
  Goal,
  Handshake,
  HeartCrack,
  HeartHandshake,
  MoonStar,
  Newspaper,
  ShieldCheck,
  Skull,
  Sunrise,
  Swords,
  TrendingUp,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useMemo, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { BoardLink } from "../components/board/BoardLink";
import { DataGate } from "../components/DataGate";
import { MatchPhotosButton } from "../components/match/MatchPhotos";
import { Avatar, ClubCrest } from "../components/ui/Identity";
import { Panel, Pill } from "../components/ui/primitives";
import type { Analytics } from "../hooks/analytics-context";
import { useBoard } from "../hooks/useBoard";
import { useT } from "../hooks/useI18n";
import { cn } from "../lib/cn";
import { dayFromKey, displayName, formatTime, formatWeekday } from "../lib/format";
import { defineMessages } from "../lib/i18n";
import {
  NIGHT_RECAP,
  nightRecap,
  nightRecapOn,
  type DuoNight,
  type NightAward,
  type NightAwardKey,
  type NightRecap as Recap,
} from "../lib/nightRecap";
import type { ParsedMatch } from "../lib/stats";

const msg = defineMessages({
  en: {
    paper: "The Night Post",
    edition: "Late edition · {date}",
    kickoff: "First whistle {start} · last {end}",
    upsetKicker: "Upset of the night",
    upsetDeck: "{names} kicked off with a {chance}% chance. On paper it was impossible.",
    clubKicker: "Club of the night",
    clubHead: "{club}: {w}W {d}D {l}L",
    clubDeckUnderdog: "One of the night's weakest clubs on paper (rated {elo}), scored {gf} and let in {ga}.",
    clubDeck: "Rated {elo}, scored {gf} and let in {ga}.",
    festKicker: "Goal rain",
    festDeck: "{n} goals at {time}. The neighbours have questions.",
    streakKicker: "Unstoppable",
    streakHead: "{name}: {n} without a loss",
    lastKicker: "The last word",
    lastDeck: "{time}, the night's final match: won by {names}.",
    matches: "Matches",
    goals: "Goals",
    perMatch: "Goals/match",
    draws: "Draws",
    upsets: "Upsets",
    length: "Length",
    hours: "{h}h {m}m",
    awards: "The awards",
    awardsSub: "Worked out from tonight's matches only",
    runnerUp: "Runner-up:",
    market: "Elo market close",
    marketSub: "Who bought, who sold",
    duos: "Duos",
    dream: "Dream duo",
    nightmare: "Nightmare duo",
    duoLine: "{w}W {d}D {l}L · goals {gf}–{ga}",
    flow: "How the night went",
    flowSub: "{n} matches, oldest first",
    upsetTag: "Upset · {chance}%",
    festTag: "{n} goals",
    gone: "This report is no longer on show.",
    // awards: title, caption, value, line
    king: "King of the Night",
    kingCap: "Most Elo won",
    kingVal: "+{v} Elo",
    kingLine: "Crown on, throne taken: {w}W {d}D {l}L.",
    giantSlayer: "Giant Slayer",
    giantSlayerCap: "Wins as the underdog",
    giantSlayerVal: "{v} wins",
    giantSlayerLine: "Favourites started praying when they saw the line-ups.",
    unbeaten: "The Invincible",
    unbeatenCap: "Matches in a row without a loss",
    unbeatenVal: "{v} matches",
    unbeatenLine: "For {v} matches straight, nobody could bring them down.",
    machine: "Goal Machine",
    machineCap: "Goals scored per match",
    machineVal: "{v} a match",
    machineLine: "{gf} in total. The keepers still can't sleep.",
    wall: "The Wall",
    wallCap: "Fewest goals let in per match",
    wallVal: "{v} a match",
    wallLine: "Let in {ga} all night; everything else hit the wall.",
    nightOwl: "Night Owl",
    nightOwlCap: "Most points after midnight",
    nightOwlVal: "{v} points",
    nightOwlLine: "{v} points from {n} matches: got better as the clock ran.",
    diplomat: "The Diplomat",
    diplomatCap: "Most draws",
    diplomatVal: "{v} draws",
    diplomatLine: "Upset nobody, and let nobody upset them.",
    ironMan: "Iron Man",
    ironManCap: "Most matches played",
    ironManVal: "{v} matches",
    ironManLine: "On the pitch for {v} of the night's {total} matches.",
    cursed: "Cursed Favourite",
    cursedCap: "Losses as the favourite",
    cursedVal: "{v} losses",
    cursedLine: "Big clubs, big letdowns. The odds were never the problem.",
    sieve: "The Colander",
    sieveCap: "Most goals let in per match",
    sieveVal: "{v} a match",
    sieveLine: "{ga} let in. Less a net, more a colander.",
    tomorrow: "Tomorrow's Another Day",
    tomorrowCap: "Most Elo lost",
    tomorrowVal: "−{v} Elo",
    tomorrowLine: "Elo comes and goes; the group stays.",
    chinUp: "Chin Up",
    chinUpCap: "Fewest points per match",
    chinUpVal: "{w}W {d}D {l}L",
    chinUpLine: "Not tonight. The next night is theirs.",
  },
  tr: {
    paper: "Gece Postası",
    edition: "Son baskı · {date}",
    kickoff: "İlk düdük {start} · son düdük {end}",
    upsetKicker: "Gecenin sürprizi",
    upsetDeck: "{names} maça sadece %{chance} şansla başladı. Kâğıt üstünde imkânsızdı.",
    clubKicker: "Gecenin kulübü",
    clubHead: "{club}: {w}G {d}B {l}M",
    clubDeckUnderdog: "Kâğıt üstünde gecenin en zayıf kulüplerinden (puanı {elo}); {gf} attı, {ga} yedi.",
    clubDeck: "Puanı {elo}; {gf} attı, {ga} yedi.",
    festKicker: "Gol yağmuru",
    festDeck: "Saat {time}, {n} gol. Komşuların soruları var.",
    streakKicker: "Durdurulamaz",
    streakHead: "{name}: {n} maç yenilgisiz",
    lastKicker: "Son söz",
    lastDeck: "Saat {time}, gecenin son maçı: kazanan {names}.",
    matches: "Maç",
    goals: "Gol",
    perMatch: "Gol/maç",
    draws: "Beraberlik",
    upsets: "Sürpriz",
    length: "Süre",
    hours: "{h} sa {m} dk",
    awards: "Ödüller",
    awardsSub: "Sadece bu gecenin maçlarından hesaplandı",
    runnerUp: "İkinci:",
    market: "Elo Borsası kapanışı",
    marketSub: "Kim aldı, kim sattı",
    duos: "İkililer",
    dream: "Rüya ikili",
    nightmare: "Kâbus ikili",
    duoLine: "{w}G {d}B {l}M · goller {gf}–{ga}",
    flow: "Gecenin akışı",
    flowSub: "{n} maç, ilkinden sonuncusuna",
    upsetTag: "Sürpriz · %{chance}",
    festTag: "{n} gol",
    gone: "Bu rapor artık yayında değil.",
    king: "Gecenin Kralı",
    kingCap: "En çok Elo kazanan",
    kingVal: "+{v} Elo",
    kingLine: "Tacı taktı, tahta oturdu: {w}G {d}B {l}M.",
    giantSlayer: "Dev Avcısı",
    giantSlayerCap: "Kâğıt üstünde zayıfken kazandığı maçlar",
    giantSlayerVal: "{v} galibiyet",
    giantSlayerLine: "Favoriler kadroyu görünce dua etmeye başladı.",
    unbeaten: "Yenilmez Armada",
    unbeatenCap: "Üst üste yenilmediği maçlar",
    unbeatenVal: "{v} maç",
    unbeatenLine: "Tam {v} maç boyunca kimse onu deviremedi.",
    machine: "Gol Makinesi",
    machineCap: "Maç başına atılan gol",
    machineVal: "maç başı {v}",
    machineLine: "Toplam {gf} gol. Kaleciler hâlâ uyuyamıyor.",
    wall: "Duvar",
    wallCap: "Maç başına en az gol yiyen",
    wallVal: "maç başı {v}",
    wallLine: "Bütün gece {ga} gol yedi; gerisi duvara çarptı.",
    nightOwl: "Gece Kuşu",
    nightOwlCap: "Gece yarısından sonra en çok puan",
    nightOwlVal: "{v} puan",
    nightOwlLine: "{n} maçta {v} puan: saat ilerledikçe açıldı.",
    diplomat: "Diplomat",
    diplomatCap: "En çok beraberlik",
    diplomatVal: "{v} beraberlik",
    diplomatLine: "Kimseyi kırmadı, kimseye kırılmadı.",
    ironMan: "Demir Adam",
    ironManCap: "En çok maça çıkan",
    ironManVal: "{v} maç",
    ironManLine: "Gecenin {total} maçından {v} tanesinde sahadaydı.",
    cursed: "Lanetli Favori",
    cursedCap: "Favoriyken kaybedilen maçlar",
    cursedVal: "{v} mağlubiyet",
    cursedLine: "Büyük kulüp, büyük hayal kırıklığı. Sorun hiçbir zaman ihtimaller değildi.",
    sieve: "Kevgir",
    sieveCap: "Maç başına en çok gol yiyen",
    sieveVal: "maç başı {v}",
    sieveLine: "{ga} gol yedi. Kale değil, kevgir.",
    tomorrow: "Yarın Yeni Bir Gün",
    tomorrowCap: "En çok Elo kaybeden",
    tomorrowVal: "−{v} Elo",
    tomorrowLine: "Elo gelir geçer, ekip baki kalır.",
    chinUp: "Moral Ödülü",
    chinUpCap: "Maç başına en az puan",
    chinUpVal: "{w}G {d}B {l}M",
    chinUpLine: "Bu gece olmadı. Bir sonraki gece onun gecesi.",
  },
});

const useMsg = () => useT(msg);
type T = ReturnType<typeof useMsg>;

const ICONS: Record<NightAwardKey, LucideIcon> = {
  king: Crown,
  giantSlayer: Swords,
  unbeaten: ShieldCheck,
  machine: Goal,
  wall: BrickWall,
  nightOwl: MoonStar,
  diplomat: Handshake,
  ironMan: Dumbbell,
  cursed: Skull,
  sieve: Droplets,
  tomorrow: Sunrise,
  chinUp: HeartHandshake,
};

const pct = (p: number) => Math.max(1, Math.round(p * 100));
const names = (list: string[]) => list.map(displayName).join(" & ");
const decimal = (v: number) => Math.abs(v).toFixed(1);

function awardValue(t: T, a: NightAward, value = a.value) {
  const p = a.winner;
  if (a.key === "chinUp") return t("chinUpVal", { w: p.wins, d: p.draws, l: p.losses });
  const v = a.key === "machine" || a.key === "wall" || a.key === "sieve" ? decimal(value) : Math.abs(value);
  return t(`${a.key}Val`, { v });
}

function awardLine(t: T, a: NightAward, total: number) {
  const p = a.winner;
  return t(`${a.key}Line`, {
    v: a.key === "nightOwl" ? p.latePoints : Math.abs(a.value),
    n: p.lateGames,
    w: p.wins,
    d: p.draws,
    l: p.losses,
    gf: p.gf,
    ga: p.ga,
    total,
  });
}

/* --------------------------------- Front page -------------------------------- */

function Story({ kicker, icon: Icon, head, deck, className }: { kicker: string; icon: LucideIcon; head: ReactNode; deck: string; className?: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      <p className="label flex items-center gap-1.5 text-accent-text">
        <Icon className="size-3.5" /> {kicker}
      </p>
      <h3 className="display mt-1.5 text-2xl leading-tight text-balance">{head}</h3>
      <p className="mt-1.5 text-sm text-muted">{deck}</p>
    </div>
  );
}

function ScoreLine({ m }: { m: ParsedMatch }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
      <span className="inline-flex items-center gap-1.5">
        <ClubCrest name={m.clubA} size="sm" /> {m.clubA}
      </span>
      <span className="tabular">
        {m.scoreA}–{m.scoreB}
      </span>
      <span className="inline-flex items-center gap-1.5">
        {m.clubB} <ClubCrest name={m.clubB} size="sm" />
      </span>
    </span>
  );
}

function FrontPage({ r, t }: { r: Recap; t: T }) {
  const upset = r.biggestUpset;
  const unbeaten = r.awards.find((a) => a.key === "unbeaten");
  const king = r.awards.find((a) => a.key === "king");
  // the biggest upset leads; a night without one leads with its goal rain
  const lead = upset
    ? {
        kicker: t("upsetKicker"),
        icon: Zap,
        match: upset.match,
        deck: t("upsetDeck", { names: names(upset.winner === "A" ? upset.match.teamA : upset.match.teamB), chance: pct(upset.chance) }),
      }
    : r.goalFest && {
        kicker: t("festKicker"),
        icon: Flame,
        match: r.goalFest,
        deck: t("festDeck", { n: r.goalFest.scoreA + r.goalFest.scoreB, time: formatTime(r.goalFest.date) }),
      };
  const minutes = Math.round((r.end.getTime() - r.start.getTime()) / 60000);
  const stats: [string, string | number][] = [
    [t("matches"), r.matches.length],
    [t("goals"), r.goals],
    [t("perMatch"), (r.goals / Math.max(1, r.matches.length)).toFixed(1)],
    [t("draws"), r.draws],
    [t("upsets"), r.upsets],
    [t("length"), t("hours", { h: Math.floor(minutes / 60), m: minutes % 60 })],
  ];
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="card relative overflow-hidden p-5 sm:p-8"
    >
      <div className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-accent opacity-10 blur-3xl" />
      <header className="border-b-2 border-fg/80 pb-3 text-center">
        <p className="display text-4xl tracking-wide uppercase sm:text-6xl">{t("paper")}</p>
        <p className="mt-1 flex flex-wrap justify-center gap-x-3 text-xs text-muted">
          <span>{t("edition", { date: formatWeekday(dayFromKey(r.key)) })}</span>
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3" /> {t("kickoff", { start: formatTime(r.start), end: formatTime(r.end) })}
          </span>
        </p>
      </header>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr] lg:gap-8">
        <div className="space-y-6">
          {lead && (
            <Story
              kicker={lead.kicker}
              icon={lead.icon}
              head={<span className="text-3xl sm:text-5xl"><ScoreLine m={lead.match} /></span>}
              deck={lead.deck}
            />
          )}
          <div className="grid gap-5 border-line sm:grid-cols-2 lg:border-t lg:pt-5">
            {unbeaten && (
              <Story
                kicker={t("streakKicker")}
                icon={ShieldCheck}
                head={t("streakHead", { name: displayName(unbeaten.winner.name), n: unbeaten.value })}
                deck={t("unbeatenLine", { v: unbeaten.value })}
              />
            )}
            {r.lastWord && (
              <Story
                kicker={t("lastKicker")}
                icon={Newspaper}
                head={<ScoreLine m={r.lastWord.match} />}
                deck={t("lastDeck", {
                  names: names(r.lastWord.winner === "A" ? r.lastWord.match.teamA : r.lastWord.match.teamB),
                  time: formatTime(r.lastWord.match.date),
                })}
              />
            )}
          </div>
        </div>
        <div className="space-y-5 lg:border-l lg:border-line lg:pl-8">
          {r.club && (
            <Story
              kicker={t("clubKicker")}
              icon={Crown}
              head={
                <span className="inline-flex items-center gap-2">
                  <ClubCrest name={r.club.club} size="md" />
                  {t("clubHead", { club: r.club.club, w: r.club.wins, d: r.club.draws, l: r.club.losses })}
                </span>
              }
              deck={t(r.club.underdog ? "clubDeckUnderdog" : "clubDeck", { elo: r.club.elo, gf: r.club.gf, ga: r.club.ga })}
            />
          )}
          {upset && r.goalFest && (
            <Story
              kicker={t("festKicker")}
              icon={Flame}
              head={<ScoreLine m={r.goalFest} />}
              deck={t("festDeck", { n: r.goalFest.scoreA + r.goalFest.scoreB, time: formatTime(r.goalFest.date) })}
            />
          )}
          {king && (
            <Story
              kicker={t("king")}
              icon={Crown}
              head={
                <span className="inline-flex items-center gap-2">
                  <Avatar name={king.winner.name} size="sm" />
                  {displayName(king.winner.name)} {awardValue(t, king)}
                </span>
              }
              deck={awardLine(t, king, r.matches.length)}
            />
          )}
        </div>
      </div>

      <dl className="mt-8 grid grid-cols-3 gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-6">
        {stats.map(([label, value]) => (
          <div key={label} className="bg-surface px-3 py-3 text-center">
            <dt className="label">{label}</dt>
            <dd className="display tabular mt-1 text-xl whitespace-nowrap sm:text-2xl">{value}</dd>
          </div>
        ))}
      </dl>
    </motion.section>
  );
}

/* ---------------------------------- Awards ---------------------------------- */

function AwardTile({ a, t, total, index }: { a: NightAward; t: T; total: number; index: number }) {
  const Icon = ICONS[a.key];
  return (
    <motion.div
      initial={{ opacity: 0, y: 14, rotate: index % 2 ? 1.5 : -1.5 }}
      whileInView={{ opacity: 1, y: 0, rotate: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ delay: 0.04 * (index % 4), type: "spring", bounce: 0.3, duration: 0.6 }}
      className="card card-hover relative flex flex-col overflow-hidden p-5"
    >
      <div
        className="pointer-events-none absolute -top-12 -right-12 size-36 rounded-full blur-3xl"
        style={{ background: a.roast ? "var(--loss)" : "var(--accent)", opacity: 0.12 }}
      />
      <div className="flex items-center gap-2.5">
        <span
          className={cn(
            "grid size-9 shrink-0 place-items-center rounded-xl ring-1",
            a.roast ? "bg-loss/12 text-loss ring-loss/25" : "bg-accent/12 text-accent-text ring-accent/25",
          )}
        >
          <Icon className="size-[18px]" />
        </span>
        <div className="min-w-0">
          <p className="truncate font-semibold">{t(a.key)}</p>
          <p className="line-clamp-2 text-[11px] text-muted">{t(`${a.key}Cap`)}</p>
        </div>
      </div>
      <BoardLink to={`/players/${encodeURIComponent(a.winner.name)}`} className="mt-5 flex items-center gap-3 hover:opacity-90">
        <Avatar name={a.winner.name} size="lg" ring={a.roast ? undefined : "accent"} />
        <div className="min-w-0">
          <p className="display truncate text-2xl">{displayName(a.winner.name)}</p>
          <p className={cn("display text-xl", a.roast ? "text-loss" : "text-accent-text")}>{awardValue(t, a)}</p>
        </div>
      </BoardLink>
      <p className="mt-3 flex-1 text-xs text-muted">{awardLine(t, a, total)}</p>
      {a.runnerUp && a.key !== "chinUp" && (
        <p className="mt-3 border-t border-line pt-3 text-[11px] text-faint">
          {t("runnerUp")} <span className="font-semibold text-muted">{displayName(a.runnerUp.name)}</span>{" "}
          {awardValue(t, a, a.runnerUp.value)}
        </p>
      )}
    </motion.div>
  );
}

/* --------------------------------- Elo market -------------------------------- */

function Market({ r, t }: { r: Recap; t: T }) {
  const max = Math.max(1, ...r.players.map((p) => Math.abs(p.delta)));
  return (
    <Panel title={t("market")} subtitle={t("marketSub")} icon={<TrendingUp className="size-4" />} className="lg:col-span-7">
      <ul className="space-y-2.5">
        {r.players.map((p, i) => {
          const up = p.delta >= 0;
          return (
            <motion.li
              key={p.name}
              initial={{ opacity: 0, x: -8 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.04 * i }}
              className="grid grid-cols-[minmax(0,7rem)_1fr_3.5rem] items-center gap-3 text-sm"
            >
              <BoardLink to={`/players/${encodeURIComponent(p.name)}`} className="flex min-w-0 items-center gap-2 hover:text-fg">
                <Avatar name={p.name} size="xs" />
                <span className="truncate font-medium">{displayName(p.name)}</span>
              </BoardLink>
              <div className="grid grid-cols-2 items-center">
                <div className="flex h-2.5 justify-end">
                  {!up && (
                    <motion.span
                      className="rounded-l-full bg-loss"
                      initial={{ width: 0 }}
                      whileInView={{ width: `${(Math.abs(p.delta) / max) * 100}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.7, delay: 0.04 * i }}
                    />
                  )}
                </div>
                <div className="flex h-2.5 border-l border-line-strong">
                  {up && (
                    <motion.span
                      className="rounded-r-full bg-win"
                      initial={{ width: 0 }}
                      whileInView={{ width: `${(p.delta / max) * 100}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.7, delay: 0.04 * i }}
                    />
                  )}
                </div>
              </div>
              <span className={cn("tabular text-right font-semibold", up ? "text-win" : "text-loss")}>
                {up ? "+" : "−"}
                {Math.abs(Math.round(p.delta))}
              </span>
              <span className="col-span-3 -mt-1.5 pl-7 text-[11px] text-faint">
                {t("duoLine", { w: p.wins, d: p.draws, l: p.losses, gf: p.gf, ga: p.ga })}
              </span>
            </motion.li>
          );
        })}
      </ul>
    </Panel>
  );
}

function DuoCard({ d, title, icon: Icon, tone, t }: { d: DuoNight; title: string; icon: LucideIcon; tone: "win" | "loss"; t: T }) {
  return (
    <div className="rounded-2xl border border-line bg-surface-2/40 p-4">
      <p className={cn("label flex items-center gap-1.5", tone === "win" ? "text-win" : "text-loss")}>
        <Icon className="size-3.5" /> {title}
      </p>
      <div className="mt-3 flex items-center gap-3">
        <span className="flex -space-x-2">
          <Avatar name={d.pair[0]} size="md" />
          <Avatar name={d.pair[1]} size="md" />
        </span>
        <div className="min-w-0">
          <p className="display truncate text-xl">{names(d.pair)}</p>
          <p className="text-xs text-muted">{t("duoLine", { w: d.wins, d: d.draws, l: d.losses, gf: d.gf, ga: d.ga })}</p>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------- Timeline --------------------------------- */

/** "A & B" on one line; on phones one name a line, so neither gets cut. */
function Team({ list, align }: { list: string[]; align: "left" | "right" }) {
  return (
    <>
      <span className="truncate max-sm:hidden">{names(list)}</span>
      <span className={cn("flex min-w-0 flex-col text-[11px] leading-tight sm:hidden", align === "right" && "items-end")}>
        {list.map((n) => (
          <span key={n} className="max-w-full truncate">
            {displayName(n)}
          </span>
        ))}
      </span>
    </>
  );
}

function Flow({ r, data, t }: { r: Recap; data: Analytics; t: T }) {
  const upsetIds = new Map(
    r.matches.flatMap((m) => {
      const e = data.engine.perMatch.get(m.id);
      if (!e || m.result === "D") return [];
      const chance = m.result === "A" ? e.expectedA : 1 - e.expectedA;
      return chance < 0.35 ? [[m.id, chance] as const] : [];
    }),
  );
  return (
    <Panel title={t("flow")} subtitle={t("flowSub", { n: r.matches.length })} icon={<Clock className="size-4" />}>
      <ol className="relative space-y-1.5 border-l border-line pl-4">
        {r.matches.map((m) => {
          const chance = upsetIds.get(m.id);
          const goals = m.scoreA + m.scoreB;
          const winA = m.result === "A";
          const winB = m.result === "B";
          return (
            <li key={m.id} className="relative">
              <span
                className={cn(
                  "absolute top-1/2 -left-[21px] size-2.5 -translate-y-1/2 rounded-full ring-4 ring-surface",
                  chance !== undefined ? "bg-draw" : goals >= 10 ? "bg-loss" : "bg-line-strong",
                )}
              />
              <div className="grid grid-cols-[2.25rem_1fr_auto_1fr_auto] items-center gap-1.5 rounded-xl px-1 py-1.5 text-sm hover:bg-surface-2/60 sm:grid-cols-[2.75rem_1fr_auto_1fr_auto] sm:gap-2 sm:px-2">
                <span className="tabular text-[11px] text-faint">{formatTime(m.date)}</span>
                <span className={cn("flex min-w-0 items-center justify-end gap-1.5 text-right", !winA && "text-muted")}>
                  <Team list={m.teamA} align="right" />
                  <ClubCrest name={m.clubA} size="xs" />
                </span>
                <span className="display tabular text-lg sm:px-1">
                  {m.scoreA}–{m.scoreB}
                </span>
                <span className={cn("flex min-w-0 items-center gap-1.5", !winB && "text-muted")}>
                  <ClubCrest name={m.clubB} size="xs" />
                  <Team list={m.teamB} align="left" />
                </span>
                <span className="flex items-center justify-end gap-1">
                  {chance !== undefined && (
                    <Pill tone="draw" className="px-1.5">
                      <Zap className="size-3" />
                      <span className="max-sm:hidden">{t("upsetTag", { chance: pct(chance) })}</span>
                    </Pill>
                  )}
                  {goals >= 10 && (
                    <Pill tone="loss" className="px-1.5">
                      <Flame className="size-3" />
                      <span className="max-sm:hidden">{t("festTag", { n: goals })}</span>
                    </Pill>
                  )}
                  <MatchPhotosButton match={m} />
                </span>
              </div>
            </li>
          );
        })}
      </ol>
    </Panel>
  );
}

/* ------------------------------------ Page ----------------------------------- */

function NightRecapInner({ data }: { data: Analytics }) {
  const t = useMsg();
  const day = data.matchdays.find((d) => d.key === NIGHT_RECAP.night);
  const r = useMemo(() => (day ? nightRecap(day, data.engine, data.appearances) : null), [day, data.engine, data.appearances]);
  if (!r) return <p className="text-sm text-muted">{t("gone")}</p>;
  const honours = r.awards.filter((a) => !a.roast);
  const roasts = r.awards.filter((a) => a.roast);
  return (
    <div className="space-y-6">
      <FrontPage r={r} t={t} />

      <section>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 className="display text-3xl">{t("awards")}</h2>
            <p className="text-xs text-muted">{t("awardsSub")}</p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[...honours, ...roasts].map((a, i) => (
            <AwardTile key={a.key} a={a} t={t} total={r.matches.length} index={i} />
          ))}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-12">
        <Market r={r} t={t} />
        {(r.dreamDuo || r.nightmareDuo) && (
          <Panel title={t("duos")} icon={<Users className="size-4" />} className="lg:col-span-5" bodyClassName="space-y-3 p-5">
            {r.dreamDuo && <DuoCard d={r.dreamDuo} title={t("dream")} icon={Handshake} tone="win" t={t} />}
            {r.nightmareDuo && <DuoCard d={r.nightmareDuo} title={t("nightmare")} icon={HeartCrack} tone="loss" t={t} />}
          </Panel>
        )}
      </div>

      <Flow r={r} data={data} t={t} />
    </div>
  );
}

/** Temporary: the report of one night (NIGHT_RECAP), on show for a few days. */
export default function NightRecap() {
  const board = useBoard();
  if (!nightRecapOn()) return <Navigate to={board.path()} replace />;
  return <DataGate>{(data) => <NightRecapInner data={data} />}</DataGate>;
}
