import { Flame, Zap } from "lucide-react";
import { cn } from "../../lib/cn";
import type { MatchElo } from "../../lib/elo";
import { displayName, formatTime } from "../../lib/format";
import { isUpset } from "../../lib/insights";
import { outcomeFor, type ParsedMatch } from "../../lib/stats";
import type { Side } from "../../lib/types";
import { Avatar, ClubCrest } from "../ui/Identity";
import { Delta, OutcomeBadge, Pill } from "../ui/primitives";
import { BoardLink } from "../board/BoardLink";
import { MatchPhotosButton } from "./MatchPhotos";
import { useT } from "../../hooks/useI18n";
import { defineMessages } from "../../lib/i18n";

const m = defineMessages({
  en: { upset: "Upset" },
  tr: { upset: "Sürpriz" },
});

function SideBlock({
  side,
  match,
  elo,
  align,
}: {
  side: Side;
  match: ParsedMatch;
  elo?: MatchElo;
  align: "left" | "right";
}) {
  const club = side === "A" ? match.clubA : match.clubB;
  const team = side === "A" ? match.teamA : match.teamB;
  const won = match.result === side;
  const lost = match.result !== "D" && !won;
  const delta = elo ? (side === "A" ? elo.teamA[0]?.delta : elo.teamB[0]?.delta) : undefined;
  return (
    <div className={cn("flex min-w-0 items-center gap-3", align === "right" && "flex-row-reverse text-right")}>
      <ClubCrest name={club} size="md" className={cn(lost && "opacity-60 grayscale-[40%]")} />
      <div className="min-w-0">
        <p className={cn("truncate text-sm font-semibold", lost && "text-muted")}>{club}</p>
        <div className={cn("mt-1 flex flex-wrap items-center gap-x-2 gap-y-1", align === "right" && "justify-end")}>
          {team.map((n) => (
            <BoardLink
              key={n}
              to={`/players/${encodeURIComponent(n)}`}
              className="inline-flex items-center gap-1 text-xs text-muted hover:text-fg"
              onClick={(e) => e.stopPropagation()}
            >
              <Avatar name={n} size="xs" />
              {displayName(n)}
            </BoardLink>
          ))}
          {delta !== undefined && <Delta value={delta} />}
        </div>
      </div>
    </div>
  );
}

export function MatchCard({
  match,
  elo,
  perspective,
  showTime = true,
  canAddPhotos,
  className,
}: {
  match: ParsedMatch;
  elo?: MatchElo;
  /** Player whose result (W/D/L) should be highlighted. */
  perspective?: string;
  showTime?: boolean;
  /** offer adding photos to a match that has none (its photos show either way) */
  canAddPhotos?: boolean;
  className?: string;
}) {
  const t = useT(m);
  const outcome = perspective ? outcomeFor(match, perspective) : null;
  const upset = isUpset(match, elo);
  const total = match.scoreA + match.scoreB;
  const scoreCls = (s: Side) =>
    cn(
      "display tabular text-3xl sm:text-4xl",
      match.result === "D" ? "text-fg" : match.result === s ? "text-fg" : "text-faint",
    );
  return (
    <div
      className={cn(
        "card card-hover grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 py-3.5 sm:gap-6 sm:px-5",
        className,
      )}
    >
      <SideBlock side="A" match={match} elo={elo} align="left" />
      <div className="flex flex-col items-center gap-1">
        <div className="flex items-center gap-2 sm:gap-3">
          <span className={scoreCls("A")}>{match.scoreA}</span>
          <span className="text-lg text-faint">:</span>
          <span className={scoreCls("B")}>{match.scoreB}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {outcome && <OutcomeBadge outcome={outcome} />}
          {showTime && !outcome && <span className="tabular text-[11px] text-faint">{formatTime(match.date)}</span>}
          {upset && (
            <Pill tone="draw" className="px-1.5">
              <Zap className="size-3" /> {t("upset")}
            </Pill>
          )}
          {!upset && total >= 12 && (
            <Pill tone="loss" className="px-1.5">
              <Flame className="size-3" /> {total}
            </Pill>
          )}
        </div>
        <MatchPhotosButton match={match} canAdd={canAddPhotos} />
      </div>
      <SideBlock side="B" match={match} elo={elo} align="right" />
    </div>
  );
}
