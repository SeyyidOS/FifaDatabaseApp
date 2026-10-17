import { Eye, Hourglass } from "lucide-react";
import { motion } from "motion/react";
import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useMemberships } from "../../hooks/useAccount";
import { useBoard } from "../../hooks/useBoard";
import { useT } from "../../hooks/useI18n";
import { displayName } from "../../lib/format";
import { defineMessages } from "../../lib/i18n";
import { Button } from "../ui/primitives";

const m = defineMessages({
  en: {
    waiting: "Waiting for approval",
    waitingTitle: "Almost in",
    waitingText:
      "You asked to join as {name}. Once an owner or admin confirms it, you can log matches here. Until then, every table, match and profile is open to you.",
    watching: "Viewer",
    watchingTitle: "Just watching for now",
    watchingText:
      "Your account isn't linked to a player in this league, so you can look around but not log matches. Ask the league's owner for a personal invite link.",
    look: "Look around",
  },
  tr: {
    waiting: "Onay bekleniyor",
    waitingTitle: "Neredeyse içeridesin",
    waitingText:
      "{name} olarak katılmak istedin. Bir sahip ya da yönetici onaylayınca burada maç girebilirsin. O zamana kadar bütün tablolar, maçlar ve profiller açık.",
    watching: "İzleyici",
    watchingTitle: "Şimdilik sadece izliyorsun",
    watchingText:
      "Hesabın bu ligde bir oyuncuya bağlı değil; etrafa bakabilirsin ama maç giremezsin. Lig sahibinden sana özel bir davet linki iste.",
    look: "Lige göz at",
  },
});

/**
 * The Match Center of someone who may only look (role "viewer"): why, and what comes next. It asks the
 * server now and then, so an approval opens the real one without a reload: the look-only token is then
 * refused, dropped, and the account opens the board again as a member (BoardGate).
 */
export function Watching() {
  const t = useT(m);
  const { slug, api, path } = useBoard();
  const asked = useMemberships().data?.find((mb) => mb.slug === slug)?.asked;
  useEffect(() => {
    const id = setInterval(() => void api.me().catch(() => {}), 30_000);
    return () => clearInterval(id);
  }, [api]);

  const Icon = asked ? Hourglass : Eye;
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="card mx-auto mt-6 flex max-w-md flex-col items-center p-7 text-center sm:mt-14 sm:p-9"
    >
      <span className="grid size-16 place-items-center rounded-3xl bg-surface-2 ring-1 ring-line">
        <Icon className="size-7 text-accent-text" />
      </span>
      <p className="label mt-5">{asked ? t("waiting") : t("watching")}</p>
      <h1 className="display mt-2 text-4xl">{asked ? t("waitingTitle") : t("watchingTitle")}</h1>
      <p className="mt-3 text-sm text-muted">
        {asked ? t("waitingText", { name: displayName(asked.name) }) : t("watchingText")}
      </p>
      <Link to={path()} className="mt-7 w-full">
        <Button variant="secondary" size="lg" className="w-full">
          {t("look")}
        </Button>
      </Link>
    </motion.div>
  );
}
