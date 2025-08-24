// const API_URL = "https://simple-235722045899.us-central1.run.app";
// const API_URL = "http://localhost:8080";
const API_URL = "http://173.249.40.69:8080"; // Contabo

export const fetchPlayerLeaderboard = async (startTime: string) => {
  const res = await fetch(
    `${API_URL}/leaderboard/players?start_time=${startTime}`
  );
  return res.json();
};

export const fetchTeamLeaderboard = async (startTime: string) => {
  const res = await fetch(
    `${API_URL}/leaderboard/teams?start_time=${startTime}`
  );
  return res.json();
};

export const fetchDuoLeaderboard = async (startTime: string) => {
  const res = await fetch(
    `${API_URL}/leaderboard/duos?start_time=${startTime}`
  );
  return res.json();
};
