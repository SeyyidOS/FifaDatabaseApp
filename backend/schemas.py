"""Request bodies. Field names stay camelCase because that is what the frontend sends."""

import re
from typing import Annotated, Literal

from pydantic import AfterValidator, BaseModel, Field, StringConstraints, model_validator

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
ClubElo = Annotated[int, Field(ge=0, le=3000)]
SeasonName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=40)]
BoardName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=60)]
Password = Annotated[str, StringConstraints(min_length=6, max_length=128)]
Score = Annotated[int, Field(ge=0, le=99)]
KFactor = Annotated[int, Field(ge=8, le=64)]


class BoardCreate(BaseModel):
    name: BoardName
    password: Password
    adminPassword: Password

    @model_validator(mode="after")
    def different_passwords(self) -> "BoardCreate":
        if self.password == self.adminPassword:
            raise ValueError("the admin password must differ from the board password")
        return self


class Login(BaseModel):
    password: str = Field(min_length=1, max_length=128)


class BoardUpdate(BaseModel):
    name: BoardName | None = None
    kFactor: KFactor | None = None
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


class MatchIn(BaseModel):
    clubA: ClubName
    clubB: ClubName
    teamA: list[PlayerName] = Field(min_length=1, max_length=3)
    teamB: list[PlayerName] = Field(min_length=1, max_length=3)
    scoreA: Score
    scoreB: Score

    @model_validator(mode="after")
    def distinct_players(self) -> "MatchIn":
        for team in (self.teamA, self.teamB):
            if len(set(team)) != len(team):
                raise ValueError("a player is listed twice in the same team")
        both = set(self.teamA) & set(self.teamB)
        if both:
            raise ValueError(f"players on both sides: {', '.join(sorted(both))}")
        return self
