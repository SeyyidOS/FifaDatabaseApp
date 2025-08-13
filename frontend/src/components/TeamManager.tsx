import React from "react";
import "./../styles/TeamManager.css";

interface TeamManagerProps {
  teamMode: string;
  setTeamMode: (val: string) => void;
  generateRandomTeams: () => void;
  teamA: string[];
  teamB: string[];
  manualTeamA: number[];
  manualTeamB: number[];
  players: { id: number; name: string }[];
}

const TeamManager: React.FC<TeamManagerProps> = ({
  teamMode,
  setTeamMode,
  generateRandomTeams,
  teamA,
  teamB,
  manualTeamA,
  manualTeamB,
  players,
}) => {
  const manualTeamANames = manualTeamA
    .map((id) => players.find((p) => p.id === id)?.name)
    .filter(Boolean) as string[];
  const manualTeamBNames = manualTeamB
    .map((id) => players.find((p) => p.id === id)?.name)
    .filter(Boolean) as string[];

  return (
    <div className="team-section">
      <h2>Form Teams</h2>
      <div className="team-controls">
        <select
          className="team-mode-dropdown"
          value={teamMode}
          onChange={(e) => setTeamMode(e.target.value)}
        >
          <option value="1v1">1 vs 1</option>
          <option value="2v2">2 vs 2</option>
          <option value="1v2">1 vs 2</option>
        </select>
        <button onClick={generateRandomTeams} className="player-button">
          🎲 Random Teams
        </button>
      </div>

      <div className="teams-display">
        <div className="team-card">
          <h3>Team A</h3>
          <ul>
            {(teamA.length > 0 ? teamA : manualTeamANames).map((name, idx) => (
              <li key={idx}>{name}</li>
            ))}
          </ul>
        </div>
        <div className="team-card">
          <h3>Team B</h3>
          <ul>
            {(teamB.length > 0 ? teamB : manualTeamBNames).map((name, idx) => (
              <li key={idx}>{name}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default TeamManager;
