# Kitchen Priority Queue Design

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the kitchen view show orders in a practical priority order for the demo: urgent and near-due orders surface first, orders already accepted by the kitchen keep a stable position, and stale orders are automatically cancelled instead of lingering in the queue.

**Architecture:** Keep the backend as the single source of truth for ordering. The kitchen API should return tickets already sorted by a backend score so the frontend only renders the sequence it receives. Use simple scoring rules that fit the current project: waiting orders are prioritized by urgency and age, preparing orders are treated as locked in place, and orders older than one day are removed from active handling by cancellation logic.

**Tech Stack:** FastAPI, SQLAlchemy, MySQL view/query, Pydantic, Next.js App Router, TypeScript, Vitest, pytest.

---

## Context

- The current kitchen screen already polls `GET /api/kitchen/orders` every 3 seconds and renders the result in the order returned by the backend.
- The backend currently sources queue order from `kitchen_queue_view.priority_score`.
- Kitchen notes are already persisted and shown in the admin order detail timeline, but the kitchen ticket UI only shows notes attached to the ticket itself; it does not yet surface a separate queue-priority explanation.
- The new work should not introduce a new status or a client-side sort. The backend should keep ordering deterministic and the frontend should remain read-only.

## Desired Behavior

1. Orders in `Preparing` keep their relative order stable after kitchen acceptance.
2. Orders in `Received` are ordered by a simple priority score that favors:
   - orders closer to `promised_at`
   - older waiting orders
   - orders already overdue
3. Orders older than 24 hours from `created_at` are cancelled automatically and should no longer appear in the active queue.
4. The kitchen screen displays the backend-ordered queue exactly as received.
5. The admin order detail timeline continues to show kitchen notes, so kitchen actions remain auditable.

## Non-Goals

- Do not build a full weighted dispatch engine.
- Do not add VIP/customer-tier handling unless it is already available with little code churn.
- Do not add client-side drag/drop, manual reordering, or a separate kitchen dispatch screen.
- Do not change the order status model.

## Proposed Queue Model

### Active Queue Buckets

- `Preparing`: accepted by kitchen, fixed in place until the next backend state transition.
- `Received`: waiting orders that can still be prioritized.
- `ReadyForDispatch`: already handled by kitchen; shown only if the existing queue contract keeps exposing it.

### Priority Scoring

Use a simple additive score in the backend queue source:

- Base score from age: older waiting orders rank ahead of newer ones.
- Due-soon bonus: orders whose `promised_at` is near or past get boosted.
- Overdue bonus: orders past `promised_at` get a larger boost.
- Preparing lock: once an order becomes `Preparing`, its priority should not fluctuate relative to other `Preparing` orders during normal refreshes.

The exact numbers can stay simple as long as the queue remains deterministic and easy to explain in class. The important rule is that urgency beats raw age for waiting orders, while accepted orders do not jump around.

## Expiration Rule

- If an active order is more than 24 hours old and has not reached a terminal state, backend logic should cancel it.
- The cancellation should be visible in admin history and should remove the order from the kitchen queue on the next refresh.
- The rule should run in a backend path that already executes during queue refresh or order mutation, so the project does not depend on a separate scheduler for the demo.

## Kitchen Notes

- Kitchen notes should remain append-only tracking entries.
- Kitchen note entries should be visible in admin detail history.
- If the kitchen screen shows notes inline, it should render all notes associated with the ticket, but should not try to interpret them as queue priorities.

## Testing Strategy

- Backend tests should cover:
  - queue ordering for two or more received orders with different ages and promised times
  - preparing orders staying stable relative to each other
  - auto-cancellation for orders older than 24 hours
  - queue exclusion after cancellation
  - note tracking still being written and visible in admin detail history
- Frontend tests should cover:
  - the kitchen list renders the backend order unchanged
  - the note UI still saves and refreshes the queue
  - no client-side sort is introduced

## Implementation Boundary

- Backend queue logic belongs in the queue source (`kitchen_queue_view` or the route feeding it), not in the React client.
- Frontend changes should be limited to presentation, empty-state copy, and note visibility if needed.
- Any extra queue explanation should be documented in code comments or test names, not by adding new user-facing controls unless strictly necessary.
