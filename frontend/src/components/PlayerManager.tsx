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
  selectedForRandom: number[];
  toggleSelectForRandom: (id: number) => void;
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
  selectedForRandom,
  toggleSelectForRandom,
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
        {players.map((player) => {
          const isSelected = selectedForRandom.includes(player.id);
          return (
            <div key={player.id} className="player-card selectable">
              <div className="player-card-header">
                <span>{player.name}</span>
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleSelectForRandom(player.id)}
                />
              </div>
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
          );
        })}
      </div>
    </div>
  );
};

export default PlayerManager;
