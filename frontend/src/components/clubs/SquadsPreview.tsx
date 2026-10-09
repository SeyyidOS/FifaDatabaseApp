import { useMemo } from "react";
import { X } from "lucide-react";
import { useCards } from "../../hooks/useData";
import { useT } from "../../hooks/useI18n";
import { referenceSeason, runModel } from "../../lib/clubs";
import type { Season } from "../../lib/types";
import { Modal } from "../ui/Dialog";
import { ClubCrest } from "../ui/Identity";
import { Skeleton } from "../ui/primitives";
import { clubMessages } from "./messages";
import { Bench, Pitch } from "./Pitch";

/** The two picked clubs' elevens side by side (Match Center). */
export function SquadsPreview({
  open,
  onClose,
  season,
  seasons,
  clubs,
}: {
  open: boolean;
  onClose: () => void;
  season: Season;
  seasons: Season[];
  clubs: [string, string];
}) {
  const t = useT(clubMessages);
  const cards = useCards(open ? season.game : null);
  const rated = useMemo(() => {
    if (!cards.data) return null;
    const result = runModel(cards.data, season.model, referenceSeason(seasons, season));
    return clubs.map((name) => result.rows.find((r) => r.club.name.toLowerCase() === name.toLowerCase()) ?? null);
  }, [cards.data, season, seasons, clubs]);

  return (
    <Modal open={open} onClose={onClose} labelledBy="squads-title" wide>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 id="squads-title" className="font-semibold">
          {t("squad")}
        </h3>
        <button onClick={onClose} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg" aria-label={t("clear")}>
          <X className="size-4" />
        </button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {clubs.map((name, i) => {
          const r = rated?.[i];
          const club = season.clubs.find((c) => c.name.toLowerCase() === name.toLowerCase());
          return (
            <div key={name} className="min-w-0 space-y-2">
              <div className="flex items-center gap-2.5">
                <ClubCrest name={name} size="md" />
                <span className="min-w-0 flex-1 truncate font-semibold">{name}</span>
                {club && <span className="tabular font-display text-xl font-bold text-accent-text">{club.elo}</span>}
              </div>
              {!rated ? (
                <Skeleton className="aspect-[4/5] rounded-2xl" />
              ) : r ? (
                <>
                  <Pitch game={season.game!} evaluation={r} compact className="aspect-[4/5]" />
                  <Bench game={season.game!} bench={r.bench} compact />
                </>
              ) : (
                <p className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-muted">—</p>
              )}
            </div>
          );
        })}
      </div>
    </Modal>
  );
}
