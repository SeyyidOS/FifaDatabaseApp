# Screenshots

6.9″ iPhone, portrait, 1320×2868 (App Store Connect scales them down for smaller iPhones), RGB PNG, in
Turkish (`tr/`) and English (`en/`):

1. Home: the last match night and the power rankings
2. My profile: the player card
3. Match center: teams and clubs drawn, the odds
4. League table
5. Night Post
6. An invite, before signing in

They are the **store** edition (shirts instead of crests, no game data, season "2026–27") at the size
phones start at (81.25%, `frontend/src/hooks/useUiScale.ts`), with made-up players and matches. No real data was used: `deploy/review-league.py` seeded a scratch API.
The small print at the foot of 2 and 6 is the store edition's "not affiliated with EA SPORTS, FIFA or
any club" note.

To make them again:

1. A scratch stack, as in the scratch recipe, with the database named `fifa_db` and the API given
   `REVIEW_EMAIL=demo@example.com REVIEW_CODE=314159` and published on `127.0.0.1:18080`.
2. Seed it:

        FIFA_API_URL=http://127.0.0.1:18080 FIFA_DB_CONTAINER=mn-scratch-db REVIEW_EMAIL=demo@example.com REVIEW_CODE=314159 FIFA_BASE=/nonexistent python3 deploy/review-league.py

3. Build the app against it and serve the bundle on the scratch network as `mn-scratch-app:8080`:

        cd frontend && VITE_API_URL=http://mn-scratch-api:8080 npm run build:app

4. Run `capture.mjs` in `mcr.microsoft.com/playwright:v1.57.0-noble` on that network (WebKit, 440×956 at
   3×). It checks every screen for crests, "FC27", "fut.gg" and "FIFA", and reloads a screen when
   headless WebKit leaves an entrance animation invisible on screen. The demo account agrees to the terms
   first, as App Review will, and the invite is Jordan's (Sam has an account, for Block). The
   independence note is left out of the check: it names EA SPORTS and FIFA on purpose.
