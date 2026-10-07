import { motion } from "motion/react";
import { AddPlayer } from "../components/AddPlayer";
import { DataGate } from "../components/DataGate";
import { PageHeader } from "../components/layout/AppShell";
import { PlayerCard } from "../components/PlayerCard";
import { Segmented } from "../components/ui/primitives";
import { useSessionState } from "../hooks/useSessionState";
import { winRate } from "../lib/stats";
import { BoardLink } from "../components/board/BoardLink";
import { useT } from "../hooks/useI18n";
import { defineMessages } from "../lib/i18n";

type Order = "elo" | "win" | "played" | "name";

const msg = defineMessages({
  en: {
    eyebrow: "Squad",
    title: "Players",
    description:
      "Overall rating tracks Elo. Attributes come from real results: win rate, attack, defence, form, consistency and experience.",
    rating: "Rating",
    win: "Win %",
    games: "Games",
    name: "A–Z",
  },
  tr: {
    eyebrow: "Kadro",
    title: "Oyuncular",
    description:
      "Genel reyting Elo'yu izler. Özellikler gerçek sonuçlardan gelir: galibiyet, hücum, savunma, form, istikrar ve tecrübe.",
    rating: "Reyting",
    win: "Gal. %",
    games: "Maç",
    name: "A–Z",
  },
});

export default function Players() {
  const t = useT(msg);
  const [order, setOrder] = useSessionState<Order>("pl-order", "elo");
  return (
    <DataGate>
      {(data) => {
        const list = [...data.ranking].sort((a, b) => {
          if (order === "name") return a.name.localeCompare(b.name);
          if (order === "win") return winRate(b.stats ?? { played: 0, wins: 0 }) - winRate(a.stats ?? { played: 0, wins: 0 });
          if (order === "played") return (b.stats?.played ?? 0) - (a.stats?.played ?? 0);
          return a.rank - b.rank;
        });
        return (
          <div>
            <PageHeader
              eyebrow={t("eyebrow")}
              title={t("title")}
              description={t("description")}
              actions={
                <>
                  <Segmented<Order>
                    value={order}
                    onChange={setOrder}
                    size="sm"
                    options={[
                      { value: "elo", label: t("rating") },
                      { value: "win", label: t("win") },
                      { value: "played", label: t("games") },
                      { value: "name", label: t("name") },
                    ]}
                  />
                  <AddPlayer players={data.players} />
                </>
              }
            />
            <div className="grid grid-cols-2 justify-items-center gap-x-3 gap-y-6 sm:grid-cols-[repeat(auto-fill,minmax(216px,1fr))] sm:gap-x-4 sm:gap-y-8">
              {list.map((p, i) => (
                <motion.div
                  key={p.id}
                  layout
                  initial={{ opacity: 0, y: 24, rotateX: 25 }}
                  animate={{ opacity: 1, y: 0, rotateX: 0 }}
                  transition={{ delay: i * 0.05, type: "spring", bounce: 0.25, duration: 0.7 }}
                >
                  <BoardLink to={`/players/${encodeURIComponent(p.name)}`} className="block">
                    <PlayerCard player={p} size="md" className="hidden sm:block" />
                    <PlayerCard player={p} size="sm" className="sm:hidden" interactive={false} />
                  </BoardLink>
                </motion.div>
              ))}
            </div>
          </div>
        );
      }}
    </DataGate>
  );
}
