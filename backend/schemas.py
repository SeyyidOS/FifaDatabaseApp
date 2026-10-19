"""Request bodies. Field names stay camelCase because that is what the frontend sends."""

import json
import re
from datetime import datetime
from typing import Annotated, Literal

from pydantic import AfterValidator, BaseModel, ConfigDict, Field, StringConstraints, model_validator

# Letters (any language), digits, spaces, dots, dashes, underscores and apostrophes. "&" is excluded
# because it joins the names of a duo.
NAME_PATTERN = re.compile(r"^\w[\w .'-]*$")


def _player_name(name: str) -> str:
    name = " ".join(name.split()).lower()
    if not NAME_PATTERN.match(name):
        raise ValueError("use letters, numbers, spaces, dots, dashes or apostrophes")
    return name


PlayerName = Annotated[str, StringConstraints(min_length=1, max_length=30), AfterValidator(_player_name)]
ClubName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]
# the card model can rate the weakest clubs below zero; only differences between ratings matter
ClubElo = Annotated[int, Field(ge=-1000, le=3000)]
SeasonName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=40)]
BoardName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=60)]
Password = Annotated[str, StringConstraints(min_length=6, max_length=128)]
Score = Annotated[int, Field(ge=0, le=99)]
KFactor = Annotated[int, Field(ge=8, le=64)]
# in steps of 0.1, like the fc27-elo tool
ClubWeight = Annotated[float, Field(ge=0, le=2), AfterValidator(lambda w: round(w, 1))]


class BoardCreate(BaseModel):
    name: BoardName
    # both, or neither: a league started with an account has none (boards.create_board)
    password: Password | None = None
    adminPassword: Password | None = None

    @model_validator(mode="after")
    def different_passwords(self) -> "BoardCreate":
        if (self.password is None) != (self.adminPassword is None):
            raise ValueError("give both passwords, or neither")
        if self.password is not None and self.password == self.adminPassword:
            raise ValueError("the admin password must differ from the board password")
        return self


class Login(BaseModel):
    password: str = Field(min_length=1, max_length=128)


EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _email(email: str) -> str:
    email = email.strip().lower()
    if not EMAIL_PATTERN.match(email):
        raise ValueError("enter an e-mail address")
    return email


Email = Annotated[str, StringConstraints(max_length=254), AfterValidator(_email)]
AccountName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=40)]


class LinkRequest(BaseModel):
    email: Email
    # the language of the e-mail
    lang: Literal["en", "tr"] = "en"


class LinkVerify(BaseModel):
    token: str = Field(min_length=20, max_length=100)


class CodeVerify(BaseModel):
    email: Email
    code: Annotated[str, StringConstraints(strip_whitespace=True, pattern=r"^[0-9]{6}$")]


class AccountUpdate(BaseModel):
    name: AccountName


class BoardClaim(BaseModel):
    password: str = Field(min_length=1, max_length=128)


class MembershipPlayer(BaseModel):
    # None: not linked to any player
    playerId: int | None


class InviteCreate(BaseModel):
    # a personal link for this player; none: the board's group link
    playerId: int | None = None


class InviteAccept(BaseModel):
    """By a group link: the player you are, or the name of a new player (or neither: just join)."""

    playerId: int | None = None
    newName: PlayerName | None = None

    @model_validator(mode="after")
    def one_of(self) -> "InviteAccept":
        if self.playerId is not None and self.newName is not None:
            raise ValueError("pick a player or a new name, not both")
        return self


class MemberUpdate(BaseModel):
    role: Literal["admin", "player"]


class BoardUpdate(BaseModel):
    name: BoardName | None = None
    kFactor: KFactor | None = None
    clubWeight: ClubWeight | None = None
    password: Password | None = None
    adminPassword: Password | None = None

    @model_validator(mode="after")
    def different_passwords(self) -> "BoardUpdate":
        if self.password and self.password == self.adminPassword:
            raise ValueError("the admin password must differ from the board password")
        return self


class PlayerIn(BaseModel):
    name: PlayerName


class PlayerUpdate(BaseModel):
    name: PlayerName | None = None
    archived: bool | None = None


class SeasonIn(BaseModel):
    name: SeasonName
    copyFrom: int | None = None  # season whose clubs to start from


class SeasonUpdate(BaseModel):
    name: SeasonName | None = None
    active: Literal[True] | None = None


