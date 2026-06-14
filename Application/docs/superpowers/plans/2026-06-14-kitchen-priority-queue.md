# Kitchen Priority Queue Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the kitchen queue deterministic and demo-friendly: waiting orders are ranked by a simple priority score, accepted orders keep a stable position, stale orders are auto-cancelled, and kitchen staff can still see and add note context without affecting ordering.

**Architecture:** Keep ordering logic in the backend queue source so the kitchen UI stays dumb and stable. Add a small backend helper for stale-order cancellation and queue scoring, then reuse the existing kitchen ticket rendering with only minimal UI changes for note visibility. Preserve the current order status model and the admin timeline as the audit trail.

**Tech Stack:** FastAPI, SQLAlchemy, MySQL view/query, Pydantic, pytest, Next.js App Router, TypeScript, Vitest.

---

## Chunk 1: Backend Queue Ordering and Auto-Cancel

### Task 1: Add a deterministic priority score for kitchen queue rows

**Files:**
- Modify: `backend/app/infra/db/migrations/versions/0012_kitchen_queue_ready_for_dispatch.py`
- Modify: `backend/app/api/kitchen/orders.py`
- Test: `backend/tests/test_kitchen_queue.py` or a new focused kitchen queue test module

- [ ] **Step 1: Write the failing tests**

Create tests that prove:
- two `Received` orders with different `created_at` / `promised_at` values are returned in the expected order
- a `Preparing` order stays behind/above other `Preparing` orders according to a stable rule and does not get re-ranked by a changing urgency bonus
- the queue remains ordered by backend result, not by frontend code

- [ ] **Step 2: Run the tests and confirm the current behavior is insufficient**

Run:

```bash
cd Application/backend && ./.venv/bin/pytest tests/test_kitchen_queue.py -q
```

Expected: at least one ordering assertion fails until the score logic is updated.

- [ ] **Step 3: Implement the minimal backend scoring change**

Update the kitchen queue source so:
- overdue orders get a large boost
- near-due orders outrank farther ones
- older waiting orders outrank newer waiting orders
- `Preparing` orders keep a stable position and do not bounce around on each refresh

Keep the implementation simple enough that the class demo can explain it in one sentence.

- [ ] **Step 4: Re-run the focused backend tests**

Run:

```bash
cd Application/backend && ./.venv/bin/pytest tests/test_kitchen_queue.py -q
```

Expected: pass.

### Task 2: Auto-cancel stale orders before they linger in the queue

**Files:**
- Modify: `backend/app/api/kitchen/orders.py`
- Modify: `backend/app/api/kitchen/actions.py` if the cancellation helper is shared
- Modify: `backend/app/domain/order_state.py` only if a helper is needed
- Test: `backend/tests/test_kitchen_queue.py`

- [ ] **Step 1: Write the failing stale-order test**

Add a test that creates an active kitchen order older than 24 hours and asserts it is cancelled and removed from the active queue.

- [ ] **Step 2: Run the stale-order test**

Run:

```bash
cd Application/backend && ./.venv/bin/pytest tests/test_kitchen_queue.py -q
```

Expected: fail until the auto-cancel path exists.

- [ ] **Step 3: Implement the auto-cancel path**

Add a backend helper that:
- checks active orders for age > 24 hours
- transitions them to `Cancelled`
- records the cancellation in tracking history
- excludes them from the kitchen queue response

Prefer an implementation that can run as part of the queue read path or adjacent mutation path, so the demo does not depend on a background scheduler.

- [ ] **Step 4: Re-run the stale-order test**

Run:

```bash
cd Application/backend && ./.venv/bin/pytest tests/test_kitchen_queue.py -q
```

Expected: pass.

## Chunk 2: Kitchen Notes Visibility

### Task 3: Surface kitchen tracking notes in the kitchen ticket response

**Files:**
- Modify: `backend/app/api/kitchen/orders.py`
- Modify: `frontend/lib/api/kitchen.ts`
- Modify: `frontend/app/kitchen/ticket.tsx`
- Test: `backend/tests/test_kitchen_queue.py` or `backend/tests/test_kitchen_actions.py`
- Test: `frontend/app/kitchen/queue-client.test.tsx`

- [ ] **Step 1: Write the failing backend/frontend tests**

Add assertions that:
- kitchen note entries written through `POST /api/kitchen/orders/{id}/notes` are visible again when the queue is refreshed
- the kitchen ticket shows note text associated with the order, not only the item-level notes

- [ ] **Step 2: Run the tests and verify the gap**

Run:

```bash
cd Application/backend && ./.venv/bin/pytest tests/test_kitchen_actions.py tests/test_kitchen_queue.py -q
cd Application/frontend && npm exec -- vitest run app/kitchen/queue-client.test.tsx
```

Expected: the new note assertions fail until the response shape and ticket render are updated.

- [ ] **Step 3: Implement the note payload and render path**

Extend the kitchen queue response with a compact note list or event list that the ticket can render under the order items.

Keep the UI simple:
- show note text
- show note source if it helps staff distinguish kitchen vs system entries
- do not add editing or filtering in the kitchen view

- [ ] **Step 4: Re-run the targeted tests**

Run:

```bash
cd Application/backend && ./.venv/bin/pytest tests/test_kitchen_actions.py tests/test_kitchen_queue.py -q
cd Application/frontend && npm exec -- vitest run app/kitchen/queue-client.test.tsx
```

Expected: pass.

## Chunk 3: End-to-End Regression

### Task 4: Lock the queue behavior with an e2e regression

**Files:**
- Modify: `frontend/tests/e2e/kitchen.spec.ts`
- Modify: `frontend/tests/e2e/admin-orders.spec.ts` if admin visibility needs a regression

- [ ] **Step 1: Write the failing e2e assertion**

Assert that:
- kitchen cards render in the backend-provided order
- `Preparing` cards do not re-order across refreshes
- stale orders are absent after the auto-cancel rule kicks in
- note text appears on the ticket when present

- [ ] **Step 2: Run the e2e test**

Run:

```bash
cd Application/frontend && npx playwright test tests/e2e/kitchen.spec.ts
```

Expected: fail until the backend and ticket rendering are aligned.

- [ ] **Step 3: Stabilize any remaining UI copy or selectors**

Prefer data-testid hooks already present in the kitchen ticket and queue client. Avoid introducing new visual controls unless the test truly needs them.

- [ ] **Step 4: Re-run the e2e test**

Run:

```bash
cd Application/frontend && npx playwright test tests/e2e/kitchen.spec.ts
```

Expected: pass.
