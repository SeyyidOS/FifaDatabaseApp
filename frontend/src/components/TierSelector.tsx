// src/components/TierSelector.tsx

import React from "react";
import "../styles/TierSelector.css";

interface Club {
  id: number;
  name: string;
  tier: number;
}

interface TierSelectorProps {
  clubs: Club[];
  selectedTiers: number[];
  setSelectedTiers: React.Dispatch<React.SetStateAction<number[]>>;
}

const TierSelector: React.FC<TierSelectorProps> = ({
  clubs,
  selectedTiers,
  setSelectedTiers,
}) => {
  const allTiers = [...new Set(clubs.map((club) => club.tier))].sort(
    (a, b) => a - b
  );

  const toggleTier = (tier: number) => {
    setSelectedTiers((prev) =>
      prev.includes(tier) ? prev.filter((t) => t !== tier) : [...prev, tier]
    );
  };

  return (
    <div className="tier-selector">
      <h2>Select Tier</h2>
      {/* <label className="tier-label">Select Tiers:</label> */}
      <div className="tier-options">
        {allTiers.map((tier) => {
          const isSelected = selectedTiers.includes(tier);
          return (
            <button
              key={tier}
              className={`tier-pill ${isSelected ? "selected" : ""}`}
              onClick={() => toggleTier(tier)}
            >
              Tier {tier}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default TierSelector;
