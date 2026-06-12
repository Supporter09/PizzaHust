from __future__ import annotations

import re

from app.domain.order_code import CROCKFORD_ALPHABET, generate_order_code


def test_format():
    code = generate_order_code()
    assert re.fullmatch(r"PIZZ-[0-9A-HJKMNP-TV-Z]{6}", code)


def test_alphabet_excludes_ilou():
    assert not set("ILOU") & set(CROCKFORD_ALPHABET)
    assert len(CROCKFORD_ALPHABET) == 32


def test_codes_vary():
    assert len({generate_order_code() for _ in range(50)}) > 1
