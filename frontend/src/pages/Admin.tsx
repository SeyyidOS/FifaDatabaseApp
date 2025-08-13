import React, { useEffect, useState } from "react";
import {
  fetchPlayersAdmin,
  deletePlayerAdmin,
  fetchMatchesAdmin,
  deleteMatchAdmin,
} from "../services/adminAPI";
import { fetchEloSettings, updateEloSettings } from "../services/api";
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

const Admin: React.FC = () => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [kFactor, setKFactor] = useState<number>(24);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadPlayers();
    loadMatches();
    loadK();
  }, []);

  const loadPlayers = async () => setPlayers(await fetchPlayersAdmin());
  const loadMatches = async () => setMatches(await fetchMatchesAdmin());

  const loadK = async () => {
    try {
      const { kFactor } = await fetchEloSettings();
      setKFactor(kFactor ?? 24);
    } catch (e) {
      console.error(e);
    }
  };

  const onChangeK = async (val: number) => {
    try {
      setSaving(true);
      setKFactor(val);
      await updateEloSettings(val);
      // Clients will fetch /elo as needed; no local recompute here.
    } catch (e) {
      console.error(e);
      alert("Failed to update K.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePlayer = async (id: number) => {
    await deletePlayerAdmin(id);
    loadPlayers();
  };

  const handleDeleteMatch = async (id: number) => {
    await deleteMatchAdmin(id);
    loadMatches();
  };

  return (
    <div className="admin-container">
      <h1>Admin Panel</h1>

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
            onChange={(e) => onChangeK(Number(e.target.value))}
            disabled={saving}
          />
          <span style={{ minWidth: 28, textAlign: "right" }}>{kFactor}</span>
        </div>
        <p style={{ opacity: 0.7, marginTop: 8 }}>
          Changing K updates the server setting. Clients will reflect it the
          next time they fetch ELO.
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
