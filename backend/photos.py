"""Photos of a match, such as the game's stats screens after full time.

Each upload is checked and re-encoded as WebP twice: a large copy whose small print stays readable (and
can be read by OCR later) and a small one for lists. Re-encoding drops the camera's metadata, such as
where the photo was taken. The files live in PHOTO_DIR, outside the database, so its backups stay small;
the database keeps which match a photo belongs to.
"""

import io
import logging
import os
import secrets
from pathlib import Path
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import FileResponse
from PIL import Image, ImageOps, UnidentifiedImageError
from starlette.concurrency import run_in_threadpool

from auth import BoardAccess, board_access

router = APIRouter(prefix="/boards/{slug}", tags=["photos"])
log = logging.getLogger("fifa.photos")

# The site's proxies let bodies this large through on the upload route only (deploy/Caddyfile.fifa and
# frontend/nginx); the app shrinks photos before sending them, so this is only reached by originals.
MAX_UPLOAD = 12 * 1024 * 1024
MAX_PHOTOS = 10  # per match
FULL_EDGE = 2560  # longest side of the large copy
THUMB_EDGE = 480
# Decoded images are held in memory (the API may use 384 MB): a JPEG is decoded at a reduced scale when
# it is far larger than FULL_EDGE, and anything still above this is refused.
MAX_PIXELS = 16_000_000


def photo_dir() -> Path:
    return Path(os.getenv("PHOTO_DIR", "photos"))


def _paths(file: str) -> tuple[Path, Path]:
    return photo_dir() / f"{file}.webp", photo_dir() / f"{file}.thumb.webp"


def remove_files(files: list[str]) -> None:
    for file in files:
        for path in _paths(file):
            path.unlink(missing_ok=True)


def _db(request: Request):
    return request.app.state.db


def _webp(image: Image.Image, quality: int) -> bytes:
    out = io.BytesIO()
    image.save(out, "WEBP", quality=quality, method=4)
    return out.getvalue()


def _encode(raw: bytes) -> tuple[bytes, bytes, int, int]:
    """The large and small WebP copies, and the large one's size."""
    try:
        with Image.open(io.BytesIO(raw)) as source:
            if source.format not in ("JPEG", "PNG", "WEBP"):
                raise ValueError(source.format)
            source.draft("RGB", (FULL_EDGE, FULL_EDGE))
            if source.width * source.height > MAX_PIXELS:
                raise HTTPException(status_code=413, detail="The photo has too many pixels")
            image = ImageOps.exif_transpose(source)  # upright, as the camera held it
    except (UnidentifiedImageError, Image.DecompressionBombError, OSError, ValueError, SyntaxError) as exc:
        raise HTTPException(status_code=415, detail="Send a JPEG, PNG or WebP photo") from exc
    if image.mode != "RGB":
        image = image.convert("RGB")
    image.thumbnail((FULL_EDGE, FULL_EDGE), Image.Resampling.LANCZOS)
    full = _webp(image, 88)
    width, height = image.size
    image.thumbnail((THUMB_EDGE, THUMB_EDGE), Image.Resampling.LANCZOS)
    return full, _webp(image, 75), width, height


def _match_exists(request: Request, board_id: int, match_id: int) -> bool:
    row = _db(request).fetch_one("SELECT 1 FROM matches WHERE id = %s AND board_id = %s", (match_id, board_id))
    return row is not None


def _store(request: Request, board_id: int, match_id: int, raw: bytes) -> dict:
    if not _match_exists(request, board_id, match_id):
        raise HTTPException(status_code=404, detail=f"No match with ID {match_id}")
    full, thumb, width, height = _encode(raw)
    file = secrets.token_hex(16)
    full_path, thumb_path = _paths(file)
    photo_dir().mkdir(parents=True, exist_ok=True)
    try:
        full_path.write_bytes(full)
        thumb_path.write_bytes(thumb)
        with _db(request).transaction() as cur:
            # lock the match so two uploads at once can't pass the limit together
            cur.execute("SELECT id FROM matches WHERE id = %s AND board_id = %s FOR UPDATE", (match_id, board_id))
            if cur.fetchone() is None:
                raise HTTPException(status_code=404, detail=f"No match with ID {match_id}")
            cur.execute("SELECT COUNT(*) AS n FROM match_photos WHERE match_id = %s", (match_id,))
            if cur.fetchone()["n"] >= MAX_PHOTOS:
                raise HTTPException(status_code=409, detail=f"A match holds at most {MAX_PHOTOS} photos")
            cur.execute(
                """
                INSERT INTO match_photos (match_id, file, width, height) VALUES (%s, %s, %s, %s)
                RETURNING id, match_id AS "matchId", width, height, created_at AS "createdAt"
                """,
                (match_id, file, width, height),
            )
            return cur.fetchone()
    except BaseException:
        remove_files([file])
        raise


@router.post("/matches/{match_id}/photos", status_code=201)
async def add_photo(match_id: int, request: Request, access: BoardAccess = Depends(board_access)):
    """The request body is the image itself (JPEG, PNG or WebP)."""
    chunks, size = [], 0
    async for chunk in request.stream():
        size += len(chunk)
        if size > MAX_UPLOAD:
            raise HTTPException(status_code=413, detail="The photo is too large")
        chunks.append(chunk)
    if not size:
        raise HTTPException(status_code=422, detail="No photo was sent")
    return await run_in_threadpool(_store, request, access.id, match_id, b"".join(chunks))


@router.get("/matches/{match_id}/photos")
def list_photos(match_id: int, request: Request, access: BoardAccess = Depends(board_access)):
    if not _match_exists(request, access.id, match_id):
        raise HTTPException(status_code=404, detail=f"No match with ID {match_id}")
    return _db(request).fetch_all(
        """
        SELECT id, match_id AS "matchId", width, height, created_at AS "createdAt"
        FROM match_photos WHERE match_id = %s ORDER BY id
        """,
        (match_id,),
    )


@router.get("/photos/{photo_id}")
def get_photo(
    photo_id: int,
    request: Request,
    size: Literal["full", "thumb"] = "full",
    access: BoardAccess = Depends(board_access),
):
    row = _db(request).fetch_one(
        "SELECT ph.file FROM match_photos ph JOIN matches m ON m.id = ph.match_id WHERE ph.id = %s AND m.board_id = %s",
        (photo_id, access.id),
    )
    path = _paths(row["file"])[0 if size == "full" else 1] if row else None
    if path is None or not path.is_file():
        raise HTTPException(status_code=404, detail=f"No photo with ID {photo_id}")
    # a photo never changes under its ID
    cache = {"Cache-Control": "private, max-age=31536000, immutable"}
    return FileResponse(path, media_type="image/webp", headers=cache)


@router.delete("/photos/{photo_id}")
def delete_photo(photo_id: int, request: Request, access: BoardAccess = Depends(board_access)):
    """Anyone signed in may remove a photo (a wrong shot is common); it changes no result."""
    row = _db(request).write_one(
        """
        DELETE FROM match_photos ph USING matches m
        WHERE ph.id = %s AND m.id = ph.match_id AND m.board_id = %s RETURNING ph.file
        """,
        (photo_id, access.id),
    )
    if row is None:
        raise HTTPException(status_code=404, detail=f"No photo with ID {photo_id}")
    remove_files([row["file"]])
    return {"message": f"Photo {photo_id} deleted."}
