import React, { useState, useEffect } from "react";
import PlayerManager from "../components/PlayerManager";
import TeamManager from "../components/TeamManager";
import ClubSelector from "../components/ClubSelector";
import MatchHistory from "../components/MatchHistory";
import TierSelector from "../components/TierSelector";
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
  const [selectedTiers, setSelectedTiers] = useState<number[]>([]);

  // Players checked for random selection (default: all players)
  const [selectedForRandom, setSelectedForRandom] = useState<number[]>([]);

  // --- helpers for name normalization (match data is string-based) ---
  const cleanPlayerName = (name: string) =>
    name
      .replace(/[{}()]/g, "")
      .trim()
      .toLowerCase();

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
      const fetchedPlayers = await fetchPlayersAPI();
      setPlayers(fetchedPlayers);
      // default: tick everyone
      setSelectedForRandom(fetchedPlayers.map((p: Player) => p.id));
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
      // refresh players (keeps default: all selected incl. the new one)
      fetchPlayers();
    } catch (error) {
      console.error("Failed to add player:", error);
    }
  };

  // Checkbox toggle to include/exclude a player from randomization pool
  const toggleSelectForRandom = (playerId: number) => {
    setSelectedForRandom((prev) =>
      prev.includes(playerId)
        ? prev.filter((id) => id !== playerId)
        : [...prev, playerId]
    );
  };

  // Build a map: player(lowercased) -> Set of teammates(lowercased) from THEIR LAST match only
  const buildLastTeammatesMap = () => {
    // Sort matches by time descending
    const sorted = [...matches].sort(
      (a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()
    );

    // Track which players we've already recorded (we only want their own last match)
    const recorded = new Set<string>();
    const lastTeammates = new Map<string, Set<string>>();

    for (const m of sorted) {
      const teamAList = m.team_a
        .split(",")
        .map(cleanPlayerName)
        .filter(Boolean);
      const teamBList = m.team_b
        .split(",")
        .map(cleanPlayerName)
        .filter(Boolean);

      // For each player in team A, if not recorded yet, set their teammates to the rest of team A
      for (const p of teamAList) {
        if (!recorded.has(p)) {
          recorded.add(p);
          const mates = new Set(teamAList.filter((x) => x !== p));
          lastTeammates.set(p, mates);
        }
      }
      // For each player in team B, if not recorded yet, set their teammates to the rest of team B
      for (const p of teamBList) {
        if (!recorded.has(p)) {
          recorded.add(p);
          const mates = new Set(teamBList.filter((x) => x !== p));
          lastTeammates.set(p, mates);
        }
      }
    }

    return lastTeammates;
  };

  const generateRandomTeams = () => {
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

    const totalNeeded = teamASize + teamBSize;
    const pool = players.filter((p) => selectedForRandom.includes(p.id));

    if (pool.length < totalNeeded) {
      alert(`Select at least ${totalNeeded} players for ${teamMode}.`);
      return;
    }

    // Build constraint map: last-teammates
    const lastTeammates = buildLastTeammatesMap();

    // Validate that within a team, no pair violates "were last teammates"
    const isTeamValid = (names: string[]) => {
      const norm = names.map(cleanPlayerName);
      for (let i = 0; i < norm.length; i++) {
        for (let j = i + 1; j < norm.length; j++) {
          const a = norm[i];
          const b = norm[j];
          const matesA = lastTeammates.get(a);
          const matesB = lastTeammates.get(b);
          if ((matesA && matesA.has(b)) || (matesB && matesB.has(a))) {
            return false;
          }
        }
      }
      return true;
    };

    // Try to find a valid split with shuffles
    const MAX_TRIES = 600;
    for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
      const shuffled = [...pool].sort(() => Math.random() - 0.5);
      const pickA = shuffled.slice(0, teamASize).map((p) => p.name);
      const pickB = shuffled
        .slice(teamASize, teamASize + teamBSize)
        .map((p) => p.name);

      if (isTeamValid(pickA) && isTeamValid(pickB)) {
        setTeamA(pickA);
        setTeamB(pickB);
        setManualTeamA([]);
        setManualTeamB([]);
        return;
      }
    }

    alert(
      "Couldn't form teams without repeating last-match teammates. Try changing the selection or team mode."
    );
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

    const activeTiers =
      selectedTiers.length > 0
        ? selectedTiers
        : Object.keys(tierGroups).map(Number);

    const eligibleTiers = activeTiers.filter(
      (tier) => tierGroups[tier] && tierGroups[tier].length >= 2
    );

    if (eligibleTiers.length === 0) {
      alert("No tier with at least 2 clubs was found in the selected tiers.");
      return;
    }

    const randomTier =
      eligibleTiers[Math.floor(Math.random() * eligibleTiers.length)];
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
        : manualTeamA
            .map((id) => players.find((p) => p.id === id)?.name || "")
            .filter(Boolean);
    const teamBNames =
      teamB.length > 0
        ? teamB
        : manualTeamB
            .map((id) => players.find((p) => p.id === id)?.name || "")
            .filter(Boolean);

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
            selectedForRandom={selectedForRandom}
            toggleSelectForRandom={toggleSelectForRandom}
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

          <TierSelector
            clubs={clubs}
            selectedTiers={selectedTiers}
            setSelectedTiers={setSelectedTiers}
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
