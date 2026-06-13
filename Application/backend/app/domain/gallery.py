"""A9 — pure gallery invariants for product/combo image sets.

No IO, no ORM, no FastAPI: operates on lists of GalleryImage value objects and
returns the resulting list plus the cover URL. The single-cover and <=8 rules
are not DB-enforced (MySQL has no partial unique index), so every mutation must
route through these functions. image_id == NEW marks a not-yet-persisted image.
"""

from __future__ import annotations

from dataclasses import dataclass, replace

MAX_IMAGES = 8
NEW = 0  # sentinel image_id for an image the helper added but the DB hasn't


class GalleryError(ValueError):
    """A gallery rule was violated (capacity, unknown id)."""


@dataclass(frozen=True)
class GalleryImage:
    image_id: int
    url: str
    sort_order: int
    is_cover: bool


def cover_url(images: list[GalleryImage]) -> str | None:
    for image in images:
        if image.is_cover:
            return image.url
    return None


def add(images: list[GalleryImage], url: str) -> tuple[list[GalleryImage], str | None]:
    if len(images) >= MAX_IMAGES:
        raise GalleryError(f"Gallery already holds the maximum of {MAX_IMAGES} images.")
    next_order = max((i.sort_order for i in images), default=-1) + 1
    new = GalleryImage(image_id=NEW, url=url, sort_order=next_order, is_cover=len(images) == 0)
    result = [*images, new]
    return result, cover_url(result)


def remove(images: list[GalleryImage], image_id: int) -> tuple[list[GalleryImage], str | None]:
    removed = next((i for i in images if i.image_id == image_id), None)
    survivors = [i for i in images if i.image_id != image_id]
    if removed is not None and removed.is_cover and survivors:
        promoted = sorted(survivors, key=lambda i: i.sort_order)[0].image_id
        survivors = [replace(i, is_cover=(i.image_id == promoted)) for i in survivors]
    return survivors, cover_url(survivors)


def set_cover(images: list[GalleryImage], image_id: int) -> tuple[list[GalleryImage], str | None]:
    if not any(i.image_id == image_id for i in images):
        raise GalleryError("Image is not part of this gallery.")
    result = [replace(i, is_cover=(i.image_id == image_id)) for i in images]
    return result, cover_url(result)


def replace_cover(images: list[GalleryImage], url: str) -> tuple[list[GalleryImage], str | None]:
    if not images:
        return add(images, url)
    cover = next((i for i in images if i.is_cover), None)
    if cover is None:  # defensive: no cover set -> treat lowest sort_order as cover
        cover = sorted(images, key=lambda i: i.sort_order)[0]
    result = [replace(i, url=url) if i.image_id == cover.image_id else i for i in images]
    return result, url
