import { motion } from "motion/react";
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { FlaskConical } from "lucide-react";
import { BoardLink } from "../components/board/BoardLink";
import { clubMessages, slotMessages } from "../components/clubs/messages";
import { ModelWorkshop } from "../components/clubs/ModelWorkshop";
import { DataGate } from "../components/DataGate";
import { PageHeader } from "../components/layout/AppShell";
import { ClubCrest, Stars } from "../components/ui/Identity";
import { Button, EmptyState, FormPills, Pill } from "../components/ui/primitives";
import type { Analytics } from "../hooks/analytics-context";
import { useBoard } from "../hooks/useBoard";
import { useCards } from "../hooks/useData";
import { useT } from "../hooks/useI18n";
import { cn } from "../lib/cn";
import type { SlotKey } from "../lib/clubModel";
import { clubFinder, clubPath, clubRecord, distinctGameName, LATEST_GAME, referenceSeason, runModel } from "../lib/clubs";
import { clubStars } from "../lib/elo";
import { formatDay } from "../lib/format";

function ClubsInner({ data }: { data: Analytics }) {
  const t = useT(clubMessages);
  const ts = useT(slotMessages);
  const { role } = useBoard();
  const [params, setParams] = useSearchParams();
  const season = data.seasons.find((s) => String(s.id) === params.get("season")) ?? data.season ?? data.seasons.at(-1) ?? null;
  const [league, setLeague] = useState("");
  const [workshop, setWorkshop] = useState(params.get("model") === "1");
  const cards = useCards(season?.game);
  const reference = season ? referenceSeason(data.seasons, season) : null;

  const model = useMemo(
    () => (cards.data && season?.game ? runModel(cards.data, season.model, reference) : null),
    [cards.data, season, reference],
  );

  const rows = useMemo(() => {
    if (!season) return [];
    const byEa = new Map(model?.rows.map((r) => [r.club.eaId, r]));
    const byName = new Map(model?.rows.map((r) => [r.club.name.toLowerCase(), r]));
    const ref = reference ? clubFinder(reference.clubs) : null;
    return season.clubs.map((c, i) => {
      const rated = (c.eaId != null ? byEa.get(c.eaId) : undefined) ?? byName.get(c.name.toLowerCase()) ?? null;
      const before = ref ? ref({ eaId: c.eaId ?? -1, name: c.name }) : null;
      return { club: c, rank: i + 1, rated, before, record: clubRecord(data.parsed, c.name) };
    });
  }, [season, model, reference, data.parsed]);

  const leagues = useMemo(() => [...new Set(rows.map((r) => r.rated?.club.league).filter(Boolean) as string[])].sort(), [rows]);
  const shown = league ? rows.filter((r) => r.rated?.club.league === league) : rows;
  const top = Math.max(1, ...rows.map((r) => r.club.elo));
  const bottom = Math.min(0, ...rows.map((r) => r.club.elo));
  const canTune = role === "admin" && season && !season.active;

  if (!season) return <EmptyState title={t("noClubs")} />;

  const description = season.game
    ? t("descCards", {
        clubs: season.clubs.length,
        cards: cards.data?.clubs.reduce((n, c) => n + c.cards.length, 0) ?? "…",
        game: season.game,
        date: cards.data ? formatDay(new Date(cards.data.fetchedAt)) : "…",
      })
    : t("descManual", { clubs: season.clubs.length });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("eyebrow", { season: season.name })}
        title={t("title")}
        description={
          <>
            {description}
            {!season.active && <span className="mt-1 block text-draw">{t("descDraft")}</span>}
          </>
        }
        actions={
          canTune && !workshop ? (
            <Button variant="secondary" onClick={() => setWorkshop(true)}>
              <FlaskConical className="size-4" /> {t("model")}
            </Button>
          ) : undefined
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        {data.seasons.length > 1 &&
          [...data.seasons].reverse().map((s) => (
            <button
              key={s.id}
              onClick={() => {
                setParams(s.id === data.season?.id ? {} : { season: String(s.id) }, { replace: true });
                setLeague("");
                setWorkshop(false);
              }}
              aria-pressed={s.id === season.id}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 font-display text-sm font-bold tracking-wide transition-colors",
                s.id === season.id ? "border-accent/60 bg-accent/10 text-fg" : "border-line text-muted hover:border-line-strong hover:text-fg",
              )}
            >
              {s.active && <span className="size-1.5 rounded-full bg-win shadow-[0_0_8px_var(--win)]" />}
              {s.name}
            </button>
          ))}
        {leagues.length > 1 && (
          <select value={league} onChange={(e) => setLeague(e.target.value)} className="input h-9 w-auto min-w-40 text-sm" aria-label={t("allLeagues")}>
            <option value="">{t("allLeagues")}</option>
            {leagues.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        )}
        {model?.agree && reference && (
          <span title={t("agreeTip", { season: reference.name, mad: model.agree.mad.toFixed(1) })} className="ml-auto">
            <Pill tone="accent">{t("agree", { season: reference.name, rho: model.agree.rho.toFixed(2) })}</Pill>
          </span>
        )}
      </div>

      {workshop && canTune && (
        <ModelWorkshop season={season} seasons={data.seasons} game={season.game ?? LATEST_GAME} onClose={() => setWorkshop(false)} />
      )}

      {cards.error && <p className="text-sm text-loss">{t("cardsFailed", { game: season.game ?? "" })}</p>}

      <div className="card overflow-hidden">
        <table className="w-full border-collapse text-sm">
          <thead className="border-b border-line bg-surface-2/50 text-[11px] font-semibold tracking-wider whitespace-nowrap text-faint uppercase">
            <tr>
              <th className="w-10 px-3 py-3 text-left">{t("rank")}</th>
              <th className="px-2 py-3 text-left">{t("club")}</th>
              <th className="w-28 px-3 py-3 text-right sm:w-40">{t("elo")}</th>
              <th className="hidden px-3 py-3 text-left lg:table-cell">{t("form")}</th>
              {model && (
                <>
                  <th className="hidden px-3 py-3 text-right md:table-cell" title={t("xiTip")}>
                    {t("xi")}
                  </th>
                  <th className="hidden px-3 py-3 text-right xl:table-cell" title={t("benchTip")}>
                    {t("bench")}
                  </th>
                  <th className="hidden px-3 py-3 text-right md:table-cell" title={t("ovrTip")}>
                    {t("ovr")}
                  </th>
                </>
              )}
              {reference && <th className="hidden px-3 py-3 text-right sm:table-cell">{t("vs", { season: reference.name })}</th>}
              {model && <th className="hidden px-3 py-3 text-left xl:table-cell">{t("notes")}</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-line/60">
            {shown.map(({ club, rank, rated, before, record }, i) => (
              <motion.tr
                key={club.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: Math.min(i, 20) * 0.015 }}
                className="group hover:bg-surface-2/50"
              >
                <td className="tabular px-3 py-2.5 font-display text-lg font-bold text-faint">{rank}</td>
                <td className="min-w-0 px-2 py-2.5">
                  <BoardLink to={clubPath(club.name) + (season.active ? "" : `?season=${season.id}`)} className="flex min-w-0 items-center gap-3">
                    <ClubCrest name={club.name} size="md" />
                    <span className="min-w-0">
                      <span className="block truncate font-semibold group-hover:text-accent-text">{club.name}</span>
                      <span className="block truncate text-xs text-muted">
                        {rated
                          ? [rated.club.league, distinctGameName(club.name, rated.club.gameName) && t("inGame", { name: rated.club.gameName })]
                              .filter(Boolean)
                              .join(" · ")
                          : <Stars value={clubStars(club.elo)} />}
                      </span>
                    </span>
                  </BoardLink>
                </td>
                <td className="px-3 py-2.5 text-right">
                  <span className="tabular font-display text-xl font-bold">{club.elo}</span>
                  {club.modelElo != null && club.adjust !== 0 && (
                    <span
                      className="tabular ml-1 text-[11px] font-semibold text-draw"
                      title={t("adjusted", { model: club.modelElo, adjust: `${club.adjust > 0 ? "+" : ""}${club.adjust}` })}
                    >
                      {club.adjust > 0 ? "+" : ""}
                      {club.adjust}
                    </span>
                  )}
                  <span className="mt-1 ml-auto block h-1 w-full max-w-28 overflow-hidden rounded-full bg-surface-3">
                    <span className="block h-full rounded-full bg-accent" style={{ width: `${((club.elo - bottom) / (top - bottom)) * 100}%` }} />
                  </span>
                </td>
                <td className="hidden px-3 py-2.5 lg:table-cell">
                  {record.played ? (
                    <span className="flex items-center gap-2">
                      <FormPills outcomes={record.outcomes.slice(0, 5)} />
                      <span className="text-xs whitespace-nowrap text-faint">{t("games", { n: record.played })}</span>
                    </span>
                  ) : (
                    <span className="text-faint">—</span>
                  )}
                </td>
                {model && (
                  <>
                    <td className="tabular hidden px-3 py-2.5 text-right font-semibold md:table-cell">{rated?.xiScore?.toFixed(1) ?? "—"}</td>
                    <td className="tabular hidden px-3 py-2.5 text-right text-muted xl:table-cell">{rated?.benchScore?.toFixed(1) ?? "—"}</td>
                    <td className="tabular hidden px-3 py-2.5 text-right md:table-cell">{rated?.ovr?.toFixed(1) ?? "—"}</td>
                  </>
                )}
                {reference && (
                  <td className="hidden px-3 py-2.5 text-right sm:table-cell">
                    {before ? (
                      <span className="tabular text-xs">
                        <span className="text-muted">{before.elo}</span>{" "}
                        <span className={cn("font-semibold", club.elo > before.elo ? "text-win" : club.elo < before.elo ? "text-loss" : "text-faint")}>
                          {club.elo > before.elo ? "▲" : club.elo < before.elo ? "▼" : "="}
                          {club.elo !== before.elo && Math.abs(club.elo - before.elo)}
                        </span>
                      </span>
                    ) : (
                      <Pill tone="accent">{t("newClub")}</Pill>
                    )}
                  </td>
                )}
                {model && (
                  <td className="hidden px-3 py-2.5 xl:table-cell">
                    <span className="flex flex-wrap gap-1">
                      {Object.entries(rated?.missingBy ?? {}).map(([slot, n]) => (
                        <Pill key={slot} tone="loss">
                          {t("missing", { n: n!, slot: ts(slot as SlotKey) })}
                        </Pill>
                      ))}
                      {!!rated?.altUsed.length && (
                        <span title={rated.altUsed.map((a) => `${a.p.fullName}: ${a.p.pos} → ${ts(a.slot)}`).join(", ")}>
                          <Pill>{t("altUsed", { n: rated.altUsed.length })}</Pill>
                        </span>
                      )}
                    </span>
                  </td>
                )}
              </motion.tr>
            ))}
          </tbody>
        </table>
        {!shown.length && <EmptyState title={rows.length ? t("noLeague") : t("noClubs")} />}
      </div>
    </div>
  );
}

export default function Clubs() {
  return <DataGate>{(data) => <ClubsInner data={data} />}</DataGate>;
}
