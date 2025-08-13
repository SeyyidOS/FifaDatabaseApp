from fastapi import FastAPI, Query, HTTPException  # type: ignore
from pydantic import BaseModel, Field
from datetime import date
from fastapi.middleware.cors import CORSMiddleware  # type: ignore

from database import Database
from player_service import PlayerService
from club_service import ClubService
from match_service import MatchService
from leaderboard_service import LeaderboardService
from elo_service import EloService
from elo_settings_service import EloSettingsService

app = FastAPI()

# Database & services
db = Database()
player_service = PlayerService(db)
club_service = ClubService(db)
match_service = MatchService(db)
leaderboard_service = LeaderboardService(db)

# New: K-factor settings service + Elo compute service
elo_settings_service = EloSettingsService(db)
elo_service = EloService(db)

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
    if not name or not str(name).strip():
        raise HTTPException(status_code=400, detail="name is required")
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
def get_players_lb(start_time: date = Query(...)):
    return leaderboard_service.get_player_leaderboard(start_time)


@app.get("/leaderboard/teams")
def get_teams_lb(start_time: date = Query(...)):
    return leaderboard_service.get_team_leaderboard(start_time)


@app.get("/leaderboard/duos")
def get_duos_lb(start_time: date = Query(...)):
    return leaderboard_service.get_duo_leaderboard(start_time)


# ----------- Admin Routes -----------
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


# ----------- ELO Settings & Ratings -----------
class EloSettingsUpdate(BaseModel):
    kFactor: int = Field(..., ge=8, le=64)


@app.get("/settings/elo")
def get_elo_settings():
    return {"kFactor": elo_settings_service.get_k_factor()}


@app.put("/settings/elo")
def update_elo_settings(payload: EloSettingsUpdate):
    k = payload.kFactor
    elo_settings_service.set_k_factor(k)
    return {"kFactor": k}


@app.get("/elo")
def get_elo(k: int | None = Query(default=None, ge=1, le=200)):
    """
    Returns current ratings computed from matches.
    Optional ?k=NN overrides the stored K-factor for this calculation only.
    """
    k_to_use = k if k is not None else elo_settings_service.get_k_factor()
    ratings = elo_service.compute_ratings(k_factor=k_to_use)
    return {"ratings": [{"playerId": pid, "elo": elo} for pid, elo in ratings.items()]}
