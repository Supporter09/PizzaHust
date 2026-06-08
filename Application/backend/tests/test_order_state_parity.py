from __future__ import annotations

from app.domain.order_state import OrderState
from app.infra.db.models import OrderStatus


def test_domain_order_state_matches_persisted_order_status_values() -> None:
    assert {state.value for state in OrderState} == {status.value for status in OrderStatus}
