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

const Admin: React.FC = () => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);

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

  return (
    <div className="admin-container">
      <h1>Admin Panel</h1>

      <section className="admin-section">
        <h2>Players</h2>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Action</th>
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
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {matches.map((match) => (
              <tr key={match.id}>
                <td>{new Date(match.time).toLocaleString()}</td>
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
