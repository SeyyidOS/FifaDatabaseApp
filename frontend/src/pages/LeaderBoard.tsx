import React, { useEffect, useState } from "react";
import LeaderboardTable from "../components/LeaderBoardTable";
import {
  fetchPlayerLeaderboard,
  fetchTeamLeaderboard,
  fetchDuoLeaderboard,
} from "../services/leaderboardAPI";
import "../styles/Leaderboard.css";

// Type definitions
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
  const [loading, setLoading] = useState<boolean>(false);

  const [startTime, setStartTime] = useState<string>(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split("T")[0]; // yyyy-mm-dd
  });

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [players, teams, duos] = await Promise.all([
          fetchPlayerLeaderboard(startTime),
          fetchTeamLeaderboard(startTime),
          fetchDuoLeaderboard(startTime),
        ]);
        setPlayerStats(players);
        setTeamStats(teams);
        setDuoStats(duos);
      } catch (err) {
        console.error("Failed to load leaderboard:", err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [startTime]);

  return (
    <div className="leaderboard-container">
      <h1>🏆 Leaderboard</h1>

      {/* Date filter */}
      <div className="leaderboard-filter">
        <label htmlFor="start-time">Start Date:</label>
        <input
          type="date"
          id="start-time"
          value={startTime}
          onChange={(e) => setStartTime(e.target.value)}
        />
      </div>

      {/* Tabs */}
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

      {/* Loading Spinner */}
      {loading ? (
        <div className="loading-spinner">Loading...</div>
      ) : activeTab === "players" ? (
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
