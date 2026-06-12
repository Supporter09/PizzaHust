"""PIZZ- order codes: 6 chars, Crockford base32 (no I/L/O/U)."""

from __future__ import annotations

import secrets

CROCKFORD_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"


def generate_order_code() -> str:
    return "PIZZ-" + "".join(secrets.choice(CROCKFORD_ALPHABET) for _ in range(6))