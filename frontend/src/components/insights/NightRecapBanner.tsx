import { ArrowRight, Newspaper } from "lucide-react";
import { motion } from "motion/react";
import type { Analytics } from "../../hooks/analytics-context";
import { useT } from "../../hooks/useI18n";
import { defineMessages } from "../../lib/i18n";
import { NIGHT_RECAP, nightRecapOn } from "../../lib/nightRecap";
import { BoardLink } from "../board/BoardLink";

const m = defineMessages({
  en: {
    kicker: "The Night Post is out",
    title: "{n} matches, {goals} goals, and the awards are in",
    sub: "King of the night, giant slayer, cursed favourite and more",
    open: "Read it",
  },
  tr: {
    kicker: "Gece Postası çıktı",
    title: "{n} maç, {goals} gol ve ödüller dağıtıldı",
    sub: "Gecenin kralı, dev avcısı, lanetli favori ve dahası",
    open: "Oku",
  },
});

/** Temporary: points to the night report (pages/NightRecap.tsx) while it is on show. */
export function NightRecapBanner({ data }: { data: Analytics }) {
  const t = useT(m);
  const day = data.matchdays.find((d) => d.key === NIGHT_RECAP.night);
  if (!day || !nightRecapOn()) return null;
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <BoardLink
        to="/night"
        className="card card-hover group relative flex items-center gap-4 overflow-hidden p-4 sm:p-5"
      >
        <div className="pointer-events-none absolute -top-16 -left-10 size-44 rounded-full bg-accent opacity-15 blur-3xl" />
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-accent text-accent-ink shadow-[0_8px_24px_-10px_var(--accent)]">
          <Newspaper className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="label text-accent-text">{t("kicker")}</p>
          <p className="mt-0.5 font-semibold text-balance">{t("title", { n: day.matches.length, goals: day.goals })}</p>
          <p className="mt-0.5 text-xs text-muted max-sm:hidden">{t("sub")}</p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-accent-text">
          <span className="max-sm:hidden">{t("open")}</span>
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
        </span>
      </BoardLink>
    </motion.div>
  );
}
