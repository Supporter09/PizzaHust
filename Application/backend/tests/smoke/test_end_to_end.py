"""End-to-end smoke against the running compose stack.

Asserts the canonical happy path: place COD order → kitchen accepts → kitchen
marks ready (triggers T1) → delivery-mock fires T2 webhook → tracking endpoint
reports Delivered.

Currently a placeholder until infra-002 through infra-005 land. Skipped so
verify.sh stays green on the empty skeleton.
"""

from __future__ import annotations

import pytest


@pytest.mark.skip(reason="enable once infra-002..infra-005 land")
def test_place_cod_order_through_to_delivered() -> None:
    raise NotImplementedError
