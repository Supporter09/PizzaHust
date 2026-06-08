"""End-to-end smoke against the running compose stack.

Asserts the canonical happy path: place COD order → kitchen accepts → kitchen
marks ready (triggers T1) → delivery-mock fires T2 webhook → tracking endpoint
reports Delivered.

Infra is now in place (delivery port + mock landed in infra-005). The full path
still needs the use-case endpoints that don't exist yet: order placement (U6),
kitchen accept/ready (K1–K3), and the tracking endpoint. Skipped until those land.
"""

from __future__ import annotations

import pytest


@pytest.mark.skip(reason="needs U6 order placement + kitchen (K1-K3) + tracking endpoint")
def test_place_cod_order_through_to_delivered() -> None:
    raise NotImplementedError
