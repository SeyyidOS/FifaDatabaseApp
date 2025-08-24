// const API_URL = "https://simple-235722045899.us-central1.run.app";
// const API_URL = "http://localhost:8080";
const API_URL = "http://173.249.40.69:8080";  // Contabo

export const fetchPlayersAdmin = async () => {
  const res = await fetch(`${API_URL}/admin/players`);
  return res.json();
};

export const deletePlayerAdmin = async (id: number) => {
  return fetch(`${API_URL}/admin/player/${id}`, { method: "DELETE" });
};

export const fetchMatchesAdmin = async () => {
  const res = await fetch(`${API_URL}/admin/matches`);
  return res.json();
};

export const deleteMatchAdmin = async (id: number) => {
  return fetch(`${API_URL}/admin/match/${id}`, { method: "DELETE" });
};
