import React from "react";
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

const MatchHistory: React.FC<{ matches: Match[] }> = ({ matches }) => {
  return (
    <div className="match-history">
      <h2>Match History</h2>
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
          {matches.map((match) => (
            <tr key={match.id}>
              <td>{new Date(match.time).toLocaleString()}</td>
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
