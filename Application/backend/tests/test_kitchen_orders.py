from app.infra.db.models import OrderStatus
from tests.admin_test_utils import admin_client
from tests.kitchen_test_utils import anon_client, kitchen_client, make_combo_order, make_order


def test_anonymous_gets_401():
    client = anon_client("kitchen-anon")
    assert client.get("/api/kitchen/orders").status_code == 401


def test_non_kitchen_role_gets_403():
    client = admin_client("kitchen-forbidden")
    assert client.get("/api/kitchen/orders").status_code == 403


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


def test_orders_oldest_first():
    client = kitchen_client("kitchen-order")
    make_order(status=OrderStatus.RECEIVED, code="PIZZ-OLD001", created_minutes_ago=40)
    make_order(status=OrderStatus.RECEIVED, code="PIZZ-NEW001", created_minutes_ago=2)
    codes = [t["order_code"] for t in client.get("/api/kitchen/orders").json()]
    assert codes.index("PIZZ-OLD001") < codes.index("PIZZ-NEW001")


def test_empty_queue_returns_empty_list():
    client = kitchen_client("kitchen-empty")
    res = client.get("/api/kitchen/orders")
    assert res.status_code == 200
    assert res.json() == []
