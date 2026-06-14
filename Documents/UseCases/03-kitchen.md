# Kitchen Operations Use Cases (K1–K4)

Actor: **Kitchen Staff** (authenticated session, role=`kitchen`). All kitchen
endpoints live under `/api/kitchen/` and require the kitchen role.

The queue ordering has a single source of truth — the SQL view `kitchen_queue_view`,
whose priority formula weighs order age, overdue time versus the promised time
(45 minutes from creation by default), and a bonus for orders already `Preparing`.
The kitchen UI polls every 3 seconds (no WebSocket).

Status badges per `feature_list.json` (2026-06-11).

---

## K1 — View Incoming Orders

**Status:** Planned · **Actors:** Kitchen Staff

**Brief description.** Kitchen staff watch the prioritized queue of orders to work
on: new (`Received`) and in-progress (`Preparing`) orders, ranked by the priority
score, with full preparation detail per order card.

**Preconditions.** Kitchen staff is authenticated. Orders exist in the queue.

**Basic flow of events.**

| Step | Performed by | Action |
|---|---|---|
| 1 | Kitchen Staff | Opens the kitchen dashboard. |
| 2 | System | Reads `kitchen_queue_view` and displays orders ranked by priority score (higher first), highlighting the top recommended order and any overdue orders. |
| 3 | System | Renders each order card: code, status, promised time, items with options, and per-dish notes (U16) under their dishes. The delivery note is **not** shown during prep. |
| 4 | System | Refreshes the queue by 3-second polling. |
| 5 | Kitchen Staff | Picks an order to process (K2). |

**Alternative flows.**

| No | Location | Condition | Action | Resume location |
|---|---|---|---|---|
| 1 | Step 2 | The queue is empty. | System shows an empty state and keeps polling. | Resumes at Step 4. |
| 2 | Step 4 | An order is cancelled by the admin (A5) while displayed. | On the next poll the order disappears from the queue. | Resumes at Step 4. |
| 3 | Step 4 | An order passes its promised time. | Its priority score rises sharply (overdue term) and the card is flagged overdue. | Resumes at Step 4. |

**Postconditions.** None (read-only).

---

## K2 — Update Preparation Status

**Status:** Planned · **Actors:** Kitchen Staff

**Brief description.** Kitchen staff accept a `Received` order to start preparation
(`Received → Preparing`) and update its preparation sub-stage as work progresses.
Status changes propagate to customer tracking (U7) and the admin monitor (A5).

**Preconditions.** Kitchen staff is authenticated. The target order is in the queue
with status `Received` (accept) or `Preparing` (sub-stage update).

**Basic flow of events.**

| Step | Performed by | Action |
|---|---|---|
| 1 | Kitchen Staff | Selects the top recommended order in the queue (K1). |
| 2 | System | Shows the full order detail: lines, options, quantities, dish notes. |
| 3 | Kitchen Staff | Accepts the order to start preparation. |
| 4 | System | Validates the transition and moves the order `Received → Preparing`, recording the timestamp. (See Table B) |
| 5 | Kitchen Staff | Updates the preparation sub-stage as work progresses. |
| 6 | System | Persists each update; customer tracking (U7) and the admin monitor (A5) reflect it on their next poll. |

**Alternative flows.**

| No | Location | Condition | Action | Resume location |
|---|---|---|---|---|
| 1 | Step 3 | Another staff member already accepted the order (race). | System rejects the second accept (invalid transition) and refreshes the queue. | Resumes at Step 1. |
| 2 | Step 3 | Staff selects a lower-priority order than the recommendation. | System asks for confirmation before accepting out of order. | If confirmed, resumes at Step 4; else Step 1. |
| 3 | Step 4 | The order was cancelled (A5) between display and accept. | System rejects the transition; the queue refresh removes the order. | Resumes at Step 1. |
| 4 | Step 5 | An ingredient for a customization is unavailable. | Staff flags the issue; the admin is notified via the monitor; preparation may continue. | Resumes at Step 5. |

**Input data (Table A).**

| No | Data field | Description | Mandatory | Valid condition | Example |
|---|---|---|---|---|---|
| 1 | Order selection | The order being accepted/updated. | Yes | Order in `Received` (accept) or `Preparing` (update). | PIZZ-7K3M9X |
| 2 | Sub-stage | The new preparation sub-stage. | Yes (on update) | Valid sub-stage value. | In oven |

**Output data (Table B).**

| No | Data field | Description | Display format | Example |
|---|---|---|---|---|
| 1 | Order status | New state after accept. | Status label | Preparing |
| 2 | Timestamps | Acceptance/update times on the timeline. | HH:MM DD/MM/YYYY | 18:05 11/06/2026 |

