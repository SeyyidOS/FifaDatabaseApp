import React from "react";
import "./../styles/PlayerManager.css";

interface PlayerManagerProps {
  players: { id: number; name: string }[];
  username: string;
  setUsername: (val: string) => void;
  handleSubmit: (e: React.FormEvent) => void;
  manualTeamA: number[];
  manualTeamB: number[];
  toggleManualTeam: (id: number, team: "A" | "B") => void;
  message: string;
}

const PlayerManager: React.FC<PlayerManagerProps> = ({
  players,
  username,
  setUsername,
  handleSubmit,
  manualTeamA,
  manualTeamB,
  toggleManualTeam,
  message,
}) => {
  return (
    <div>
      <form onSubmit={handleSubmit} className="player-form">
        <input
          type="text"
          value={username}
          placeholder="Enter player name"
          onChange={(e) => setUsername(e.target.value)}
          className="player-input"
        />
        <button type="submit" className="player-button">
          Add Player
        </button>
      </form>
      {message && <p className="success-message">{message}</p>}

      <h2>Players</h2>
      <div className="player-cards">
        {players.map((player) => (
          <div key={player.id} className="player-card selectable">
            <span>{player.name}</span>
            <div className="team-select-buttons">
              <button
                type="button"
                className={`team-btn ${
                  manualTeamA.includes(player.id) ? "active" : ""
                }`}
                onClick={() => toggleManualTeam(player.id, "A")}
              >
                A
              </button>
              <button
                type="button"
                className={`team-btn ${
                  manualTeamB.includes(player.id) ? "active" : ""
                }`}
                onClick={() => toggleManualTeam(player.id, "B")}
              >
                B
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PlayerManager;
