import logging
import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

import accounts
import avatars
import board_data
import boards
import fixtures
import games
import invites
import live
import memberships
import migrations
import moderation
import photos
import seasons
from db import CONNECTION_ERRORS, Database

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
log = logging.getLogger("fifa.api")


@asynccontextmanager
async def lifespan(app: FastAPI):
    if not os.getenv("SECRET_KEY"):
        log.warning("SECRET_KEY is not set: devices will be signed out whenever the API restarts")
    app.state.db = Database.connect()
    migrations.migrate(app.state.db)
    yield
    app.state.db.close()


app = FastAPI(title="Matchnight API", version="3.0.0", lifespan=lifespan)

# Tokens travel in the Authorization header (no cookies), so any origin may call the API; set
# CORS_ORIGINS (comma-separated) to restrict browsers to known frontends. The site itself calls it on its
# own origin; the iPhone app (frontend/capacitor.config.ts) from capacitor://localhost.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in os.getenv("CORS_ORIGINS", "*").split(",") if o.strip()],
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Content-Type", "Authorization", "X-Admin-Key", "X-Edition"],
)


async def database_unavailable(request: Request, exc: Exception):
    log.error("database error on %s: %s", request.url.path, exc)
    return JSONResponse(status_code=503, content={"detail": "Database unavailable, try again shortly"})


for _error in CONNECTION_ERRORS:
    app.add_exception_handler(_error, database_unavailable)


@app.get("/health")
def health(request: Request):
    """Also says which commit is live (APP_VERSION, set by deploy/deploy.sh)."""
    request.app.state.db.fetch_one("SELECT 1")
    return {"ok": True, "version": os.getenv("APP_VERSION", "dev")}


@app.get("/config")
def config():
    """What the app shows that the server decides: where people write for help (SUPPORT_EMAIL; while it
    is unset, the app shows no contact line)."""
    return {"supportEmail": os.getenv("SUPPORT_EMAIL", "").strip() or None}


app.include_router(accounts.router)
app.include_router(memberships.router)
app.include_router(invites.router)
app.include_router(avatars.router)
app.include_router(boards.router)
app.include_router(board_data.router)
app.include_router(seasons.router)
app.include_router(fixtures.router)
app.include_router(games.router)
app.include_router(live.router)
app.include_router(photos.router)
app.include_router(moderation.router)