**Postconditions.** The order is `Preparing` with its sub-stage recorded; tracking
and monitoring views are consistent with the kitchen's reality.

---

## K3 — Mark Order Ready for Dispatch

**Status:** Planned · **Actors:** Kitchen Staff · **Includes:** T1

**Brief description.** When preparation finishes, kitchen staff mark the order ready.
The system atomically requests a courier from the delivery provider (T1): on success
the order becomes `ReadyForDispatch` with a delivery reference; on provider
timeout/failure it becomes `DispatchPending` for admin retry (A5).

**Preconditions.** Kitchen staff is authenticated; the order is `Preparing`.

**Basic flow of events.**

| Step | Performed by | Action |
|---|---|---|
| 1 | Kitchen Staff | Marks the prepared order as ready. |
| 2 | System | Shows the delivery note (U16) on the kitchen card now — at handoff time — so staff can pass it to the courier. |
| 3 | System | Calls the delivery provider through the delivery port (T1): pickup address, drop-off address, order summary. |
| 4 | System | On provider acceptance: stores the returned delivery reference and transitions `Preparing → ReadyForDispatch`. (See Table B) |
| 5 | System | Awaits the courier: pickup is confirmed either by the provider's scan (T2 `Accepted`/`PickedUp` webhook) or manually (K4), driving `ReadyForDispatch → Delivering`. |

**Alternative flows.**

| No | Location | Condition | Action | Resume location |
|---|---|---|---|---|
| 1 | Step 3 | Provider call times out or errors (`DeliveryError`). | System transitions `Preparing → DispatchPending` instead and raises the A5 alert for admin retry. | Use case ends (continues at A5 Step 4). |
| 2 | Step 1 | The order is not in `Preparing` (e.g. already ready or cancelled). | System rejects the invalid transition (409). | Resumes at K1. |
| 3 | Step 5 | No pickup confirmation arrives and the courier scan is unavailable. | Kitchen staff fall back to manual pickup confirmation (K4). | Continues at K4. |

**Input data (Table A).**

| No | Data field | Description | Mandatory | Valid condition | Example |
|---|---|---|---|---|---|
| 1 | Order selection | The order to mark ready. | Yes | Order in `Preparing`. | PIZZ-7K3M9X |

**Output data (Table B).**

| No | Data field | Description | Display format | Example |
|---|---|---|---|---|
| 1 | Order status | Result of the handoff. | Status label | ReadyForDispatch (or DispatchPending) |
| 2 | Delivery reference | Provider booking identifier. | Reference string | mock-abc123 |
| 3 | Delivery note | Courier instructions, revealed at handoff. | Text on the kitchen card | Leave at reception desk |

**Postconditions.** On success the order is `ReadyForDispatch` with a stored delivery
reference; on provider failure it is `DispatchPending` awaiting A5 retry. T1 and the
state change are atomic — no order ends up ready without an outcome recorded.

---

## K4 — Confirm Pickup (fallback) (v2)

**Status:** Planned · **Actors:** Kitchen Staff

**Brief description.** When the courier's pickup scan (T2) is unavailable — scanner
broken, provider app offline — kitchen staff manually confirm that the courier picked
the order up. This drives the same `ReadyForDispatch → Delivering` transition as the
T2 webhook, attributed to the kitchen actor. No new state is introduced.

**Preconditions.** Kitchen staff is authenticated; the order is `ReadyForDispatch`;
the courier is physically present and takes the order.

**Basic flow of events.**

| Step | Performed by | Action |
|---|---|---|
| 1 | Kitchen Staff | Hands the order to the courier; no scan confirmation arrives. |
| 2 | Kitchen Staff | Triggers manual pickup confirmation on the order card. |
| 3 | System | Asks for confirmation (the action substitutes for the provider's scan). |
| 4 | System | Transitions `ReadyForDispatch → Delivering`, recording the kitchen actor as the trigger. |
| 5 | System | Customer tracking (U7) and the admin monitor (A5) show `Delivering`. |

**Alternative flows.**

| No | Location | Condition | Action | Resume location |
|---|---|---|---|---|
| 1 | Step 4 | A T2 pickup webhook arrives concurrently (race with the scan). | The state machine accepts the first `ReadyForDispatch → Delivering` transition; the duplicate is idempotently ignored. | Use case ends. |
| 2 | Step 2 | The order is not `ReadyForDispatch`. | System rejects the invalid transition (409). | Use case ends. |
| 3 | Step 3 | Staff cancel the confirmation prompt. | No transition occurs. | Resumes at Step 1. |

**Postconditions.** The order is `Delivering`, attributed to the kitchen's manual
confirmation; subsequent T2 webhooks (`Delivered` / `Failed`) continue the normal
delivery lifecycle.
