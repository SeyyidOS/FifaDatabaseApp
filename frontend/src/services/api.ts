// const API_URL = "https://simple-235722045899.us-central1.run.app";
const API_URL = "http://localhost:8080";

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
  return await fetch(`${API_URL}/matches`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(matchData),
  });
};
