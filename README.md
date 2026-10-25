# Matchnight

Match tracking for match nights with friends (formerly FIFA Manager): boards per group, Elo for players, club ratings per game
(FC26, FC27…), a night planner and stats. Live at **https://matchnight.hotspotkeeper.com**.

| Folder      | What it is                                                                     |
|-------------|--------------------------------------------------------------------------------|
| `backend/`  | FastAPI + Postgres API ([backend/README.md](backend/README.md))                |
| `frontend/` | React + Vite + Tailwind app; Elo replay, club model and fixture logic in `src/lib` |
| `frontend/ios/` | the iPhone app: the same app in a native shell, built in GitHub Actions ([frontend/ios/README.md](frontend/ios/README.md)) |
| `deploy/`   | how the server runs it ([deploy/README.md](deploy/README.md))                  |

## How we work

`main` is what is live. Nobody pushes to it directly:

1. Branch off `main` (`git switch -c your-change`), commit, push, open a pull request.
2. GitHub Actions checks it ([.github/workflows/ci.yml](.github/workflows/ci.yml)): backend lint and
   tests against a real Postgres, frontend type check, lint, tests and build. A pull request can only
   be merged once both checks pass.
3. Merge it. Within a couple of minutes of the checks passing on `main`, the server backs up the
   database and publishes that commit. If the new version doesn't come up healthy, the previous one is
   put back automatically.

The live commit is shown at the bottom of Settings and at `/api/health`. Schema changes go in
`backend/migrations.py` as a new numbered step; they run once, on the first start of the new version.

## Outage alert

[.github/workflows/uptime.yml](.github/workflows/uptime.yml) checks the live site from GitHub every 15
minutes: `/api/health` must say `"ok": true`, and a board's players must stay closed without signing in
(401). It tries again a minute later before failing. A failed run e-mails whoever last changed that
file's schedule. The address is the `SITE` line at its top.

GitHub pauses scheduled workflows after 60 days without activity in the repository. If the alerts have
gone quiet after a long pause, turn it back on under Actions › Uptime › Enable workflow.

## Run it locally

You need Docker, Python 3.11 and Node 20.

```bash
# a database
docker run -d --name fifa-dev-db -p 5432:5432 \
  -e POSTGRES_USER=fifa -e POSTGRES_PASSWORD=fifa -e POSTGRES_DB=fifa postgres:16-alpine

# the API on :8080 (applies the migrations on start)
cd backend
pip install -r requirements.txt -r requirements-dev.txt
DATABASE_URL=postgresql://fifa:fifa@localhost/fifa uvicorn main:app --reload --port 8080

# the app on :5173, which sends /api to the API above
cd frontend
npm ci
npm run dev        # open http://localhost:5173/FifaDatabaseApp/
```

Create a board from the home page and you're in. Before opening a pull request, run what CI runs:

```bash
docker exec fifa-dev-db createdb -U fifa fifa_test   # once; the tests only run on a *_test database
cd backend && ruff check . && ruff format --check . && DATABASE_URL=postgresql://fifa:fifa@localhost/fifa_test pytest -q
cd frontend && npx tsc -b && npx eslint src && npx vitest run
```

Secrets and the database live only on the server; nothing in this repository is secret.
