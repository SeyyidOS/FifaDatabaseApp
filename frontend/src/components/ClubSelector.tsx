import React from "react";
import "./../styles/ClubSelector.css";

interface Club {
  id: number;
  name: string;
  tier: number;
  elo?: number; // ← new (defaults to 1000 if missing)
}

interface ClubSelectorProps {
  clubs: Club[];
  clubA: number | "custom" | "";
  clubB: number | "custom" | "";
  customClubA: string;
  customClubB: string;
  setCustomClubA: (val: string) => void;
  setCustomClubB: (val: string) => void;
  setClubA: (val: number | "custom" | "") => void;
  setClubB: (val: number | "custom" | "") => void;
  scoreA: number | "";
  scoreB: number | "";
  setScoreA: (val: number | "") => void;
  setScoreB: (val: number | "") => void;
  submitResult: () => void;
  generateRandomClubs: () => void;
}

const ClubSelector: React.FC<ClubSelectorProps> = ({
  clubs,
  clubA,
  clubB,
  customClubA,
  customClubB,
  setCustomClubA,
  setCustomClubB,
  setClubA,
  setClubB,
  scoreA,
  scoreB,
  setScoreA,
  setScoreB,
  submitResult,
  generateRandomClubs,
}) => {
  return (
    <div className="club-section">
      <h2>Select Clubs</h2>
      <div className="club-selection">
        <div>
          <select
            className="club-dropdown"
            value={clubA}
            onChange={(e) =>
              setClubA(
                e.target.value === "custom" ? "custom" : Number(e.target.value)
              )
            }
          >
            <option value="">Select Club A</option>
            {clubs.map((club) => (
              <option key={club.id} value={club.id}>
                {club.name} ({club.elo})
              </option>
            ))}
            <option value="custom">Other (Custom Club)</option>
          </select>
          {clubA === "custom" && (
            <input
              type="text"
              className="club-input"
              placeholder="Enter custom club name"
              value={customClubA}
              onChange={(e) => setCustomClubA(e.target.value)}
            />
          )}
        </div>

        <div>
          <select
            className="club-dropdown"
            value={clubB}
            onChange={(e) =>
              setClubB(
                e.target.value === "custom" ? "custom" : Number(e.target.value)
              )
            }
          >
            <option value="">Select Club B</option>
            {clubs.map((club) => (
              <option key={club.id} value={club.id}>
                {club.name} ({club.elo})
              </option>
            ))}
            <option value="custom">Other (Custom Club)</option>
          </select>
          {clubB === "custom" && (
            <input
              type="text"
              className="club-input"
              placeholder="Enter custom club name"
              value={customClubB}
              onChange={(e) => setCustomClubB(e.target.value)}
            />
          )}
        </div>

        <button
          onClick={generateRandomClubs}
          className="player-button random-club-btn"
        >
          🎲 Random Clubs
        </button>
      </div>

      <h2>Result</h2>

      <div className="score-section">
        <div className="score-input-group">
          <label>Team A Score</label>
          <input
            type="number"
            className="score-input"
            value={scoreA}
            onChange={(e) => setScoreA(Number(e.target.value))}
          />
        </div>
        <div className="score-input-group">
          <label>Team B Score</label>
          <input
            type="number"
            className="score-input"
            value={scoreB}
            onChange={(e) => setScoreB(Number(e.target.value))}
          />
        </div>
      </div>
      <button onClick={submitResult} className="player-button submit-btn">
        ✅ Submit Result
      </button>
    </div>
  );
};

export default ClubSelector;
