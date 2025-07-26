import React, { useEffect, useState } from "react";
import LeaderboardTable from "../components/LeaderBoardTable";
import {
  fetchPlayerLeaderboard,
  fetchTeamLeaderboard,
  fetchDuoLeaderboard,
} from "../services/leaderboardAPI";
import "../styles/Leaderboard.css";

interface PlayerStats {
  name: string;
  wins: number;
  draws: number;
  losses: number;
  total_matches: number;
  win_percentage: number;
  goals_forwarded: number;
  goals_accepted: number;
  points: number;
}

interface TeamStats {
  team: string;
  wins: number;
  draws: number;
  losses: number;
  total_matches: number;
  win_percentage: number;
  goals_forwarded: number;
  goals_accepted: number;
  points: number;
}

interface DuoStats {
  team_name: string;
  wins: number;
  draws: number;
  losses: number;
  total_matches: number;
  win_percentage: number;
  goals_forwarded: number;
  goals_accepted: number;
  points: number;
}

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
            "Draws",
            "Losses",
            "Goals For",
            "Goals Against",
            "Win %",
            "Points",
          ]}
          data={playerStats.map((p) => [
            p.name,
            p.total_matches,
            p.wins,
            p.draws,
            p.losses,
            p.goals_forwarded,
            p.goals_accepted,
            `${p.win_percentage}%`,
            p.points,
          ])}
        />
      ) : activeTab === "teams" ? (
        <LeaderboardTable
          columns={[
            "Club",
            "Matches",
            "Wins",
            "Draws",
            "Losses",
            "Goals For",
            "Goals Against",
            "Win %",
            "Points",
          ]}
          data={teamStats.map((t) => [
            t.team,
            t.total_matches,
            t.wins,
            t.draws,
            t.losses,
            t.goals_forwarded,
            t.goals_accepted,
            `${t.win_percentage}%`,
            t.points,
          ])}
        />
      ) : (
        <LeaderboardTable
          columns={[
            "Duo Team",
            "Matches",
            "Wins",
            "Draws",
            "Losses",
            "Goals For",
            "Goals Against",
            "Win %",
            "Points",
          ]}
          data={duoStats.map((d) => [
            d.team_name,
            d.total_matches,
            d.wins,
            d.draws,
            d.losses,
            d.goals_forwarded,
            d.goals_accepted,
            `${d.win_percentage}%`,
            d.points,
          ])}
        />
      )}
    </div>
  );
};

export default Leaderboard;
