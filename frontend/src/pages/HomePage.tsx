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
  fetchEloRatings,
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
  const [selectedForRandom, setSelectedForRandom] = useState<number[]>([]);
  const [eloRatings, setEloRatings] = useState<Record<number, number>>({});
  const [eloMatchmakingEnabled, setEloMatchmakingEnabled] =
    useState<boolean>(false);
  // const [kFactor, setKFactor] = useState<number | null>(null); // optional display

  const INITIAL_ELO = 1000;

  const cleanText = (s: string) =>
    s
      .replace(/[{}()]/g, "")
      .trim()
      .toLowerCase();
  const parseTeamNames = (teamStr: string) =>
    teamStr
      .split(",")
      .map((x) => cleanText(x))
      .filter(Boolean);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [playersResp, clubsResp, matchesResp, eloResp] =
          await Promise.all([
            fetchPlayersAPI(),
            fetchClubsAPI(),
            fetchMatchesAPI(),
            fetchEloRatings(),
          ]);

        setPlayers(playersResp);
        setClubs(clubsResp);
        setMatches(matchesResp);
        // setKFactor(settingsResp?.kFactor ?? null);

        // Build map {id: elo}
        const ratingsMap: Record<number, number> = {};
        (eloResp?.ratings || []).forEach(
          (r) => (ratingsMap[r.playerId] = r.elo)
        );
        // Default missing players to 1000 (e.g., new players without matches yet)
        playersResp.forEach((p: Player) => {
          if (!(p.id in ratingsMap)) ratingsMap[p.id] = INITIAL_ELO;
        });
        setEloRatings(ratingsMap);

        // default: tick everyone for randomization
        setSelectedForRandom(playersResp.map((p: Player) => p.id));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const refreshElo = async () => {
    try {
      const eloResp = await fetchEloRatings();
      const map: Record<number, number> = {};
      (eloResp?.ratings || []).forEach((r) => (map[r.playerId] = r.elo));
      // keep defaults for any brand-new player not in list
      players.forEach((p) => {
        if (!(p.id in map)) map[p.id] = INITIAL_ELO;
      });
      setEloRatings(map);
    } catch (e) {
      console.error("Failed to fetch elo ratings:", e);
    }
  };

  const fetchMatches = async () => {
    try {
      setMatches(await fetchMatchesAPI());
    } catch (e) {
      console.error("Failed to fetch matches:", e);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;
    try {
      const data = await addPlayerAPI(username);
      setMessage(data.message);
      setUsername("");
      // reload players and then refresh elo to add default rating for the new player
      const ps = await fetchPlayersAPI();
      setPlayers(ps);
      setSelectedForRandom(ps.map((p: Player) => p.id));
      await refreshElo();
    } catch (error) {
      console.error("Failed to add player:", error);
    }
  };

  const toggleSelectForRandom = (playerId: number) => {
    setSelectedForRandom((prev) =>
      prev.includes(playerId)
        ? prev.filter((id) => id !== playerId)
        : [...prev, playerId]
    );
  };

  // Build: player's last teammates map
  const buildLastTeammatesMap = () => {
    const sorted = [...matches].sort(
      (a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()
    );
    const recorded = new Set<string>();
    const lastTeammates = new Map<string, Set<string>>();

    for (const m of sorted) {
      const A = parseTeamNames(m.team_a);
      const B = parseTeamNames(m.team_b);

      for (const p of A) {
        if (!recorded.has(p)) {
          recorded.add(p);
          lastTeammates.set(p, new Set(A.filter((x) => x !== p)));
        }
      }
      for (const p of B) {
        if (!recorded.has(p)) {
          recorded.add(p);
          lastTeammates.set(p, new Set(B.filter((x) => x !== p)));
        }
      }
    }
    return lastTeammates;
  };

  const teamAverageEloByNames = (names: string[]) => {
    const nameToId = new Map<string, number>();
    players.forEach((p) => nameToId.set(cleanText(p.name), p.id));
    const values = names
      .map((n) => eloRatings[nameToId.get(cleanText(n)) ?? -1])
      .filter((v) => typeof v === "number");
    return values.length
      ? values.reduce((a, b) => a + b, 0) / values.length
      : INITIAL_ELO;
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

    const lastTeammates = buildLastTeammatesMap();

    const isTeamValid = (names: string[]) => {
      const norm = names.map((n) => cleanText(n));
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

    const MAX_TRIES = 1200;
    let bestSplit: { A: string[]; B: string[] } | null = null;
    let bestDiff = Number.POSITIVE_INFINITY;

    for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
      const shuffled = [...pool].sort(() => Math.random() - 0.5);
      const slice = shuffled.slice(0, totalNeeded);
      const pickA = slice.slice(0, teamASize).map((p) => p.name);
      const pickB = slice
        .slice(teamASize, teamASize + teamBSize)
        .map((p) => p.name);

      if (!isTeamValid(pickA) || !isTeamValid(pickB)) continue;

      if (eloMatchmakingEnabled) {
        const avgA = teamAverageEloByNames(pickA);
        const avgB = teamAverageEloByNames(pickB);
        const diff = Math.abs(avgA - avgB);

        if (diff < bestDiff) {
          bestDiff = diff;
          bestSplit = { A: pickA, B: pickB };
          if (bestDiff === 0) break;
        }
      } else {
        setTeamA(pickA);
        setTeamB(pickB);
        setManualTeamA([]);
        setManualTeamB([]);
        return;
      }
    }

    if (eloMatchmakingEnabled && bestSplit) {
      setTeamA(bestSplit.A);
      setTeamB(bestSplit.B);
      setManualTeamA([]);
      setManualTeamB([]);
      return;
    }

    alert(
      eloMatchmakingEnabled
        ? "Couldn't form balanced ELO teams without repeating last-match teammates. Try changing selection or team mode."
        : "Couldn't form teams without repeating last-match teammates. Try changing selection or team mode."
    );
  };

  const generateRandomClubs = () => {
    if (clubs.length < 2) {
      alert("You need at least 2 clubs to select randomly.");
      return;
    }

    const tierGroups: { [tier: number]: Club[] } = {};
    clubs.forEach((club) => {
      (tierGroups[club.tier] ||= []).push(club);
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

      await fetchMatches();
      await refreshElo(); // ratings update after new match
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
            eloRatings={eloRatings}
          />

          <TeamManager
            teamMode={teamMode}
            setTeamMode={setTeamMode}
            eloMatchmakingEnabled={eloMatchmakingEnabled}
            setEloMatchmakingEnabled={setEloMatchmakingEnabled}
            generateRandomTeams={generateRandomTeams}
            teamA={teamA}
            teamB={teamB}
            manualTeamA={manualTeamA}
            manualTeamB={manualTeamB}
            players={players}
            eloRatings={eloRatings}
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
