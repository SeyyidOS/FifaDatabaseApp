import React, { useEffect, useState } from "react";
import {
  fetchPlayersAdmin,
  deletePlayerAdmin,
  fetchMatchesAdmin,
  deleteMatchAdmin,
} from "../services/adminAPI";
import "../styles/Admin.css";

interface Player {
  id: number;
  name: string;
}

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

const INITIAL_ELO = 1000;

const Admin: React.FC = () => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [kFactor, setKFactor] = useState<number>(() => {
    const stored = localStorage.getItem("eloKFactor");
    const parsed = stored ? Number(stored) : 24;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 24;
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadPlayers();
    loadMatches();
  }, []);

  const loadPlayers = async () => {
    setPlayers(await fetchPlayersAdmin());
  };

  const loadMatches = async () => {
    setMatches(await fetchMatchesAdmin());
  };

  const handleDeletePlayer = async (id: number) => {
    await deletePlayerAdmin(id);
    loadPlayers();
  };

  const handleDeleteMatch = async (id: number) => {
    await deleteMatchAdmin(id);
    loadMatches();
  };

  const persistK = (k: number) => {
    setKFactor(k);
    localStorage.setItem("eloKFactor", String(k));
    // HomePage listens to storage events and will recompute ELO automatically.
  };

  const hardResetElo = () => {
    if (!players.length) return;
    const reset: Record<number, number> = {};
    for (const p of players) reset[p.id] = INITIAL_ELO;
    localStorage.setItem("eloRatings", JSON.stringify(reset));
    // HomePage listens to storage events and will update its state to match.
    alert("ELO has been hard reset to 1000 for all players.");
  };

  const exportElo = () => {
    try {
      const raw = localStorage.getItem("eloRatings") || "{}";
      const blob = new Blob([raw], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "eloRatings.json";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert("Export failed.");
    }
  };

  const importElo = async (file: File) => {
    setSaving(true);
    try {
      const text = await file.text();
      // Basic validation
      const parsed = JSON.parse(text || "{}");
      if (typeof parsed !== "object" || parsed === null) {
        throw new Error("Invalid ELO JSON.");
      }
      localStorage.setItem("eloRatings", JSON.stringify(parsed));
      alert("ELO ratings imported.");
    } catch (e: any) {
      alert(e?.message || "Import failed.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-container">
      <h1>Admin Panel</h1>

      {/* ELO Controls */}
      <section className="admin-section">
        <h2>ELO Settings</h2>
        <div
          className="elo-controls"
          style={{
            display: "flex",
            gap: 12,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <label htmlFor="kfactor">
            <strong>K Factor:</strong>
          </label>
          <input
            id="kfactor"
            type="range"
            min={8}
            max={64}
            step={1}
            value={kFactor}
            onChange={(e) => persistK(Number(e.target.value))}
          />
          <span style={{ minWidth: 28, textAlign: "right" }}>{kFactor}</span>

          <button className="player-button" onClick={hardResetElo}>
            Hard Reset ELO (1000)
          </button>

          <button className="player-button" onClick={exportElo}>
            Export ELO JSON
          </button>

          <label className="player-button" style={{ cursor: "pointer" }}>
            Import ELO JSON
            <input
              type="file"
              accept="application/json"
              style={{ display: "none" }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) importElo(f);
              }}
              disabled={saving}
            />
          </label>
        </div>
        <p style={{ opacity: 0.7, marginTop: 8 }}>
          Notes: Changing K immediately triggers an ELO recompute in the main
          app (from full history). Hard Reset sets all players to 1000 (ignores
          match history) until another K change or new match.
        </p>
      </section>

      <section className="admin-section">
        <h2>Players</h2>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Name</th>
              <th style={{ width: 120 }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {players.map((player) => (
              <tr key={player.id}>
                <td>{player.name}</td>
                <td>
                  <button onClick={() => handleDeletePlayer(player.id)}>
                    ❌ Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="admin-section">
        <h2>Matches</h2>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Club A</th>
              <th>Score</th>
              <th>Club B</th>
              <th style={{ width: 120 }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {matches.map((match) => (
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
                <td>{match.club_a}</td>
                <td>
                  {match.score_a} - {match.score_b}
                </td>
                <td>{match.club_b}</td>
                <td>
                  <button onClick={() => handleDeleteMatch(match.id)}>
                    ❌ Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
};

export default Admin;
