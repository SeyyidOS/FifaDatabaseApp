"""Which edition a request is for: "classic" or "store".

classic is the app as the original group knows it: real club crests, club ratings from the game's cards,
the cards' squads and faces, the game's season names. store leaves out what isn't ours to publish, for
the App Store app and for a public site; the frontend's lib/edition.ts says what each shows.

The server runs EDITION from secrets.env (anything but "store" is classic). The store app asks for store on
every request (X-Edition: store). A request can make it store, never classic, so the store app never gets
classic content whatever the server runs.
"""

import os

from fastapi import HTTPException, Request


def server_edition() -> str:
    return "store" if os.getenv("EDITION", "").strip().lower() == "store" else "classic"


def request_edition(request: Request) -> str:
    if request.headers.get("x-edition", "").strip().lower() == "store":
        return "store"
    return server_edition()


def classic_only(request: Request) -> None:
    """A route dependency: in the store edition the content isn't there (404)."""
    if request_edition(request) != "classic":
        raise HTTPException(status_code=404, detail="Not in this edition")
