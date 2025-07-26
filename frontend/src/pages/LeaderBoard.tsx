import React, { useEffect, useState } from "react";
import LeaderboardTable from "../components/LeaderboardTable";
import {
  fetchPlayerLeaderboard,
  fetchTeamLeaderboard,
  fetchDuoLeaderboard,
} from "../services/leaderboardAPI";
import "../styles/Leaderboard.css";

interface PlayerStats {
  name: string;
  wins: number;
  losses: number;
  total_matches: number;
  win_percentage: number;
  goals_forwarded: number;
  goals_accepted: number;
}

interface TeamStats {
  team: string;
  wins: number;
  losses: number;
  total_matches: number;
  win_percentage: number;
  goals_forwarded: number;
  goals_accepted: number;
}

interface DuoStats {
  team_name: string;
  wins: number;
  losses: number;
  total_matches: number;
  win_percentage: number;
  goals_forwarded: number;
  goals_accepted: number;
}

// Utility function to sort by win_percentage, then goal difference (goals_forwarded - goals_accepted)
const sortLeaderboard = <
  T extends {
    win_percentage: number;
    goals_forwarded: number;
    goals_accepted: number;
  }
>(
  data: T[]
): T[] => {
  return [...data].sort((a, b) => {
    if (b.win_percentage !== a.win_percentage) {
      return b.win_percentage - a.win_percentage;
    }
    const diffA = a.goals_forwarded - a.goals_accepted;
    const diffB = b.goals_forwarded - b.goals_accepted;
    return diffB - diffA;
  });
};

const Leaderboard: React.FC = () => {
  const [playerStats, setPlayerStats] = useState<PlayerStats[]>([]);
  const [teamStats, setTeamStats] = useState<TeamStats[]>([]);
  const [duoStats, setDuoStats] = useState<DuoStats[]>([]);
  const [activeTab, setActiveTab] = useState<"players" | "teams" | "duos">(
    "players"
  );

  useEffect(() => {
    const loadData = async () => {
      try {
        setPlayerStats(await fetchPlayerLeaderboard());
        setTeamStats(await fetchTeamLeaderboard());
        setDuoStats(await fetchDuoLeaderboard());
      } catch (error) {
        console.error("Failed to load leaderboard:", error);
      }
    };
    loadData();
  }, []);

  return (
    <div className="leaderboard-container">
      <h1>🏆 Leaderboard</h1>
      <div className="leaderboard-tabs">
        <button
          className={activeTab === "players" ? "active" : ""}
          onClick={() => setActiveTab("players")}
        >
          Players
        </button>
        <button
          className={activeTab === "teams" ? "active" : ""}
          onClick={() => setActiveTab("teams")}
        >
          Clubs
        </button>
        <button
          className={activeTab === "duos" ? "active" : ""}
          onClick={() => setActiveTab("duos")}
        >
          Duos
        </button>
      </div>

      {activeTab === "players" ? (
        <LeaderboardTable
          columns={[
            "Player",
            "Matches",
            "Wins",
            "Losses",
            "Goals For",
            "Goals Against",
            "Win %",
          ]}
          data={sortLeaderboard(playerStats).map((p) => [
            p.name,
            p.total_matches,
            p.wins,
            p.losses,
            p.goals_forwarded,
            p.goals_accepted,
            `${p.win_percentage}%`,
          ])}
        />
      ) : activeTab === "teams" ? (
        <LeaderboardTable
          columns={[
            "Club",
            "Matches",
            "Wins",
            "Losses",
            "Goals For",
            "Goals Against",
            "Win %",
          ]}
          data={sortLeaderboard(teamStats).map((t) => [
            t.team,
            t.total_matches,
            t.wins,
            t.losses,
            t.goals_forwarded,
            t.goals_accepted,
            `${t.win_percentage}%`,
          ])}
        />
      ) : (
        <LeaderboardTable
          columns={[
            "Duo Team",
            "Matches",
            "Wins",
            "Losses",
            "Goals For",
            "Goals Against",
            "Win %",
          ]}
          data={sortLeaderboard(duoStats).map((d) => [
            d.team_name,
            d.total_matches,
            d.wins,
            d.losses,
            d.goals_forwarded,
            d.goals_accepted,
            `${d.win_percentage}%`,
          ])}
        />
      )}
    </div>
  );
};

export default Leaderboard;
