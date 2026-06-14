# External Delivery Integration Use Cases (T1–T2)

Actor: **Third-Party Delivery Service** (external, supporting). All integration goes
through the delivery port (`backend/app/infra/delivery/port.py`); the provider is
selected by `DELIVERY_PROVIDER` (MVP default: the `mock` provider, a separate
container that behaves like a real provider and signs callbacks).

Outbound calls (T1) authenticate with an API key and carry timeouts; inbound
callbacks (T2) are HMAC-signed webhooks. The system never trusts an unsigned callback.

Status badges per `feature_list.json` (2026-06-11).

---

## T1 — Request Delivery Service

**Status:** Planned · **Actors:** Third-Party Delivery (invoked by K3 / A5 retry)

**Brief description.** The system books a courier for a prepared order by calling the
delivery provider's API through the delivery port. Triggered atomically by the
kitchen marking an order ready (K3) or by an admin retry of a failed handoff (A5).

**Preconditions.** The order is `Preparing` (K3 path) or `DispatchPending` (A5 retry
path). Provider base URL, API key, and pickup address are configured.

**Basic flow of events.**

| Step | Performed by | Action |
|---|---|---|
| 1 | System | Builds the dispatch request: pickup address (store), drop-off address (recipient), order code, and order summary. (See Table A) |
| 2 | System | Calls the provider's booking API through the delivery port, with the configured timeout. |
| 3 | Delivery Service | Accepts the booking and returns a delivery reference. |
| 4 | System | Stores the reference on the order and transitions it (`Preparing → ReadyForDispatch`, or `DispatchPending → Delivering` on the retry path). (See Table B) |
| 5 | Delivery Service | Assigns a courier; subsequent lifecycle events arrive via T2. |

**Alternative flows.**

| No | Location | Condition | Action | Resume location |
|---|---|---|---|---|
| 1 | Step 2 | Provider unreachable or times out (`DeliveryError`). | K3 path: order → `DispatchPending`, A5 alert raised. Retry path: 502 `DELIVERY_UPSTREAM_ERROR`, order stays `DispatchPending` (retryable). | Use case ends (A5 owns recovery). |
| 2 | Step 3 | Provider rejects the booking (e.g. no couriers). | Same handling as flow 1 — the rejection is a failed handoff. | Use case ends. |

**Input data (Table A).**

| No | Data field | Description | Mandatory | Valid condition | Example |
|---|---|---|---|---|---|
| 1 | Pickup address | The store's address. | Yes | Configured (`DELIVERY_PICKUP_ADDRESS`). | PizzaHUST, 1 Dai Co Viet, Hanoi |
| 2 | Drop-off address | Recipient address from the order. | Yes | Inner-Hanoi address validated at U6. | 15 Tran Hung Dao, Cua Nam ward |
| 3 | Order summary | Code, recipient name/phone, COD total. | Yes | From the persisted order. | PIZZ-7K3M9X · 412,000 VND COD |

**Output data (Table B).**

| No | Data field | Description | Display format | Example |
|---|---|---|---|---|
| 1 | Delivery reference | Provider's booking identifier, stored on the order. | Reference string | mock-abc123 |
| 2 | Order status | Post-handoff state. | Status label | ReadyForDispatch |

**Postconditions.** On success the order holds a delivery reference and is in the
post-handoff state; on failure the order is `DispatchPending` and recovery belongs to
A5. Every outcome is recorded — the handoff is atomic with the state change.

---

## T2 — Synchronize Delivery Status

**Status:** Planned · **Actors:** Third-Party Delivery

**Brief description.** The delivery provider pushes courier lifecycle events to the
system via an HMAC-signed webhook (`POST /api/webhooks/delivery`). Verified events
drive the delivery-phase order transitions that customers see in tracking (U7.1).

**Preconditions.** The order has a delivery reference (T1 succeeded).
`DELIVERY_WEBHOOK_SECRET` is configured — an unset/empty secret fails closed,
rejecting every callback.

**Basic flow of events.**

| Step | Performed by | Action |
|---|---|---|
| 1 | Delivery Service | Sends a status callback: `{reference, state, event_id}` with an `X-Signature` header (`hmac-sha256` of the body). (See Table A) |
| 2 | System | Verifies the signature against `DELIVERY_WEBHOOK_SECRET`. |
| 3 | System | Checks idempotency: a duplicate `event_id` (or `reference:state` pair when `event_id` is absent) is silently ignored. |
| 4 | System | Resolves the order by delivery reference and maps the provider state to an order transition: `Accepted`/`PickedUp`/`Delivering` → `Delivering`; `Delivered` → `Delivered`; `Failed` → `DeliveryFailed`. |
| 5 | System | Applies the transition through the order state machine and records the timestamp. (See Table B) |
| 6 | System | Side effects fire: on `Delivered`, loyalty points accrue (1 pt / 10,000 VND of discounted subtotal) and any redeemed points are consumed; on `Failed`, reserved points are released. Tracking (U7) reflects the change on the next poll. |

**Alternative flows.**

| No | Location | Condition | Action | Resume location |
|---|---|---|---|---|
| 1 | Step 2 | Signature missing or invalid. | System rejects the callback (401); no state is touched. | Use case ends. |
| 2 | Step 3 | Duplicate event (retry/replay by the provider). | System acknowledges without re-applying — idempotent by design. | Use case ends. |
| 3 | Step 4 | Unknown delivery reference. | System rejects the callback; the event is logged for investigation. | Use case ends. |
| 4 | Step 5 | The mapped transition is invalid for the order's current state (e.g. `Delivered` for an order already terminal, or pickup already confirmed manually via K4). | The state machine rejects or idempotently ignores it; the order's state stands. | Use case ends. |

**Input data (Table A).**

| No | Data field | Description | Mandatory | Valid condition | Example |
|---|---|---|---|---|---|
| 1 | Reference | Delivery booking identifier from T1. | Yes | Matches an order's stored reference. | mock-abc123 |
| 2 | State | Provider lifecycle state. | Yes | `Accepted` / `PickedUp` / `Delivering` / `Delivered` / `Failed`. | Delivered |
| 3 | Event ID | Unique event identifier for idempotency. | No (falls back to `reference:state`) | Unique per event. | evt-9f2c1 |
| 4 | X-Signature | HMAC-SHA256 hex digest of the body. | Yes | Verifies with `DELIVERY_WEBHOOK_SECRET`. | 3f1a…e9 |

**Output data (Table B).**

| No | Data field | Description | Display format | Example |
|---|---|---|---|---|
| 1 | Order status | New order state after the mapped transition. | Status label | Delivered |
| 2 | Timeline entry | Timestamped status change visible in tracking (U7) and monitoring (A5). | Timeline row | Delivered 18:42 |

**Postconditions.** The order's state matches the courier's real progress; loyalty
side effects (accrual/consumption/release) are applied exactly once; duplicate or
forged callbacks have no effect.
