# FIFA Manager API

FastAPI + Postgres. Each group gets a password-protected **board** with its own players, matches,
standings, K-factor and club ratings. On startup the API applies pending schema migrations
(`migrations.py`).

| Module           | Responsibility                                                              |
|------------------|-----------------------------------------------------------------------------|
| `main.py`        | app setup, `/health`                                                        |
| `boards.py`      | create a board, sign in, board settings                                     |
| `board_data.py`  | a board's players, matches, ratings and standings                           |
| `seasons.py`     | a board's seasons and their club ratings (by hand or from a card model)     |
| `fixtures.py`    | the night's plan: who plays with and against whom, in order                 |
| `auth.py`        | password hashing, signed device tokens, rate limits, access checks          |
| `migrations.py`  | versioned schema changes (v2 boards … v5 plans, v6 club weight)             |
| `db.py`          | connection pool (recovers after database restarts) and transactions         |
| `schemas.py`     | request validation                                                          |
| `elo.py`         | Elo replay (mirrored in `frontend/src/lib/elo.ts`)                          |
| `leaderboard.py` | player / club / duo standings                                               |

## Access

A board has a **board password** (role `member`: read, add players, log matches) and an **admin
password** (role `admin`: archive/rename/delete players, delete matches, settings). `POST
/boards/{slug}/login` picks the role from the password and returns a token signed with
`SECRET_KEY`; send it as `Authorization: Bearer <token>`. Changing a password bumps that role's
version, which invalidates its old tokens. Players with matches are archived, never deleted, so
history and everyone's ratings stay put.

## Seasons and club ratings

Club ratings belong to a **season** of a board (FC26, FC27, ...), and one season is active. A new
match looks its clubs up in the active season (case-insensitively; other names are custom clubs at
500) and **stores those ratings on the match** (`club_a_elo`, `club_b_elo`). The Elo replay only
reads the stored ratings, so editing a club, removing it or switching seasons never changes past
results or anyone's rating. Admins prepare a new season aside (empty or copied from another), edit
it, then make it active. New boards start from the newest list in `data/seasons/` (`name,elo[,ea_id]`
CSV); add e.g. `FC28.csv` there to make it the default for boards created afterwards.

A side's strength is its players' average rating plus its club's rating times the board's **club
weight** (0 to 2 in steps of 0.1, default 0.5), which admins set. A new match stores the weight along
with its club ratings (`matches.club_weight`), so changing it only affects matches entered afterwards;
the Match Center's win chance and balanced club picks use the current one.

From FC27 on, ratings can come from the game's cards. The card model runs in the frontend
(`frontend/src/lib/clubModel.ts`, a port of the fc27-elo study, checked against it in
`clubModel.test.ts`): each club's best 4-3-3 plus substitutes, scored by position and fitted onto the
previous season's scale. `POST /boards/{slug}/seasons/{id}/model` stores the result on a draft
season: every club keeps its EA id, the model's rating and an admin's correction on top
(`elo = model_elo + adjust`), so re-running the model keeps corrections. Card data lives in
`frontend/public/games/<game>/` and is imported from the study's export with
`frontend/scripts/import-fc-cards.py`; the server never contacts fut.gg.

## The night's plan

`PUT /boards/{slug}/fixture` stores the night's planned matches (generated in the frontend by
`lib/fixture.ts`; anyone on the board may make one, and a new plan closes the previous one). When a
match is recorded, the first unplayed, unskipped planned match with the same two sides is ticked off;
deleting the match opens it again.

## Configuration

| Variable                      | Default           | Meaning                                                           |
|-------------------------------|-------------------|-------------------------------------------------------------------|
| `DATABASE_URL`                | –                 | Postgres URL; if unset, `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASS` |
| `SECRET_KEY`                  | random per start  | signs device tokens; without it devices sign out on every restart |
| `ADMIN_KEY`                   | –                 | server admin key (`X-Admin-Key`), admin on every board            |
| `BOARD_CREATION`              | `open`            | `closed`: only requests with `ADMIN_KEY` may create boards        |
| `LEGACY_BOARD_PASSWORD`, `LEGACY_BOARD_ADMIN_PASSWORD` | random, logged | first passwords of `main` when upgrading an old database |
| `APP_TIMEZONE`                | `Europe/Istanbul` | which midnight the leaderboard `start_time` refers to             |
| `CORS_ORIGINS`                | `*`               | comma-separated origins allowed to call the API from a browser    |

A `.env` file next to `main.py` is read too.

## Develop and test

```bash
make install
make dev     # http://localhost:8080/docs
DATABASE_URL=postgresql://user:pass@localhost/fifa_test make test
```

The tests truncate tables and create a scratch database, so they refuse to run unless the database
name ends in `_test`.
