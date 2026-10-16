# Matchnight API

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
| `photos.py`      | photos of a match (the stats screens), stored as files in `PHOTO_DIR`       |
| `avatars.py`     | an account's photo, shown wherever its player appears (also in `PHOTO_DIR`)  |
| `accounts.py`    | accounts: sign in with a one-time link sent by e-mail (off by default)      |
| `mailer.py`      | the e-mails the app sends (sign-in links), over SMTP                        |
| `memberships.py` | which accounts are in which board, with what role (off with accounts)      |
| `invites.py`     | invite links, join requests and managing members (off with accounts)        |
| `auth.py`        | password hashing, signed device tokens, rate limits, access checks          |
| `migrations.py`  | versioned schema changes (v2 boards … v14 account photos, v15 sign-in codes) |
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

With accounts on (below), a new league has **no passwords**: `POST /boards` needs a signed-in account,
which becomes its owner, and people come in with invites. Its login answers 403, `GET /boards/{slug}`
and `/me` say `"passwordLogin": false`, and setting a password is refused. (The server `ADMIN_KEY` can
still make a board with passwords, for scripts and tests.) Boards from before keep their passwords.

## Accounts

The first step towards boards that people join with their own account (boards still use their
passwords for now). `POST /auth/email` mails a sign-in link and a six-digit code; `POST /auth/email/verify`
trades the link's token for an account token (`Authorization: Bearer <token>`, separate from board tokens),
and creates the account on its first sign-in. `POST /auth/email/code` does the same with the code, typed
where the sign-in began: the link signs in the browser it opens in, which on a phone is often another one
(and an app on the home screen has storage of its own). Either one spends both; a code allows 5 wrong
guesses and is kept as a keyed hash. `GET`/`PATCH /auth/me` read and rename the account; an account token
lasts a year, and `GET /auth/me` hands out a fresh one (`renewed`) once it is a day old, so a device in use
stays signed in. Links work once,
for 15 minutes, and only their SHA-256 hashes are stored; the reply never says whether an address has
an account, and requests are rate-limited per address and per network.

`POST /auth/me/email` moves an account to another address: it mails a link of the same kind to the new
address (409 if that address already has an account), and `POST /auth/me/email/verify` with its token
makes the change, signs that device in, and tells the old address. Leagues, roles and the player stay
with the account; a newer request replaces an older one.

It is all off (404, and `GET /auth/config` says `{"accounts": false}`) unless:

