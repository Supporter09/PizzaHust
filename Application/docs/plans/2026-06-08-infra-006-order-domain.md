# infra-006 Order Domain Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add the order state machine, pricing, loyalty, and service-area domain modules, then route existing status mutations through the state machine.

**Architecture:** Domain modules remain pure and import no `app.api` or `app.infra` modules. API routes convert persisted `OrderStatus` values to strings, call the domain transition functions, then convert the returned status back to `OrderStatus` for storage and tracking rows.

**Tech Stack:** Python 3.12, pytest, FastAPI route tests, SQLAlchemy model persistence.

---

### Task 1: Order State Machine Domain

**Files:**
- Create: `Application/backend/app/domain/order_state.py`
- Test: `Application/backend/tests/domain/test_order_state.py`

**Step 1: Write failing tests**

Create tests for:
- `Received -> Preparing`
- `Preparing -> ReadyForDispatch`
- `Preparing -> DispatchPending`
- `DispatchPending -> Delivering`
- `Delivering -> Delivered`
- terminal states reject new transitions
- delivery states `Accepted`, `PickedUp`, `Delivering`, `Delivered`, `Failed` map to order statuses

**Step 2: Run red test**

Run: `cd Application/backend && .venv/bin/pytest tests/domain/test_order_state.py -q`
Expected: fail because `app.domain.order_state` does not exist.

**Step 3: Implement minimal module**

Add constants, `OrderTransitionError`, `transition(current, target)`, `is_terminal(status)`, and `status_for_delivery_event(state)`.

**Step 4: Run green test**

Run: `cd Application/backend && .venv/bin/pytest tests/domain/test_order_state.py -q`
Expected: pass.

### Task 2: Pricing, Loyalty, Service Area Domains

**Files:**
- Create: `Application/backend/app/domain/pricing.py`
- Create: `Application/backend/app/domain/loyalty.py`
- Create: `Application/backend/app/domain/service_area.py`
- Test: `Application/backend/tests/domain/test_pricing.py`
- Test: `Application/backend/tests/domain/test_loyalty.py`
- Test: `Application/backend/tests/domain/test_service_area.py`

**Step 1: Write failing tests**

Create tests for:
- delivery fee constant `22000`
- loyalty accrual `floor(subtotal_after_discount / 10000)`
- loyalty redemption value `1000`, capped at 50% of subtotal
- insufficient balance rejection
- quote total order: subtotal, combo discount, loyalty discount, delivery fee
- out-of-service district rejection

**Step 2: Run red tests**

Run: `cd Application/backend && .venv/bin/pytest tests/domain/test_pricing.py tests/domain/test_loyalty.py tests/domain/test_service_area.py -q`
Expected: fail because modules do not exist.

**Step 3: Implement minimal modules**

Add dataclasses and functions:
- `loyalty.compute_accrual_points`
- `loyalty.compute_redemption`
- `service_area.is_inner_hanoi`
- `pricing.compute_order_total`

**Step 4: Run green tests**

Run: `cd Application/backend && .venv/bin/pytest tests/domain/test_pricing.py tests/domain/test_loyalty.py tests/domain/test_service_area.py -q`
Expected: pass.

### Task 3: Reconcile Existing Route Status Writes

**Files:**
- Modify: `Application/backend/app/api/admin/orders.py`
- Modify: `Application/backend/app/api/webhooks.py`
- Test: `Application/backend/tests/test_admin_orders_dispatch.py`
- Test: `Application/backend/tests/test_delivery_webhook.py`

**Step 1: Write failing integration assertions**

Add route tests proving:
- canceling `Delivered`, `DeliveryFailed`, and `Cancelled` orders returns `409`
- webhook `Failed` from `ReadyForDispatch` returns no mutation because it is not a valid transition
- retry-dispatch still advances `DispatchPending -> Delivering`

**Step 2: Run red route tests**

Run: `cd Application/backend && .venv/bin/pytest tests/test_admin_orders_dispatch.py tests/test_delivery_webhook.py -q`
Expected: fail on the new illegal-transition behavior before route refactor.

**Step 3: Refactor routes**

Use `app.domain.order_state.transition()` and `status_for_delivery_event()` before assigning `order.current_status`.

**Step 4: Run green route tests**

Run: `cd Application/backend && .venv/bin/pytest tests/test_admin_orders_dispatch.py tests/test_delivery_webhook.py -q`
Expected: pass.

### Task 4: Full Backend and Project Verification

**Files:**
- Modify after green: `Application/feature_list.json`
- Modify after green: `Application/progress.md`
- Modify after green: `Application/session-handoff.md`

**Step 1: Run focused backend gates**

Run: `cd Application/backend && .venv/bin/ruff check app tests && .venv/bin/mypy && .venv/bin/pytest -q`
Expected: pass.

**Step 2: Run full verification**

Run: `cd Application && ./verify.sh`
Expected: exit 0.

**Step 3: Update tracking docs**

Record the commit hash and ISO timestamp in `feature_list.json`, append a concise `progress.md` block, and rewrite `session-handoff.md` to point to the next feature.

**Step 4: Commit and PR**

Commit with `feat(infra-006): add order domain rules`, push the branch, and open a PR to `main`.
