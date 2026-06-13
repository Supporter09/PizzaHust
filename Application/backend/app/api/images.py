"""A9 — shared image storage + gallery reconcile for product/combo galleries.

api-layer (imports FastAPI + ORM + the pure domain helper). Owns: blob save to
the StaticFiles upload dir, best-effort blob removal, ORM<->GalleryImage mapping,
and the generic reconcile that applies a domain result to the DB and rewrites the
owner's denormalized cover URL.
"""

from __future__ import annotations

import os
import uuid
from typing import Any

import structlog
from fastapi import UploadFile
from pydantic import BaseModel
from sqlalchemy import event
from sqlalchemy.orm import Session

from app.core.errors import APIError
from app.domain.gallery import NEW, GalleryImage
from app.infra.config import get_settings

ALLOWED_IMAGE_EXT = {"png", "jpg", "jpeg", "webp"}
ALLOWED_IMAGE_CONTENT_TYPES = {"image/png", "image/jpeg", "image/webp"}

_PENDING_BLOBS = "a9_blobs_to_remove"


def schedule_blob_removal(db: Session, urls: list[str | None]) -> None:
    db.info.setdefault(_PENDING_BLOBS, []).extend(u for u in urls if u)


@event.listens_for(Session, "after_commit")
def _flush_blob_removals(session: Session) -> None:
    for url in session.info.pop(_PENDING_BLOBS, []):
        remove_blob(url)


@event.listens_for(Session, "after_rollback")
def _drop_blob_removals(session: Session) -> None:
    session.info.pop(_PENDING_BLOBS, None)


class ImageOut(BaseModel):
    image_id: int
    url: str
    is_cover: bool


def save_blob(image: UploadFile) -> str:
    """Validate extension, content-type, and size; write the blob; return its URL."""
    settings = get_settings()
    ext = (image.filename or "").rsplit(".", 1)[-1].lower()
    if ext not in ALLOWED_IMAGE_EXT or image.content_type not in ALLOWED_IMAGE_CONTENT_TYPES:
        raise APIError(
            code="VALIDATION_FAILED",
            message="Unsupported image type. Allowed: png, jpg, jpeg, webp.",
            status_code=400,
        )
    data = image.file.read(settings.image_max_bytes + 1)
    if len(data) > settings.image_max_bytes:
        raise APIError(code="VALIDATION_FAILED", message="Image too large.", status_code=400)
    os.makedirs(settings.image_upload_dir, exist_ok=True)
    fname = f"{uuid.uuid4().hex}.{ext}"
    with open(os.path.join(settings.image_upload_dir, fname), "wb") as f:
        f.write(data)
    return f"{settings.image_base_url}/{fname}"


def remove_blob(url: str | None) -> None:
    """Best-effort removal of a stored blob. URL is server-generated (uuid hex in
    image_upload_dir); basename keeps the path inside the upload dir."""
    if not url:
        return
    fname = os.path.basename(url)
    if not fname:
        return
    try:
        os.remove(os.path.join(get_settings().image_upload_dir, fname))
    except FileNotFoundError:
        pass
    except OSError:
        structlog.get_logger().warning("image_blob_remove_failed", url=url)


def to_gallery(rows: list[Any]) -> list[GalleryImage]:
    """ORM image rows -> domain value objects, ordered by sort_order."""
    return [
        GalleryImage(image_id=r.image_id, url=r.url, sort_order=r.sort_order, is_cover=r.is_cover)
        for r in sorted(rows, key=lambda r: r.sort_order)
    ]


def image_outs(rows: list[Any]) -> list[ImageOut]:
    """ORM image rows -> DTO, cover first then sort_order."""
    ordered = sorted(rows, key=lambda r: (not r.is_cover, r.sort_order))
    return [ImageOut(image_id=r.image_id, url=r.url, is_cover=r.is_cover) for r in ordered]


def reconcile(
    db: Session,
    *,
    image_model: type,
    owner: Any,
    before: list[GalleryImage],
    after: list[GalleryImage],
) -> list[Any]:
    """Apply a domain (before -> after) result through the owner.images relationship:
    delete dropped rows, update changed rows, append NEW rows, rewrite the
    denormalized owner.image_url cover. Blob removals are *scheduled* (after-commit),
    never done inline. Returns the freshly-appended ORM rows (their image_id is
    populated after the caller flushes)."""
    after_by_id = {i.image_id: i for i in after if i.image_id != NEW}
    before_by_id = {i.image_id: i for i in before}

    for row in list(owner.images):
        if row.image_id not in after_by_id:
            schedule_blob_removal(db, [row.url])
            owner.images.remove(row)

    for row in owner.images:
        new = after_by_id.get(row.image_id)
        if new is None:
            continue
        old = before_by_id.get(row.image_id)
        if old is not None and old.url != new.url:
            schedule_blob_removal(db, [old.url])
        row.url = new.url
        row.sort_order = new.sort_order
        row.is_cover = new.is_cover

    inserted: list[Any] = []
    for new in after:
        if new.image_id != NEW:
            continue
        row = image_model(url=new.url, sort_order=new.sort_order, is_cover=new.is_cover)
        owner.images.append(row)
        inserted.append(row)

    owner.image_url = next((i.url for i in after if i.is_cover), None)
    return inserted
