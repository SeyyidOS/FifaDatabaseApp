"""Account photos: one square picture per account, shown wherever its player appears.

The app crops and shrinks a photo before sending it; here it is checked and re-encoded as a WebP of
EDGE pixels, which also drops the camera's metadata. The files live in PHOTO_DIR/avatars, outside the
database like match photos, under a random name that changes with every upload: they can be cached for
good, and only those given the name (the account, and the leagues its player plays in) can fetch them.
"""

import io
import re
import secrets
from pathlib import Path

from fastapi import APIRouter, Header, HTTPException, Request
from fastapi.responses import FileResponse
from PIL import Image, ImageOps, UnidentifiedImageError
from starlette.concurrency import run_in_threadpool

from accounts import _public, current_user
from photos import MAX_PIXELS, photo_dir

router = APIRouter(tags=["avatars"])

EDGE = 512
MAX_UPLOAD = 5 * 1024 * 1024
NAME = re.compile(r"^[A-Za-z0-9_-]{16,40}$")


def _path(name: str) -> Path:
    return photo_dir() / "avatars" / f"{name}.webp"


def _encode(raw: bytes) -> bytes:
    try:
        with Image.open(io.BytesIO(raw)) as source:
            if source.format not in ("JPEG", "PNG", "WEBP"):
                raise ValueError(source.format)
            source.draft("RGB", (EDGE * 2, EDGE * 2))
            if source.width * source.height > MAX_PIXELS:
                raise HTTPException(status_code=413, detail="The photo has too many pixels")
            image = ImageOps.exif_transpose(source)
    except (UnidentifiedImageError, Image.DecompressionBombError, OSError, ValueError, SyntaxError) as exc:
        raise HTTPException(status_code=415, detail="Send a JPEG, PNG or WebP photo") from exc
    if image.mode != "RGB":
        image = image.convert("RGB")
    # the middle square, if the app didn't crop it already
    image = ImageOps.fit(image, (EDGE, EDGE), Image.Resampling.LANCZOS)
    out = io.BytesIO()
    image.save(out, "WEBP", quality=85, method=4)
    return out.getvalue()


def _remove(name: str | None) -> None:
    if name:
        _path(name).unlink(missing_ok=True)


@router.put("/auth/me/photo")
async def set_photo(request: Request, authorization: str | None = Header(default=None)):
    """The request body is the picture itself (JPEG, PNG or WebP), best already square."""
    user = current_user(request, authorization)
    chunks, size = [], 0
    async for chunk in request.stream():
        size += len(chunk)
        if size > MAX_UPLOAD:
            raise HTTPException(status_code=413, detail="The photo is too large")
        chunks.append(chunk)
    if not size:
        raise HTTPException(status_code=422, detail="No photo was sent")
    data = await run_in_threadpool(_encode, b"".join(chunks))
    name = secrets.token_urlsafe(18)
    path = _path(name)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    updated = request.app.state.db.write_one(
        "UPDATE users SET photo = %s WHERE id = %s RETURNING *", (name, user["id"])
    )
    _remove(user["photo"])
    return _public(updated)


@router.delete("/auth/me/photo")
def remove_photo(request: Request, authorization: str | None = Header(default=None)):
    user = current_user(request, authorization)
    updated = request.app.state.db.write_one("UPDATE users SET photo = NULL WHERE id = %s RETURNING *", (user["id"],))
    _remove(user["photo"])
    return _public(updated)


@router.get("/avatars/{name}")
def get_avatar(name: str):
    path = _path(name) if NAME.match(name) else None
    if path is None or not path.is_file():
        raise HTTPException(status_code=404, detail="No such photo")
    # a new photo gets a new name, so this one never changes
    return FileResponse(path, media_type="image/webp", headers={"Cache-Control": "public, max-age=31536000, immutable"})
