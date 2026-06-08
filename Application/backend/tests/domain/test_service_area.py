from __future__ import annotations

from app.domain.service_area import INNER_HANOI_WARDS, is_inner_hanoi


def test_inner_hanoi_whitelist_uses_2025_ward_units() -> None:
    assert len(INNER_HANOI_WARDS) == 51
    assert "Ba Dinh" in INNER_HANOI_WARDS
    assert "Hoan Kiem" in INNER_HANOI_WARDS
    assert "Dong Da" in INNER_HANOI_WARDS
    assert "Cua Nam" in INNER_HANOI_WARDS
    assert "Tung Thien" in INNER_HANOI_WARDS


def test_is_inner_hanoi_accepts_accents_and_case() -> None:
    assert is_inner_hanoi("Ba Đình")
    assert is_inner_hanoi("hoàn kiếm")
    assert is_inner_hanoi("DONG DA")
    assert is_inner_hanoi("Văn Miếu-Quốc Tử Giám")


def test_is_inner_hanoi_rejects_non_ward_or_unknown_units() -> None:
    assert not is_inner_hanoi("Gia Lam")
    assert not is_inner_hanoi("Thu Duc")
    assert not is_inner_hanoi("")
