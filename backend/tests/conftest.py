import os
from urllib.parse import urlsplit, urlunsplit

import psycopg2
import pytest
from fastapi.testclient import TestClient

ADMIN_KEY = "test-server-admin-key"
MEMBER_PW = "member-pass"
ADMIN_PW = "admin-pass"


def _require_test_database() -> str:
    url = os.getenv("DATABASE_URL")
    if not url:
        pytest.skip("API tests need DATABASE_URL pointing at a throwaway database named *_test")
    name = urlsplit(url).path.lstrip("/")
    if not name.endswith("_test"):
        # the tests truncate and drop things: never run them against a real database
        pytest.exit(f"refusing to run tests against database {name!r}", returncode=2)
    return url


@pytest.fixture(scope="session")
def client():
    _require_test_database()
    os.environ.update(ADMIN_KEY=ADMIN_KEY, SECRET_KEY="test-secret")
    from main import app

    with TestClient(app) as c:
        yield c


@pytest.fixture
def api(client):
    import auth

    client.app.state.db.execute("TRUNCATE boards, players, matches, match_players RESTART IDENTITY CASCADE")
    auth.failed_logins._events.clear()
    auth.board_creations._events.clear()
    return client


class Board:
    def __init__(self, api, name="Kerem's Crew"):
        response = api.post("/boards", json={"name": name, "password": MEMBER_PW, "adminPassword": ADMIN_PW})
        assert response.status_code == 201, response.text
        self.api = api
        self.slug = response.json()["slug"]
        self.admin = {"Authorization": f"Bearer {response.json()['token']}"}
        member = api.post(f"/boards/{self.slug}/login", json={"password": MEMBER_PW}).json()
        self.member = {"Authorization": f"Bearer {member['token']}"}

    def url(self, path: str) -> str:
        return f"/boards/{self.slug}{path}"

    def add_players(self, *names):
        for name in names:
            assert self.api.post(self.url("/players"), json={"name": name}, headers=self.member).status_code == 201

    def add_match(self, team_a, team_b, score_a, score_b, club_a="Arsenal", club_b="Chelsea"):
        body = {"clubA": club_a, "clubB": club_b, "teamA": team_a, "teamB": team_b}
        body |= {"scoreA": score_a, "scoreB": score_b}
        return self.api.post(self.url("/matches"), json=body, headers=self.member)


@pytest.fixture
def board(api):
    return Board(api)


@pytest.fixture
def scratch_database():
    """A brand-new empty database next to the test database, dropped afterwards."""
    url = _require_test_database()
    parts = urlsplit(url)
    name = "fifa_migration_test"
    admin = psycopg2.connect(url)
    admin.autocommit = True
    with admin.cursor() as cur:
        cur.execute(f"DROP DATABASE IF EXISTS {name}")
        cur.execute(f"CREATE DATABASE {name}")
    yield urlunsplit(parts._replace(path=f"/{name}"))
    with admin.cursor() as cur:
        cur.execute(f"DROP DATABASE IF EXISTS {name} WITH (FORCE)")
    admin.close()