| Variable         | Meaning                                                                      |
|------------------|------------------------------------------------------------------------------|
| `ACCOUNTS`       | `on` to offer accounts                                                       |
| `APP_URL`        | where the app lives; the links in the e-mails point here, never at the request's origin |
| `SMTP_HOST`      | the mail server (`SMTP_PORT` 587 with STARTTLS by default, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM`) |
| `SMTP_RELAY`     | `host:port` to connect through when the API has no internet of its own (the live server's `fifa_web`); TLS is still checked against `SMTP_HOST` |
| `MAIL_LOG_LINKS` | `1` writes the links to the log instead of mailing them: development only, a logged link signs anyone in |

### Memberships

An account is in a board with a role: `owner` (one per board), `admin` or `player`, and once it says so,
as one of the board's players (a player belongs to at most one account). Creating a board while signed
in makes the account its owner; `POST /boards/{slug}/claim` with the board's admin password makes an
account the owner of a board that has none yet, a way for boards from before accounts to move over
(the app no longer offers it: on this server Main Board was given to its owner's account directly, and
its passwords removed, so people now come in with invites).
`POST /boards/{slug}/session` trades membership for an ordinary board token (owners and admins get the
admin role, players the member role), so the rest of the API is unchanged and a new admin password
signs those tokens out like any device. Such a token also names the account, and works only while the
account is in the board with that role: removing someone, or changing their role, ends it (401), and the
app opens the board again with whatever the account has now. `PUT /boards/{slug}/membership/player` links an owner or admin to
their player; `GET /auth/boards` lists the account's boards with its player's Elo, matches and rank, the
player it asked to be while that waits for an answer (`asked`), and for owners and admins how many join
requests wait for them (`pending`).

### Invites

Owners and admins invite people with two kinds of links, made with `POST /boards/{slug}/invites`:

- A **personal link** (`{"playerId": …}`) is for one player who has no account yet. Whoever opens it and
  signs in becomes that player's account, without approval, since the admin chose who it was for. It works
  once and for 7 days; asking again for the same player returns the link that is still open.
- The **group link** (`{}`) is one per board, for a group chat, until `POST …/invites/group/reset` replaces
  it. Whoever opens it joins as a player and says which player they are, or gives a name to start as a new
  one. That is a join request, because anyone with the link could pick anyone: an owner or admin sees it
  with the asker's e-mail and approves it (`POST …/requests/{id}/approve`, which links the player or
  creates it) or rejects it (they stay in the board without a player).

`GET /invites/{code}` previews a link without signing in (the board, and the player it is for or the
players still free to pick); `POST /invites/{code}/accept` joins with it. `GET /boards/{slug}/invites`
lists the group link and the players without an account, `GET /boards/{slug}/members` the members and the
requests. The owner makes admins and takes it back (`PATCH …/members/{user_id}`), hands the board over to
another member and stays on as an admin (`POST …/members/{user_id}/owner`), and removes anyone but
themselves; admins remove players (`DELETE …/members/{user_id}`). A removed member's player and matches
stay, without an account.

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

## Account photos

`PUT /auth/me/photo` takes one picture as the request body (JPEG, PNG or WebP, up to 5 MB; the app crops it
to a square first). It is turned upright, cut to its middle square if it isn't one, stripped of its
metadata and stored as a 512 px WebP in `PHOTO_DIR/avatars` under a random name, which changes with every
new photo; `DELETE /auth/me/photo` removes it. The account (`/auth/me`), the league's player list (`photo`
on each player linked to an account) and the members list carry that name, and `GET /avatars/{name}`
serves the file, cached for good. Only those given the name can fetch it: the account and the leagues its
player is in.

`GET /auth/boards` gives the account's player in each league its standing: Elo and rank, record, goals,
the last five results and its latest match night (the day it began, its record and the Elo won or lost).
A night runs past midnight: its day is the local date six hours earlier, as in the app.

## Match photos

`POST /boards/{slug}/matches/{id}/photos` takes one image as the request body (JPEG, PNG or WebP, up
to 12 MB, at most 10 per match; the app shrinks phone photos first). It is turned upright, stripped of
its metadata (camera, location) and stored twice as WebP in `PHOTO_DIR`: up to 2560 px on the long
side, so the stats stay readable for people and for OCR later, and a 480 px thumbnail.
`GET /boards/{slug}/photos/{id}?size=full|thumb` returns the image (it needs the board token like
everything else), `GET …/matches/{id}/photos` lists a match's photos and `DELETE /boards/{slug}/photos/{id}`
removes one; anyone on the board may add or remove photos, since they change no result. `GET /matches`
lists each match's photo IDs, and deleting a match deletes its photos.

## Match stats

`PUT /boards/{slug}/matches/{id}/stats` stores a match's numbers from the game's summary screen
("Özet": possession, shots, xG, passes, tackles, … and the three rates) by the app's sides `A` and `B`,
whichever side the game showed as home; any number may be missing (`SideStats` in `schemas.py`).
`source` is `manual` (typed in the app) or `ocr` (read from `photoId`, one of the match's photos), and
`DELETE` removes them. Anyone on the board may set them; `GET /matches` returns them as `stats`. The
photos are read on the server by Claude Code with `deploy/match-stats.py` (see `deploy/README.md`).

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
| `PHOTO_DIR`                   | `photos`          | folder for match photos (must be writable by the API)             |

A `.env` file next to `main.py` is read too.

## Develop and test

```bash
make install
make dev     # http://localhost:8080/docs
DATABASE_URL=postgresql://user:pass@localhost/fifa_test make test
```

The tests truncate tables and create a scratch database, so they refuse to run unless the database
name ends in `_test`.
