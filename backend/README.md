# FIFA Manager API

FastAPI + Postgres. Each group gets a password-protected **board** with its own players, matches,
standings and K-factor; the club catalogue is shared. On startup the API applies pending schema
migrations (`migrations.py`) and, on an empty database, seeds the clubs from `data/clubs.csv`.

| Module           | Responsibility                                                              |
|------------------|-----------------------------------------------------------------------------|
| `main.py`        | app setup, `/health`, `/clubs`                                              |
| `boards.py`      | create a board, sign in, board settings                                     |
| `board_data.py`  | a board's players, matches, ratings and standings                           |
| `auth.py`        | password hashing, signed device tokens, rate limits, access checks          |
| `migrations.py`  | versioned schema changes (v2 moved the original data into the `main` board) |
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
