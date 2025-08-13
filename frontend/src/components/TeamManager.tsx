import React, { useMemo } from "react";
import "./../styles/TeamManager.css";

interface TeamManagerProps {
  teamMode: string;
  setTeamMode: (val: string) => void;
  eloMatchmakingEnabled: boolean;
  setEloMatchmakingEnabled: (v: boolean) => void;
  generateRandomTeams: () => void;
  teamA: string[];
  teamB: string[];
  manualTeamA: number[];
  manualTeamB: number[];
  players: { id: number; name: string }[];
  eloRatings: Record<number, number>;
}

const TeamManager: React.FC<TeamManagerProps> = ({
  teamMode,
  setTeamMode,
  eloMatchmakingEnabled,
  setEloMatchmakingEnabled,
  generateRandomTeams,
  teamA,
  teamB,
  manualTeamA,
  manualTeamB,
  players,
  eloRatings,
}) => {
  const getNamesFromIds = (ids: number[]) =>
    ids
      .map((id) => players.find((p) => p.id === id)?.name)
      .filter(Boolean) as string[];

  const currentTeamA = teamA.length > 0 ? teamA : getNamesFromIds(manualTeamA);
  const currentTeamB = teamB.length > 0 ? teamB : getNamesFromIds(manualTeamB);

  const avg = (arr: number[]) =>
    arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;

  const getAvgElo = (names: string[]) => {
    const vals = names.map((n) => {
      const p = players.find((x) => x.name.toLowerCase() === n.toLowerCase());
      return p ? eloRatings[p.id] ?? 1000 : 1000;
    });
    return avg(vals);
  };

  const teamAEloAvg = getAvgElo(currentTeamA);
  const teamBEloAvg = getAvgElo(currentTeamB);

  const expectedA = useMemo(() => {
    if (!currentTeamA.length || !currentTeamB.length) return null;
    const Ea = 1 / (1 + Math.pow(10, (teamBEloAvg - teamAEloAvg) / 400));
    return Math.round(Ea * 100);
  }, [currentTeamA, currentTeamB, teamAEloAvg, teamBEloAvg]);

  const expectedB = expectedA !== null ? 100 - expectedA : null;

  return (
    <div className="team-section">
      <h2>Form Teams</h2>
      <div className="team-controls" style={{ gap: 10, flexWrap: "wrap" }}>
        <select
          className="team-mode-dropdown"
          value={teamMode}
          onChange={(e) => setTeamMode(e.target.value)}
        >
          <option value="1v1">1 vs 1</option>
          <option value="2v2">2 vs 2</option>
          <option value="1v2">1 vs 2</option>
        </select>

        <label
          className="elo-toggle"
          style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          <input
            type="checkbox"
            checked={eloMatchmakingEnabled}
            onChange={(e) => setEloMatchmakingEnabled(e.target.checked)}
          />
          Balance by ELO
        </label>

        <button onClick={generateRandomTeams} className="player-button">
          🎲 Random Teams
        </button>
      </div>

      <div className="teams-display">
        <div className="team-card">
          <h3>Team A</h3>
          {currentTeamA.length > 0 && (
            <div className="team-meta">
              Avg ELO: {teamAEloAvg}
              {expectedA !== null && (
                <span style={{ marginLeft: 8 }}>
                  • Win Chance: {expectedA}%
                </span>
              )}
            </div>
          )}
          <ul>
            {currentTeamA.map((name, idx) => (
              <li key={idx}>{name}</li>
            ))}
          </ul>
        </div>
        <div className="team-card">
          <h3>Team B</h3>
          {currentTeamB.length > 0 && (
            <div className="team-meta">
              Avg ELO: {teamBEloAvg}
              {expectedB !== null && (
                <span style={{ marginLeft: 8 }}>
                  • Win Chance: {expectedB}%
                </span>
              )}
            </div>
          )}
          <ul>
            {currentTeamB.map((name, idx) => (
              <li key={idx}>{name}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default TeamManager;
