// const API_URL = "https://simple-235722045899.us-central1.run.app";
// const API_URL = "http://localhost:8080";
const API_URL = "http://173.249.40.69:8080"; // Contabo

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

export const addMatchAPI = async (matchData: any) => {
  const res = await fetch(`${API_URL}/matches`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(matchData),
  });
  return res.json();
};

/** ---- ELO endpoints (server authoritative) ---- */
export const fetchEloSettings = async () => {
  const res = await fetch(`${API_URL}/settings/elo`);
  return res.json() as Promise<{ kFactor: number }>;
};

export const updateEloSettings = async (kFactor: number) => {
  const res = await fetch(`${API_URL}/settings/elo`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kFactor }),
  });
  return res.json() as Promise<{ kFactor: number }>;
};

export const fetchEloRatings = async () => {
  const res = await fetch(`${API_URL}/elo`);
  return res.json() as Promise<{
    ratings: { playerId: number; elo: number }[];
  }>;
};
