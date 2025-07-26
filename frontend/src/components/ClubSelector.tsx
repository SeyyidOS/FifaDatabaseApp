import React from "react";
import "./../styles/ClubSelector.css";

interface Club {
  id: number;
  name: string;
  tier: number;
}

interface ClubSelectorProps {
  clubs: Club[];
  clubA: number | "";
  clubB: number | "";
  setClubA: (val: number | "") => void;
  setClubB: (val: number | "") => void;
  scoreA: number | "";
  scoreB: number | "";
  setScoreA: (val: number | "") => void;
  setScoreB: (val: number | "") => void;
  submitResult: () => void;
  generateRandomClubs: () => void; // NEW PROP
}

const ClubSelector: React.FC<ClubSelectorProps> = ({
  clubs,
  clubA,
  clubB,
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
        <select
          className="club-dropdown"
          value={clubA}
          onChange={(e) => setClubA(Number(e.target.value))}
        >
          <option value="">Select Club A</option>
          {clubs.map((club) => (
            <option key={club.id} value={club.id}>
              {club.name} (Tier {club.tier})
            </option>
          ))}
        </select>
        <select
          className="club-dropdown"
          value={clubB}
          onChange={(e) => setClubB(Number(e.target.value))}
        >
          <option value="">Select Club B</option>
          {clubs.map((club) => (
            <option key={club.id} value={club.id}>
              {club.name} (Tier {club.tier})
            </option>
          ))}
        </select>
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
