import { motion } from "motion/react";
import { useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, ChevronDown, Scale, Shirt, X } from "lucide-react";
import { BoardLink } from "../components/board/BoardLink";
import { clubMessages, slotMessages } from "../components/clubs/messages";
import { Bench, CardFace, Pitch } from "../components/clubs/Pitch";
import { DataGate } from "../components/DataGate";
import { MatchCard } from "../components/match/MatchCard";
import { ClubCrest, Stars } from "../components/ui/Identity";
import { EmptyState, FormPills, Panel, Pill } from "../components/ui/primitives";
import type { Analytics } from "../hooks/analytics-context";
import { useCards } from "../hooks/useData";
import { useT } from "../hooks/useI18n";
import { cn } from "../lib/cn";
import { SLOTS, STATS, type RatedClub } from "../lib/clubModel";
import { cardLine, clubFinder, clubRecord, distinctGameName, referenceSeason, runModel } from "../lib/clubs";
import { clubStars, expectedScore } from "../lib/elo";
import type { ParsedMatch } from "../lib/stats";
import type { Club } from "../lib/types";

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

function Bar({ value, min, max, tone = "accent" }: { value: number | null; min: number; max: number; tone?: "accent" | "a" | "b" }) {
  const pct = value == null ? 0 : Math.max(2, Math.min(100, ((value - min) / (max - min)) * 100));
  return (
    <span className="block h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
      <span
        className={cn("block h-full rounded-full", tone === "a" ? "bg-team-a" : tone === "b" ? "bg-team-b" : "bg-accent")}
        style={{ width: `${pct}%` }}
      />
    </span>
  );
}

