# tests/test_gallery.py
from __future__ import annotations

import pytest

from app.domain.gallery import (
    MAX_IMAGES,
    NEW,
    GalleryError,
    GalleryImage,
    add,
    cover_url,
    remove,
    replace_cover,
    set_cover,
)


def _img(image_id: int, url: str, order: int, cover: bool) -> GalleryImage:
    return GalleryImage(image_id=image_id, url=url, sort_order=order, is_cover=cover)


def test_add_to_empty_makes_cover():
    after, cover = add([], "a.png")
    assert len(after) == 1
    assert after[0].image_id == NEW
    assert after[0].sort_order == 0
    assert after[0].is_cover is True
    assert cover == "a.png"


def test_add_to_nonempty_appends_not_cover_with_next_sort_order():
    before = [_img(1, "a.png", 0, True)]
    after, cover = add(before, "b.png")
    new = after[-1]
    assert new.image_id == NEW
    assert new.sort_order == 1
    assert new.is_cover is False
    assert cover == "a.png"


def test_add_beyond_eight_raises():
    before = [_img(i, f"{i}.png", i, i == 0) for i in range(MAX_IMAGES)]
    with pytest.raises(GalleryError):
        add(before, "overflow.png")


def test_remove_cover_promotes_lowest_sort_order_survivor():
    before = [_img(1, "a.png", 0, True), _img(2, "b.png", 1, False), _img(3, "c.png", 2, False)]
    after, cover = remove(before, 1)
    assert [i.image_id for i in after] == [2, 3]
    assert cover == "b.png"
    assert sum(i.is_cover for i in after) == 1
    assert next(i for i in after if i.image_id == 2).is_cover is True


def test_remove_noncover_keeps_cover():
    before = [_img(1, "a.png", 0, True), _img(2, "b.png", 1, False)]
    after, cover = remove(before, 2)
    assert cover == "a.png"
    assert next(i for i in after if i.image_id == 1).is_cover is True


def test_remove_last_leaves_no_cover():
    after, cover = remove([_img(1, "a.png", 0, True)], 1)
    assert after == []
    assert cover is None


def test_set_cover_is_exclusive():
    before = [_img(1, "a.png", 0, True), _img(2, "b.png", 1, False)]
    after, cover = set_cover(before, 2)
    assert cover == "b.png"
    assert [i.is_cover for i in sorted(after, key=lambda i: i.image_id)] == [False, True]


def test_set_cover_unknown_id_raises():
    with pytest.raises(GalleryError):
        set_cover([_img(1, "a.png", 0, True)], 99)


def test_replace_cover_rewrites_in_place_without_growing():
    before = [_img(1, "a.png", 0, True), _img(2, "b.png", 1, False)]
    after, cover = replace_cover(before, "new.png")
    assert len(after) == 2
    assert cover == "new.png"
    assert next(i for i in after if i.image_id == 1).url == "new.png"
    assert next(i for i in after if i.image_id == 2).url == "b.png"


def test_replace_cover_on_empty_inserts_cover():
    after, cover = replace_cover([], "first.png")
    assert len(after) == 1
    assert after[0].image_id == NEW
    assert after[0].is_cover is True
    assert cover == "first.png"


def test_cover_url_helper():
    assert cover_url([_img(1, "a.png", 0, False), _img(2, "b.png", 1, True)]) == "b.png"
    assert cover_url([]) is None
