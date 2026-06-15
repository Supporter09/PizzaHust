from datetime import datetime, timedelta

from app.infra.db.models import Order, OrderStatus, TrackingNoteSource, UserRole
from tests.admin_test_utils import admin_client
from tests.kitchen_test_utils import (
    anon_client,
    kitchen_client,
    logged_in_client,
    make_combo_order,
    make_order,
)


def test_anonymous_gets_401():
    client = anon_client("kitchen-anon")
    assert client.get("/api/kitchen/orders").status_code == 401


def test_customer_role_gets_403():
    client = logged_in_client("kitchen-forbidden", UserRole.CUSTOMER)
    assert client.get("/api/kitchen/orders").status_code == 403


def test_admin_role_allowed():
    # Admins share kitchen access for operational oversight.
    client = admin_client("kitchen-admin-ok")
    assert client.get("/api/kitchen/orders").status_code == 200


def test_lists_only_incoming_states():
    client = kitchen_client("kitchen-membership")
    make_order(status=OrderStatus.RECEIVED, code="PIZZ-RCV001")
    make_order(status=OrderStatus.PREPARING, code="PIZZ-PRP001")
    make_order(status=OrderStatus.READY_FOR_DISPATCH, code="PIZZ-RDY001")
    make_order(status=OrderStatus.DELIVERED, code="PIZZ-DLV001")
    make_order(status=OrderStatus.CANCELLED, code="PIZZ-CNL001")
    codes = {t["order_code"] for t in client.get("/api/kitchen/orders").json()}
    assert codes == {"PIZZ-RCV001", "PIZZ-PRP001", "PIZZ-RDY001"}


def test_ticket_has_item_lines_options_and_note():
    client = kitchen_client("kitchen-items")
    make_order(
        status=OrderStatus.RECEIVED,
        code="PIZZ-ITM001",
        product_name="Meat Lovers",
        note="Extra crispy",
        options=[("Size", "Large"), ("Crust", "Stuffed")],
    )
    item = client.get("/api/kitchen/orders").json()[0]["items"][0]
    assert item["display_name"] == "Meat Lovers"
    assert item["quantity"] == 2
    assert item["note"] == "Extra crispy"
    assert {(o["group_name"], o["option_name"]) for o in item["options"]} == {
        ("Size", "Large"),
        ("Crust", "Stuffed"),
    }
    assert item["children"] == []


def test_combo_renders_grouped_children():
    client = kitchen_client("kitchen-combo")
    make_combo_order(
        status=OrderStatus.RECEIVED, combo_name="Family Combo", child_names=("Pepperoni", "Coke")
    )
    top = client.get("/api/kitchen/orders").json()[0]["items"]
    assert len(top) == 1
    assert top[0]["display_name"] == "Family Combo"
    assert {c["display_name"] for c in top[0]["children"]} == {"Pepperoni", "Coke"}


def test_delivery_note_surfaces():
    client = kitchen_client("kitchen-dnote")
    make_order(
        status=OrderStatus.READY_FOR_DISPATCH,
        code="PIZZ-DN0001",
        delivery_note="Ring doorbell twice",
    )
    assert client.get("/api/kitchen/orders").json()[0]["delivery_note"] == "Ring doorbell twice"


def test_orders_are_prioritized_by_status_and_due_time():
    client = kitchen_client("kitchen-order")
    make_order(
        status=OrderStatus.RECEIVED,
        code="PIZZ-FAR001",
        created_minutes_ago=5,
        promised_minutes_from_now=120,
    )
    make_order(
        status=OrderStatus.RECEIVED,
        code="PIZZ-NEAR001",
        created_minutes_ago=5,
        promised_minutes_from_now=10,
    )
    make_order(status=OrderStatus.PREPARING, code="PIZZ-PREP001", created_minutes_ago=20)
    codes = [t["order_code"] for t in client.get("/api/kitchen/orders").json()]
    assert codes.index("PIZZ-PREP001") < codes.index("PIZZ-NEAR001")
    assert codes.index("PIZZ-NEAR001") < codes.index("PIZZ-FAR001")


def test_stale_orders_are_auto_cancelled_and_removed_from_queue():
    client = kitchen_client("kitchen-stale")
    stale_id = make_order(
        status=OrderStatus.RECEIVED,
        code="PIZZ-OLDSTALE",
        created_minutes_ago=24 * 60 + 5,
    )
    fresh_id = make_order(
        status=OrderStatus.RECEIVED,
        code="PIZZ-KEEP001",
        created_minutes_ago=10,
    )

    payload = client.get("/api/kitchen/orders").json()
    codes = [t["order_code"] for t in payload]

    assert "PIZZ-OLDSTALE" not in codes
    assert "PIZZ-KEEP001" in codes

    from app.infra.db.session import create_session_factory

    with create_session_factory()() as db:
        stale = db.get(Order, stale_id)
        assert stale is not None
        assert stale.current_status == OrderStatus.CANCELLED
        assert stale.tracking[-1].note_source == TrackingNoteSource.SYSTEM
        assert stale.tracking[-1].note == "Auto-cancelled after 24 hours without kitchen action"
        fresh = db.get(Order, fresh_id)
        assert fresh is not None
        assert fresh.current_status == OrderStatus.RECEIVED


def test_queue_exposes_kitchen_notes_for_active_orders():
    client = kitchen_client("kitchen-note-queue")
    order_id = make_order(status=OrderStatus.PREPARING, code="PIZZ-NOTEQ")
    client.post(f"/api/kitchen/orders/{order_id}/notes", json={"note": "Need extra sauce"})

    ticket = client.get("/api/kitchen/orders").json()[0]
    notes = [event["note"] for event in ticket["tracking"]]
    assert "Need extra sauce" in notes


def test_empty_queue_returns_empty_list():
    client = kitchen_client("kitchen-empty")
    res = client.get("/api/kitchen/orders")
    assert res.status_code == 200
    assert res.json() == []


def test_queue_timestamps_are_utc_aware():
    """Regression (GMT vs GMT+7): the queue must emit UTC-aware timestamps.

    Timestamps are stored naive UTC; serialized without an offset, JS `new Date()`
    reads them as browser-local and skews the kitchen 'placed X min ago' / step
    times by the local offset. Every timestamp the client parses must carry an
    explicit UTC offset so the instant is unambiguous.
    """
    client = kitchen_client("kitchen-tz")
    order_id = make_order(status=OrderStatus.PREPARING, code="PIZZ-TZ0001")
    client.post(f"/api/kitchen/orders/{order_id}/notes", json={"note": "prep started"})

    ticket = client.get("/api/kitchen/orders").json()[0]
    stamps = [ticket["created_at"], ticket["promised_at"]]
    stamps += [event["created_at"] for event in ticket["tracking"]]
    assert len(stamps) >= 3  # both ticket stamps + at least the note event

    for stamp in stamps:
        parsed = datetime.fromisoformat(stamp)
        assert parsed.tzinfo is not None and parsed.utcoffset() == timedelta(0), (
            f"timestamp must be UTC-aware, got {stamp!r}"
        )
