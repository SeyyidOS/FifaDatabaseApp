from fastapi import FastAPI, Query  # type: ignore
from datetime import date
from fastapi.middleware.cors import CORSMiddleware  # type: ignore
from database import Database
from player_service import PlayerService
from club_service import ClubService
from match_service import MatchService
from leaderboard_service import LeaderboardService

app = FastAPI()

# Database
db = Database()
player_service = PlayerService(db)
club_service = ClubService(db)
match_service = MatchService(db)
leaderboard_service = LeaderboardService(db)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ----------- Player Routes -----------
@app.get("/players")
def get_players():
    return player_service.get_players()


@app.post("/players")
def add_player(player: dict):
    name = player.get("name")
    player_service.add_player(name)
    return {"message": f"Player {name} added successfully."}


# ----------- Club Routes -----------
@app.get("/clubs")
def get_clubs():
    return club_service.get_clubs()


# ----------- Match Routes -----------
@app.get("/matches")
def get_matches():
    return match_service.get_matches()


@app.post("/matches")
def add_match(match: dict):
    clubA = match.get("clubA")
    clubB = match.get("clubB")
    teamA = match.get("teamA")
    teamB = match.get("teamB")
    scoreA = match.get("scoreA")
    scoreB = match.get("scoreB")

    match_service.add_match(clubA, clubB, teamA, teamB, scoreA, scoreB)
    return {"message": "Match added successfully."}


# ----------- Leaderboard Routes -----------
@app.get("/leaderboard/players")
def get_players(start_time: date = Query(...)):
    return leaderboard_service.get_player_leaderboard(start_time)


@app.get("/leaderboard/teams")
def get_teams(start_time: date = Query(...)):
    return leaderboard_service.get_team_leaderboard(start_time)


@app.get("/leaderboard/duos")
def get_duos(start_time: date = Query(...)):
    return leaderboard_service.get_duo_leaderboard(start_time)


@app.get("/admin/players")
def get_all_players():
    return player_service.get_players()


@app.delete("/admin/player/{player_id}")
def delete_player(player_id: int):
    return player_service.delete_player(player_id)


@app.get("/admin/matches")
def get_all_matches():
    return match_service.get_matches()


@app.delete("/admin/match/{match_id}")
def delete_match(match_id: int):
    return match_service.delete_match(match_id)