function SquadProfile({ rated }: { rated: RatedClub }) {
  const t = useT(clubMessages);
  const ts = useT(slotMessages);
  return (
    <Panel title={t("balance")} subtitle={t("balanceSub")}>
      <div className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
        <div className="space-y-2.5">
          {SLOTS.map((s) => (
            <div key={s.key} className="grid grid-cols-[3.5rem_1fr_2.5rem] items-center gap-3 text-sm">
              <span className="text-xs font-semibold text-muted">{ts(s.key)}</span>
              <Bar value={rated.slotAvg[s.key]} min={60} max={92} />
              <span className="tabular text-right font-semibold">{rated.slotAvg[s.key]?.toFixed(1) ?? "—"}</span>
            </div>
          ))}
        </div>
        <div className="space-y-2.5">
          {STATS.map((k) => (
            <div key={k} className="grid grid-cols-[3.5rem_1fr_2.5rem] items-center gap-3 text-sm">
              <span className="text-xs font-semibold text-muted">{k}</span>
              <Bar value={rated.stats[k]} min={40} max={95} />
              <span className="tabular text-right font-semibold">{rated.stats[k]?.toFixed(0) ?? "—"}</span>
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
}

function OtherCards({ rated, game }: { rated: RatedClub; game: string }) {
  const t = useT(clubMessages);
  const [open, setOpen] = useState(false);
  if (!rated.outside.length) return null;
  return (
    <Panel
      title={t("others", { n: rated.outside.length })}
      subtitle={t("othersSub")}
      action={
        <button onClick={() => setOpen((o) => !o)} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg" aria-expanded={open}>
          <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
        </button>
      }
      bodyClassName={open ? "p-2 pt-3" : "p-0"}
    >
      {open && (
        <ul className="grid gap-1 sm:grid-cols-2">
          {rated.outside.map((c) => (
            <li key={c.id} className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-surface-2/60" title={c.fullName}>
              <CardFace game={game} card={c} size={32} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{c.name}</span>
                <span className="tabular block truncate text-xs font-semibold text-muted">{cardLine(c)}</span>
              </span>
              <span className="tabular w-7 text-right font-display text-base font-bold">{c.ovr}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function Compare({
  data,
  a,
  b,
  ratedA,
  ratedB,
  onClear,
}: {
  data: Analytics;
  a: Club;
  b: Club;
  ratedA?: RatedClub;
  ratedB?: RatedClub;
  onClear: () => void;
}) {
  const t = useT(clubMessages);
  const ts = useT(slotMessages);
  const pA = expectedScore(a.elo / 2, b.elo / 2);
  const meetings = data.parsed.filter(
    (m) => (same(m.clubA, a.name) && same(m.clubB, b.name)) || (same(m.clubA, b.name) && same(m.clubB, a.name)),
  );
  const tally = meetings.reduce(
    (acc, m) => {
      const aSide = same(m.clubA, a.name) ? "A" : "B";
      if (m.result === "D") acc.d++;
      else if (m.result === aSide) acc.a++;
      else acc.b++;
      return acc;
    },
    { a: 0, d: 0, b: 0 },
  );
  const rows: { label: string; va: number | null; vb: number | null; digits: number }[] = [
    { label: t("elo"), va: a.elo, vb: b.elo, digits: 0 },
    ...(ratedA && ratedB
      ? [
          { label: t("ovr"), va: ratedA.ovr, vb: ratedB.ovr, digits: 1 },
          { label: t("xi"), va: ratedA.xiScore, vb: ratedB.xiScore, digits: 1 },
          { label: t("bench"), va: ratedA.benchScore, vb: ratedB.benchScore, digits: 1 },
          ...SLOTS.map((s) => ({ label: ts(s.key), va: ratedA.slotAvg[s.key], vb: ratedB.slotAvg[s.key], digits: 1 })),
          ...STATS.map((k) => ({ label: k, va: ratedA.stats[k], vb: ratedB.stats[k], digits: 0 })),
        ]
      : []),
  ];
  return (
    <Panel
      title={t("compare")}
      icon={<Scale className="size-4" />}
      action={
        <button onClick={onClear} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg" aria-label={t("clear")}>
          <X className="size-4" />
        </button>
      }
    >
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <span className="flex min-w-0 items-center gap-3">
          <ClubCrest name={a.name} size="lg" />
          <span className="truncate font-semibold">{a.name}</span>
        </span>
        <span className="text-xs font-bold text-faint">VS</span>
        <BoardLink to={`/clubs/${encodeURIComponent(b.name)}`} className="flex min-w-0 items-center justify-end gap-3 hover:text-accent-text">
          <span className="truncate text-right font-semibold">{b.name}</span>
          <ClubCrest name={b.name} size="lg" />
        </BoardLink>
      </div>
      <div className="mt-5">
        <div className="mb-1.5 flex justify-between text-xs">
          <span className="tabular font-semibold text-team-a">{Math.round(pA * 100)}%</span>
          <span className="text-muted">{t("winChance")}</span>
          <span className="tabular font-semibold text-team-b">{Math.round((1 - pA) * 100)}%</span>
        </div>
        <div className="flex h-2 overflow-hidden rounded-full">
          <span className="bg-team-a" style={{ width: `${pA * 100}%` }} />
          <span className="bg-team-b" style={{ width: `${(1 - pA) * 100}%` }} />
        </div>
      </div>
      <div className="mt-5 space-y-2">
        {rows.map((r) => {
          const better = r.va != null && r.vb != null ? Math.sign(r.va - r.vb) : 0;
          return (
            <div key={r.label} className="grid grid-cols-[3.5rem_1fr_4.5rem_1fr_3.5rem] items-center gap-2 text-sm">
              <span className={cn("tabular text-right", better > 0 ? "font-bold text-fg" : "text-muted")}>{r.va?.toFixed(r.digits) ?? "—"}</span>
              <span className="flex justify-end">
                <span className="block h-1.5 rounded-full bg-team-a" style={{ width: `${Math.max(4, Math.min(100, ((r.va ?? 0) / Math.max(r.va ?? 0, r.vb ?? 0, 1)) * 100))}%` }} />
              </span>
              <span className="text-center text-[11px] font-semibold text-faint uppercase">{r.label}</span>
              <span className="block h-1.5 rounded-full bg-team-b" style={{ width: `${Math.max(4, Math.min(100, ((r.vb ?? 0) / Math.max(r.va ?? 0, r.vb ?? 0, 1)) * 100))}%` }} />
              <span className={cn("tabular", better < 0 ? "font-bold text-fg" : "text-muted")}>{r.vb?.toFixed(r.digits) ?? "—"}</span>
            </div>
          );
        })}
      </div>
      <div className="hairline my-5" />
      <p className="text-sm text-muted">{meetings.length ? t("meetings", tally) : t("noMeetings")}</p>
      {meetings.length > 0 && (
        <div className="mt-3 space-y-2">
          {meetings.slice(0, 4).map((m) => (
            <MatchCard key={m.id} match={m} elo={data.engine.perMatch.get(m.id)} />
          ))}
        </div>
      )}
    </Panel>
  );
}

function ClubProfileInner({ data }: { data: Analytics }) {
  const t = useT(clubMessages);
  const { club: param = "" } = useParams();
  const [params, setParams] = useSearchParams();
  const name = decodeURIComponent(param);
  const season = data.seasons.find((s) => String(s.id) === params.get("season")) ?? data.season ?? data.seasons.at(-1) ?? null;
  const club = season?.clubs.find((c) => same(c.name, name)) ?? null;
  const cards = useCards(season?.game);
  const reference = season ? referenceSeason(data.seasons, season) : null;
  const model = useMemo(
    () => (cards.data && season?.game ? runModel(cards.data, season.model, reference) : null),
    [cards.data, season, reference],
  );
  const ratedOf = (c: Club | null) =>
    c ? model?.rows.find((r) => (c.eaId != null && r.club.eaId === c.eaId) || same(r.club.name, c.name)) : undefined;
  const rated = ratedOf(club);
  const before = club && reference ? clubFinder(reference.clubs)({ eaId: club.eaId ?? -1, name: club.name }) : null;
  const displayName = club?.name ?? name;
  const record = useMemo(() => clubRecord(data.parsed, displayName), [data.parsed, displayName]);
  const played: ParsedMatch[] = useMemo(
    () => data.parsed.filter((m) => same(m.clubA, displayName) || same(m.clubB, displayName)),
    [data.parsed, displayName],
  );
  const vs = season?.clubs.find((c) => same(c.name, params.get("vs") ?? "")) ?? null;
  const rank = club && season ? season.clubs.indexOf(club) + 1 : null;
  const seasonQuery = season && !season.active ? `?season=${season.id}` : "";
  const setVs = (v: string | null) => {
    const next = new URLSearchParams(params);
    if (v) next.set("vs", v);
    else next.delete("vs");
    setParams(next, { replace: true });
  };

  if (!club && !played.length)
    return (
      <div className="card">
        <EmptyState icon={<Shirt className="size-5" />} title={t("notInSeason", { club: name, season: season?.name ?? "" })} />
      </div>
    );

  return (
    <div className="space-y-6">
      <BoardLink to={`/clubs${seasonQuery}`} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg">
        <ArrowLeft className="size-4" /> {t("back")}
      </BoardLink>

      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="card relative overflow-hidden p-5 sm:p-7"
      >
        <div className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-accent/10 blur-3xl" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center">
          <ClubCrest name={displayName} size="2xl" />
          <div className="min-w-0 flex-1">
            <p className="label mb-1 text-accent-text">{rated ? rated.club.league : season?.name}</p>
            <h1 className="display text-4xl sm:text-5xl">{displayName}</h1>
            {rated && distinctGameName(displayName, rated.club.gameName) && (
              <p className="mt-1 text-sm text-muted">{t("inGame", { name: rated.club.gameName })}</p>
            )}
          </div>
          {club && season && (
            <div className="flex items-end gap-6 sm:flex-col sm:items-end sm:gap-1">
              <div className="text-right">
                <p className="label">{t("ratingIn", { season: season.name })}</p>
                <p className="tabular display text-5xl text-accent-text">{club.elo}</p>
              </div>
              <div className="flex flex-col items-end gap-1 text-xs text-muted">
                <Stars value={clubStars(club.elo)} />
                {rank && <span>{t("rankOf", { rank, n: season.clubs.length })}</span>}
                {before && (
                  <span className={cn("tabular font-semibold", club.elo >= before.elo ? "text-win" : "text-loss")}>
                    {reference!.name} {before.elo} → {club.elo}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </motion.section>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="min-w-0 space-y-6 lg:col-span-7">
          {rated && season?.game ? (
            <Panel title={t("squad")} subtitle={t("squadSub")} icon={<Shirt className="size-4" />} bodyClassName="space-y-3 p-3 sm:p-5">
              <Pitch game={season.game} evaluation={rated} className="aspect-[4/5] sm:aspect-[5/5]" />
              <Bench game={season.game} bench={rated.bench} />
            </Panel>
          ) : null}
          {rated && season?.game && <OtherCards rated={rated} game={season.game} />}
          {vs && club ? (
            <Compare data={data} a={club} b={vs} ratedA={rated} ratedB={ratedOf(vs)} onClear={() => setVs(null)} />
          ) : (
            club &&
            season && (
              <Panel title={t("compare")} icon={<Scale className="size-4" />}>
                <select value="" onChange={(e) => setVs(e.target.value)} className="input h-11" aria-label={t("compareWith")}>
                  <option value="">{t("compareWith")}</option>
                  {season.clubs
                    .filter((c) => c.id !== club.id)
                    .map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name} · {c.elo}
                      </option>
                    ))}
                </select>
              </Panel>
            )
          )}
        </div>
        <div className="min-w-0 space-y-6 lg:col-span-5">
          {rated && <SquadProfile rated={rated} />}
          <Panel
            title={t("record")}
            subtitle={record.played ? t("recordSub", { played: record.played, gf: record.gf, ga: record.ga }) : t("noRecord")}
          >
            {record.played > 0 && (
              <div className="mb-4 flex items-center justify-between gap-3">
                <span className="flex gap-1.5">
                  <Pill tone="win">{record.wins}</Pill>
                  <Pill tone="draw">{record.draws}</Pill>
                  <Pill tone="loss">{record.losses}</Pill>
                </span>
                <FormPills outcomes={record.outcomes} />
              </div>
            )}
            <div className="space-y-2">
              {played.slice(0, 6).map((m) => (
                <MatchCard key={m.id} match={m} elo={data.engine.perMatch.get(m.id)} />
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

export default function ClubProfile() {
  return <DataGate>{(data) => <ClubProfileInner data={data} />}</DataGate>;
}
