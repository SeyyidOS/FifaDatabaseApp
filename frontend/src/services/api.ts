const API_URL = "https://simple-235722045899.us-central1.run.app";

export const fetchPlayersAPI = async () => {
  const res = await fetch(`${API_URL}/players`);
  return res.json();
};

export const fetchClubsAPI = async () => {
  const res = await fetch(`${API_URL}/clubs`);
  return res.json();
};

export const fetchMatchesAPI = async () => {
  const res = await fetch(`${API_URL}/matches`);
  return res.json();
};

export const addPlayerAPI = async (name: string) => {
  const res = await fetch(`${API_URL}/players`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  return res.json();
};

export interface MatchData {
  clubA: string;
  clubB: string;
  teamA: string[];
  teamB: string[];
  scoreA: number;
  scoreB: number;
}

export const addMatchAPI = async (matchData: MatchData) => {
  return await fetch(`${API_URL}/matches`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(matchData),
  });
};
