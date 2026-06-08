from __future__ import annotations

from unicodedata import combining, normalize

INNER_HANOI_WARDS = frozenset(
    {
        "Ba Dinh",
        "Bach Mai",
        "Bo De",
        "Cau Giay",
        "Chuong My",
        "Cua Nam",
        "Dai Mo",
        "Dinh Cong",
        "Dong Da",
        "Dong Ngac",
        "Duong Noi",
        "Giang Vo",
        "Ha Dong",
        "Hai Ba Trung",
        "Hoan Kiem",
        "Hoang Liet",
        "Hoang Mai",
        "Hong Ha",
        "Khuong Dinh",
        "Kien Hung",
        "Kim Lien",
        "Lang",
        "Linh Nam",
        "Long Bien",
        "Nghia Do",
        "Ngoc Ha",
        "O Cho Dua",
        "Phu Dien",
        "Phu Luong",
        "Phu Thuong",
        "Phuc Loi",
        "Phuong Liet",
        "Son Tay",
        "Tay Ho",
        "Tay Mo",
        "Tay Tuu",
        "Thanh Liet",
        "Thanh Xuan",
        "Thuong Cat",
        "Tu Liem",
        "Tung Thien",
        "Tuong Mai",
        "Van Mieu - Quoc Tu Giam",
        "Viet Hung",
        "Vinh Hung",
        "Vinh Tuy",
        "Xuan Dinh",
        "Xuan Phuong",
        "Yen Hoa",
        "Yen Nghia",
        "Yen So",
    }
)


def _fold(value: str) -> str:
    decomposed = normalize("NFD", value.strip())
    asciiish = "".join(char for char in decomposed if not combining(char))
    return asciiish.replace("Đ", "D").replace("đ", "d").casefold()


_NORMALIZED_WARDS = frozenset(_fold(ward) for ward in INNER_HANOI_WARDS)


def is_inner_hanoi(administrative_unit: str) -> bool:
    return _fold(administrative_unit) in _NORMALIZED_WARDS
