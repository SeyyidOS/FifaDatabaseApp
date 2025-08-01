import React, { useState, useMemo } from "react";
import "./../styles/MatchHistory.css";

interface Match {
  id: number;
  time: string;
  club_a: string;
  club_b: string;
  team_a: string;
  team_b: string;
  score_a: number;
  score_b: number;
}

// ✨ Clean and normalize player names
const cleanPlayerName = (name: string) =>
  name
    .replace(/[{}()]/g, "") // remove brackets/braces
    .trim()
    .toLowerCase();

// Capitalize for display
const capitalize = (name: string) =>
  name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();

const MatchHistory: React.FC<{ matches: Match[] }> = ({ matches }) => {
  const [filter, setFilter] = useState<string>("all");
  const [selectedDateTime, setSelectedDateTime] = useState<string>("");

  // 🧠 Unique cleaned player names
  const uniquePlayers = useMemo(() => {
    const allPlayers = matches.flatMap((match) =>
      [...match.team_a.split(","), ...match.team_b.split(",")].map(
        cleanPlayerName
      )
    );
    return Array.from(new Set(allPlayers)).sort();
  }, [matches]);

  // 🧠 Filter matches based on selected player and datetime
  const filteredMatches = useMemo(() => {
    let result = [...matches];

    // 🎯 Filter by player
    if (filter !== "all" && uniquePlayers.includes(cleanPlayerName(filter))) {
      result = result.filter((match) => {
        const teamAPlayers = match.team_a.split(",").map(cleanPlayerName);
        const teamBPlayers = match.team_b.split(",").map(cleanPlayerName);
        return (
          teamAPlayers.includes(cleanPlayerName(filter)) ||
          teamBPlayers.includes(cleanPlayerName(filter))
        );
      });
    }

    // 🎯 Filter by datetime
    if (selectedDateTime) {
      const selected = new Date(selectedDateTime);
      result = result.filter((match) => new Date(match.time) > selected);
    }

    return result;
  }, [filter, selectedDateTime, matches, uniquePlayers]);

  return (
    <div className="match-history">
      <h2>Match History</h2>

      <div className="match-filter">
        <label>Filter by Player: </label>
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">Show All</option>
          <optgroup label="Players">
            {uniquePlayers.map((player) => (
              <option key={player} value={player}>
                {capitalize(player)}
              </option>
            ))}
          </optgroup>
        </select>

        <label style={{ marginLeft: "1rem" }}>From Date & Time: </label>
        <input
          type="datetime-local"
          value={selectedDateTime}
          onChange={(e) => setSelectedDateTime(e.target.value)}
        />
      </div>

      <table className="match-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Club A</th>
            <th>Score</th>
            <th>Club B</th>
          </tr>
        </thead>
        <tbody>
          {filteredMatches.map((match) => (
            <tr key={match.id}>
              <td>
                {(() => {
                  const date = new Date(match.time);
                  date.setHours(date.getHours() + 3);
                  return date.toLocaleString("tr-TR", {
                    year: "numeric",
                    month: "2-digit",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false,
                  });
                })()}
              </td>
              <td className="club-name">
                {match.club_a}
                <div className="player-subtext">{match.team_a}</div>
              </td>
              <td className="score-cell">
                {match.score_a} - {match.score_b}
              </td>
              <td className="club-name">
                {match.club_b}
                <div className="player-subtext">{match.team_b}</div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default MatchHistory;
