import React, { useState, useEffect } from "react";
import PlayerManager from "../components/PlayerManager";
import TeamManager from "../components/TeamManager";
import ClubSelector from "../components/ClubSelector";
import MatchHistory from "../components/MatchHistory";
import "../styles/App.css";

import {
  fetchPlayersAPI,
  fetchClubsAPI,
  fetchMatchesAPI,
  addPlayerAPI,
  addMatchAPI,
} from "../services/api";

interface Player {
  id: number;
  name: string;
}

interface Club {
  id: number;
  name: string;
  tier: number;
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

function HomePage() {
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState("");
  const [players, setPlayers] = useState<Player[]>([]);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [clubA, setClubA] = useState<number | "custom" | "">("");
  const [clubB, setClubB] = useState<number | "custom" | "">("");
  const [customClubA, setCustomClubA] = useState("");
  const [customClubB, setCustomClubB] = useState("");
  const [teamA, setTeamA] = useState<string[]>([]);
  const [teamB, setTeamB] = useState<string[]>([]);
  const [manualTeamA, setManualTeamA] = useState<number[]>([]);
  const [manualTeamB, setManualTeamB] = useState<number[]>([]);
  const [teamMode, setTeamMode] = useState("2v2");
  const [scoreA, setScoreA] = useState<number | "">("");
  const [scoreB, setScoreB] = useState<number | "">("");
  const [matches, setMatches] = useState<Match[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        await Promise.all([fetchPlayers(), fetchClubs(), fetchMatches()]);
      } catch (error) {
        console.error("Error loading data:", error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const fetchPlayers = async () => {
    try {
      setPlayers(await fetchPlayersAPI());
    } catch (error) {
      console.error("Failed to fetch players:", error);
    }
  };

  const fetchClubs = async () => {
    try {
      setClubs(await fetchClubsAPI());
    } catch (error) {
      console.error("Failed to fetch clubs:", error);
    }
  };

  const fetchMatches = async () => {
    try {
      setMatches(await fetchMatchesAPI());
    } catch (error) {
      console.error("Failed to fetch matches:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;
    try {
      const data = await addPlayerAPI(username);
      setMessage(data.message);
      setUsername("");
      fetchPlayers();
    } catch (error) {
      console.error("Failed to add player:", error);
    }
  };

  const generateRandomTeams = () => {
    const shuffled = [...players].sort(() => Math.random() - 0.5);
    let teamASize = 1;
    let teamBSize = 1;

    if (teamMode === "2v2") {
      teamASize = 2;
      teamBSize = 2;
    } else if (teamMode === "1v2") {
      teamASize = 1;
      teamBSize = 2;
    } else if (teamMode === "1v1") {
      teamASize = 1;
      teamBSize = 1;
    }

    if (shuffled.length < teamASize + teamBSize) {
      alert(
        `You need at least ${teamASize + teamBSize} players for ${teamMode}.`
      );
      return;
    }

    setTeamA(shuffled.slice(0, teamASize).map((p) => p.name));
    setTeamB(
      shuffled.slice(teamASize, teamASize + teamBSize).map((p) => p.name)
    );
    setManualTeamA([]);
    setManualTeamB([]);
  };

  const generateRandomClubs = () => {
    if (clubs.length < 2) {
      alert("You need at least 2 clubs to select randomly.");
      return;
    }

    const tierGroups: { [tier: number]: Club[] } = {};
    clubs.forEach((club) => {
      if (!tierGroups[club.tier]) {
        tierGroups[club.tier] = [];
      }
      tierGroups[club.tier].push(club);
    });

    const availableTiers = Object.keys(tierGroups).filter(
      (tier) => tierGroups[Number(tier)].length >= 2
    );
    if (availableTiers.length === 0) {
      alert("Not enough clubs with the same tier to form a match.");
      return;
    }

    const randomTier = Number(
      availableTiers[Math.floor(Math.random() * availableTiers.length)]
    );
    const selectedClubs = [...tierGroups[randomTier]].sort(
      () => Math.random() - 0.5
    );

    setClubA(selectedClubs[0].id);
    setClubB(selectedClubs[1].id);
  };

  const toggleManualTeam = (playerId: number, team: "A" | "B") => {
    if (team === "A") {
      setManualTeamA((prev) =>
        prev.includes(playerId)
          ? prev.filter((id) => id !== playerId)
          : [...prev, playerId]
      );
      setManualTeamB((prev) => prev.filter((id) => id !== playerId));
    } else {
      setManualTeamB((prev) =>
        prev.includes(playerId)
          ? prev.filter((id) => id !== playerId)
          : [...prev, playerId]
      );
      setManualTeamA((prev) => prev.filter((id) => id !== playerId));
    }
    setTeamA([]);
    setTeamB([]);
  };

  const submitResult = async () => {
    if (!clubA || !clubB) {
      alert("Please select both clubs.");
      return;
    }

    if (clubA === "custom" && !customClubA.trim()) {
      alert("Please enter a custom club name for Club A.");
      return;
    }
    if (clubB === "custom" && !customClubB.trim()) {
      alert("Please enter a custom club name for Club B.");
      return;
    }

    const teamANames =
      teamA.length > 0
        ? teamA
        : manualTeamA.map((id) => players.find((p) => p.id === id)?.name || "");
    const teamBNames =
      teamB.length > 0
        ? teamB
        : manualTeamB.map((id) => players.find((p) => p.id === id)?.name || "");

    try {
      await addMatchAPI({
        clubA:
          clubA === "custom"
            ? customClubA
            : clubs.find((c) => c.id === clubA)?.name || "Club A",
        clubB:
          clubB === "custom"
            ? customClubB
            : clubs.find((c) => c.id === clubB)?.name || "Club B",
        teamA: teamANames,
        teamB: teamBNames,
        scoreA: Number(scoreA) || 0,
        scoreB: Number(scoreB) || 0,
      });
      fetchMatches();
      setScoreA("");
      setScoreB("");
    } catch (error) {
      console.error("Failed to submit match:", error);
    }
  };

  return (
    <div className="app-container">
      {loading ? (
        <div className="loading-spinner">Loading...</div>
      ) : (
        <>
          <PlayerManager
            players={players}
            username={username}
            setUsername={setUsername}
            handleSubmit={handleSubmit}
            manualTeamA={manualTeamA}
            manualTeamB={manualTeamB}
            toggleManualTeam={toggleManualTeam}
            message={message}
          />

          <TeamManager
            teamMode={teamMode}
            setTeamMode={setTeamMode}
            generateRandomTeams={generateRandomTeams}
            teamA={teamA}
            teamB={teamB}
            manualTeamA={manualTeamA}
            manualTeamB={manualTeamB}
            players={players}
          />

          <ClubSelector
            clubs={clubs}
            clubA={clubA}
            clubB={clubB}
            customClubA={customClubA}
            customClubB={customClubB}
            setCustomClubA={setCustomClubA}
            setCustomClubB={setCustomClubB}
            setClubA={setClubA}
            setClubB={setClubB}
            scoreA={scoreA}
            scoreB={scoreB}
            setScoreA={setScoreA}
            setScoreB={setScoreB}
            submitResult={submitResult}
            generateRandomClubs={generateRandomClubs}
          />

          <MatchHistory matches={matches} />
        </>
      )}
    </div>
  );
}

export default HomePage;
