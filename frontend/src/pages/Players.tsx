import { motion } from "motion/react";
import { Link } from "react-router-dom";
import { AddPlayer } from "../components/AddPlayer";
import { DataGate } from "../components/DataGate";
import { PageHeader } from "../components/layout/AppShell";
import { PlayerCard } from "../components/PlayerCard";
import { Segmented } from "../components/ui/primitives";
import { useSessionState } from "../hooks/useSessionState";
import { winRate } from "../lib/stats";

type Order = "elo" | "win" | "played" | "name";

export default function Players() {
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
              eyebrow="Squad"
              title="Players"
              description="Overall rating tracks Elo. Attributes come from real results: win rate, attack, defence, form, consistency and experience."
              actions={
                <>
                  <Segmented<Order>
                    value={order}
                    onChange={setOrder}
                    size="sm"
                    options={[
                      { value: "elo", label: "Rating" },
                      { value: "win", label: "Win %" },
                      { value: "played", label: "Games" },
                      { value: "name", label: "A–Z" },
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
                  <Link to={`/players/${encodeURIComponent(p.name)}`} className="block">
                    <PlayerCard player={p} size="md" className="hidden sm:block" />
                    <PlayerCard player={p} size="sm" className="sm:hidden" interactive={false} />
                  </Link>
                </motion.div>
              ))}
            </div>
          </div>
        );
      }}
    </DataGate>
  );
}
