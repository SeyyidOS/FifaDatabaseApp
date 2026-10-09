import logging
import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

import board_data
import boards
import migrations
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


app = FastAPI(title="FIFA Manager API", version="3.0.0", lifespan=lifespan)

# Tokens travel in the Authorization header (no cookies), so any origin may call the API; set
# CORS_ORIGINS (comma-separated) to restrict browsers to known frontends.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in os.getenv("CORS_ORIGINS", "*").split(",") if o.strip()],
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Content-Type", "Authorization", "X-Admin-Key"],
)


async def database_unavailable(request: Request, exc: Exception):
    log.error("database error on %s: %s", request.url.path, exc)
    return JSONResponse(status_code=503, content={"detail": "Database unavailable, try again shortly"})


for _error in CONNECTION_ERRORS:
    app.add_exception_handler(_error, database_unavailable)


@app.get("/health")
def health(request: Request):
    request.app.state.db.fetch_one("SELECT 1")
    return {"ok": True}


app.include_router(boards.router)
app.include_router(board_data.router)
app.include_router(seasons.router)
