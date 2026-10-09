import { motion } from "motion/react";
import { Crown, Flag, HeartPulse, MoonStar, Rocket, Shield, Swords, Wine, type LucideIcon } from "lucide-react";
import type { Award, AwardKey } from "../../lib/analysis";
import { displayName } from "../../lib/format";
import { BoardLink } from "../board/BoardLink";
import { Avatar } from "../ui/Identity";
import { useT } from "../../hooks/useI18n";
import { awardCaption, awardDetail, awardTitle, awardValue, insightMessages } from "./messages";

const ICONS: Record<AwardKey, LucideIcon> = {
  giantKiller: Swords,
  flatTrackBully: Crown,
  overachiever: Rocket,
  bottler: Wine,
  clubMerchant: Shield,
  tiltProof: HeartPulse,
  nightOwl: MoonStar,
  closer: Flag,
};

export function AwardCard({ award, index }: { award: Award; index: number }) {
  const t = useT(insightMessages);
  const Icon = ICONS[award.key] ?? Crown;
  const roast = award.key === "bottler";
  return (
    <motion.div
      initial={{ opacity: 0, y: 14, rotateX: 12 }}
      animate={{ opacity: 1, y: 0, rotateX: 0 }}
      transition={{ delay: 0.04 * index, type: "spring", bounce: 0.25, duration: 0.6 }}
      className="card card-hover relative flex flex-col overflow-hidden p-5"
    >
      <div
        className="pointer-events-none absolute -top-12 -right-12 size-36 rounded-full blur-3xl"
        style={{ background: roast ? "var(--loss)" : "var(--accent)", opacity: 0.12 }}
      />
      <div className="flex items-center gap-2.5">
        <span
          className={
            roast
              ? "grid size-9 place-items-center rounded-xl bg-loss/12 text-loss ring-1 ring-loss/25"
              : "grid size-9 place-items-center rounded-xl bg-accent/12 text-accent-text ring-1 ring-accent/25"
          }
        >
          <Icon className="size-[18px]" />
        </span>
        <div className="min-w-0">
          <p className="truncate font-semibold">{awardTitle(t, award)}</p>
          <p className="line-clamp-2 text-[11px] text-muted">{awardCaption(t, award)}</p>
        </div>
      </div>
      <BoardLink to={`/players/${encodeURIComponent(award.winner)}`} className="mt-5 flex items-center gap-3 hover:opacity-90">
        <Avatar name={award.winner} size="lg" ring={roast ? undefined : "accent"} />
        <div className="min-w-0">
          <p className="display truncate text-2xl">{displayName(award.winner)}</p>
          <p className={roast ? "display text-xl text-loss" : "display text-xl text-accent-text"}>{awardValue(t, award)}</p>
        </div>
      </BoardLink>
      <p className="mt-3 flex-1 text-xs text-muted">{awardDetail(t, award)}</p>
      {award.runnerUp && (
        <p className="mt-3 border-t border-line pt-3 text-[11px] text-faint">
          {t("runnerUp")} <span className="font-semibold text-muted">{displayName(award.runnerUp.name)}</span>{" "}
          {awardValue(t, award, award.runnerUp.value)}
        </p>
      )}
    </motion.div>
  );
}
