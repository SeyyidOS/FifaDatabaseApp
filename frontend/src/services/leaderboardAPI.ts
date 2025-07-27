const API_URL = "https://simple-235722045899.us-central1.run.app";
// const API_URL = "http://localhost:8080";

export const fetchPlayerLeaderboard = async () => {
  const res = await fetch(`${API_URL}/leaderboard/players`);
  return res.json();
};

export const fetchTeamLeaderboard = async () => {
  const res = await fetch(`${API_URL}/leaderboard/teams`);
  return res.json();
};

export const fetchDuoLeaderboard = async () => {
  const res = await fetch(`${API_URL}/leaderboard/duos`);
  return res.json();
};