class ClubIn(BaseModel):
    name: ClubName
    elo: ClubElo


class ClubUpdate(BaseModel):
    name: ClubName | None = None
    elo: ClubElo | None = None


class ModelClub(BaseModel):
    eaId: int = Field(gt=0)
    name: ClubName
    modelElo: ClubElo


class ModelApply(BaseModel):
    """A card model's ratings for a season, with the settings and game that produced them."""

    game: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=10)]
    model: dict
    clubs: list[ModelClub] = Field(min_length=1, max_length=200)

    @model_validator(mode="after")
    def small_and_distinct(self) -> "ModelApply":
        if len(json.dumps(self.model)) > 4000:
            raise ValueError("the model settings are too large")
        ids = [c.eaId for c in self.clubs]
        if len(set(ids)) != len(ids):
            raise ValueError("a club is listed twice")
        return self


class PlannedMatch(BaseModel):
    teamA: list[PlayerName] = Field(min_length=1, max_length=3)
    teamB: list[PlayerName] = Field(min_length=1, max_length=3)

    @model_validator(mode="after")
    def distinct_players(self) -> "PlannedMatch":
        if len(set(self.teamA + self.teamB)) != len(self.teamA) + len(self.teamB):
            raise ValueError("a player is listed twice in a planned match")
        return self


class FixtureIn(BaseModel):
    """A night's plan: the rules it was made with (kept for display) and the matches in order."""

    rules: dict
    # 20 matches each, the most the planner asks for, fits 40 players
    matches: list[PlannedMatch] = Field(min_length=1, max_length=200)

    @model_validator(mode="after")
    def small_rules(self) -> "FixtureIn":
        if len(json.dumps(self.rules)) > 2000:
            raise ValueError("the rules are too large")
        return self


class FixtureMatchUpdate(BaseModel):
    skipped: bool


class MatchSides(BaseModel):
    """Who plays whom, with which clubs."""

    clubA: ClubName
    clubB: ClubName
    teamA: list[PlayerName] = Field(min_length=1, max_length=3)
    teamB: list[PlayerName] = Field(min_length=1, max_length=3)

    @model_validator(mode="after")
    def distinct_players(self) -> "MatchSides":
        for team in (self.teamA, self.teamB):
            if len(set(team)) != len(team):
                raise ValueError("a player is listed twice in the same team")
        both = set(self.teamA) & set(self.teamB)
        if both:
            raise ValueError(f"players on both sides: {', '.join(sorted(both))}")
        return self


class MatchIn(MatchSides):
    scoreA: Score
    scoreB: Score


class LiveMatchIn(MatchSides):
    """A match started now (live.py). `replaces` is one being played that this one takes over from (its teams
    or clubs changed); `force` starts it although a player is in another match being played; `startedAt`
    keeps the start of one brought back (a saved result taken back)."""

    replaces: int | None = None
    force: bool = False
    startedAt: datetime | None = None


class MatchScore(BaseModel):
    """A logged match's score, put right."""

    scoreA: Score
    scoreB: Score


# ----------- Match stats -----------
Count = Annotated[int, Field(ge=0, le=999)]
Percent = Annotated[int, Field(ge=0, le=100)]


class SideStats(BaseModel):
    """One side's numbers from the game's match summary ("Özet") screen; any of them may be missing."""

    model_config = ConfigDict(extra="forbid")

    possession: Percent | None = None
    recoveryTime: Count | None = None  # seconds to win the ball back
    shots: Count | None = None
    xg: Annotated[float, Field(ge=0, le=99)] | None = None
    passes: Annotated[int, Field(ge=0, le=9999)] | None = None
    tackles: Count | None = None
    tacklesWon: Count | None = None
    interceptions: Count | None = None
    saves: Count | None = None
    fouls: Count | None = None
    offsides: Count | None = None
    corners: Count | None = None
    freeKicks: Count | None = None
    penalties: Count | None = None
    yellowCards: Count | None = None
    redCards: Count | None = None
    dribbleSuccess: Percent | None = None
    shotAccuracy: Percent | None = None
    passAccuracy: Percent | None = None


class MatchStatsIn(BaseModel):
    """A match's stats by the app's sides (A and B), whichever side the game showed as home."""

    A: SideStats
    B: SideStats
    # the photo they were read from, if any
    photoId: int | None = None
    source: Literal["ocr", "manual"] = "manual"
