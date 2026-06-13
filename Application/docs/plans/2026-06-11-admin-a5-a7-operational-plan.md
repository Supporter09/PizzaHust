# Admin A5-A7 Operational UX Expansion Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan.

**Goal:** Expand the admin A5-A7 workstreams from basic list pages into operational workflows: order monitoring with a detail timeline and date filtering, customer intelligence with richer segmentation and profile depth, and a report dashboard that matches the design mockups with summary cards, charts, and item revenue ranking.

**Architecture:** Keep FastAPI and SQLAlchemy as the source of truth for all operational data, and keep the Next.js admin shell as a thin presentation layer. Prefer read models assembled from existing entities (`orders`, `order_items`, `order_tracking`, `users`) for the list/detail/dashboard surfaces, and keep operational feedback attached to `order_tracking` rather than adding a separate issues table. The first delivery should preserve the existing admin routes and extend them with richer detail payloads and query params rather than replace the whole admin area.

**Tech Stack:** FastAPI, SQLAlchemy, Pydantic, Alembic, Next.js App Router, TypeScript, Playwright, OpenAPI type generation, SVG-based charts.

---

## Context Audit

### What already exists

- A5 order monitoring page is live at `Application/frontend/app/admin/orders/page.tsx`.
- A6 customer list and detail routes are live at `Application/frontend/app/admin/customers/page.tsx` and `Application/frontend/app/admin/customers/[id]/page.tsx`.
- A7 reports page is live at `Application/frontend/app/admin/reports/page.tsx`.
- Backend routes already exist for:
  - `GET /api/admin/orders`
  - `GET /api/admin/orders/{id}`
  - `POST /api/admin/orders/{id}/cancel`
  - `POST /api/admin/orders/{id}/retry-dispatch`
  - `GET /api/admin/customers`
  - `GET /api/admin/customers/{id}`
  - `POST /api/admin/customers/{id}/lock`
  - `POST /api/admin/customers/{id}/unlock`
  - `GET /api/admin/reports/sales`

### Main gap

- The current A5-A7 surfaces are functional but still read like administrative tables, not operational workflows.
- The current A7 report payload is list-based and does not yet expose the full dashboard envelope needed by the mockup: 4 stats, range presets, two chart series, and a ranked table with revenue.
- The current A6 detail page is read-only and shallow. It shows profile fields but not order history, loyalty interpretation, or customer segmentation signals.
- The current A5 page lacks an order detail drawer/modal, a date filter defaulting to the current day, and a clean way to tag phase-linked feedback by source.

### Current data relations that matter

- `User 1 -> N Order` via `orders.user_id`.
- `Order 1 -> N OrderItem` via `order_items.order_id`.
- `OrderItem 1 -> N OrderItemTopping` via `order_item_toppings.order_item_id`.
- `Order 1 -> N OrderTracking` via `order_tracking.order_id`.
- `OrderTracking` already stores `status`, `created_at`, `note`, and `updated_by`.
- `OrderItem.unit_price_vnd` already stores the authoritative price used at order time.
- `OrderTracking` can be extended with a lightweight `note_source` enum so each note can be tagged as `kitchen`, `transport`, `customer`, or `system`.

### Important consequence

- The existing schema is already enough to build a first-pass order timeline, customer history, and sales aggregates.
- For this scope, phase-linked feedback can live on `order_tracking` as `note` plus a `note_source` tag, which is simpler than a new table and still keeps the source explicit.

---

## Use Case Detail Analysis

### A5: Monitor Orders

**Business intent**
- Let admins see the current order queue, find risky orders quickly, and inspect the full operational story of any order without leaving the page.
- The workflow should feel closer to a merchant/operator console than a plain data grid.

**Primary actors**
- Admin operator
- Kitchen staff indirectly, via order status changes and notes
- Delivery integration, via dispatch failure/success events

**Triggers**
- An order is received, changes status, fails dispatch, or completes.
- The admin clicks a row to inspect details.
- The admin changes the date window or status filter.

**Main flow**
1. Admin opens `/admin/orders`.
2. Page loads the default date window, which should start as the current day.
3. Page shows the status chips plus a date filter control.
4. List rows show order code, current status, customer, address, total, and time.
5. Admin clicks a row or a dedicated view action.
6. A detail drawer/modal opens with:
   - order summary
   - line items and option breakdown
   - status timeline
   - notes/issues by stage, if any
   - delivery reference and last operational action
7. Admin can retry dispatch for `DispatchPending`, cancel when allowed, or simply inspect the timeline.

**Alternate flows**
- If the order has no timeline entries beyond the core status events, the detail view still renders the order summary and an empty-state timeline.
- If a dispatch retry fails, the drawer should surface the failure reason and keep the order in `DispatchPending`.
- If the date range returns no orders, the table should show a purposeful empty state, not an error.

**What the detail dialog needs to show**
- Core identifiers: order code, order id, current status, created at, promised at, customer name, phone, delivery address.
- Financials: subtotal/total, delivery fee, payment method, any discounts if available from the order model.
- Items: each `OrderItem` with product/combo name, quantity, unit price, options, toppings, and line notes.
- Timeline: each `OrderTracking` row, rendered as a stage card or event list.
- Issues/feedback: note text from timeline entries, grouped by status/stage.
- Operational actions: retry dispatch, cancel, and any future state transitions already supported by backend rules.

**How the “feedback/issues” requirement should be interpreted**
- Keep the feedback attached to the existing phase timeline rather than introducing a separate issue table.
- Use `OrderTracking.note` for the text itself and add a lightweight `note_source` tag so the UI can distinguish:
  - kitchen/store problems
  - third-party transport problems
  - customer feedback
- `OrderTracking.status` remains the phase, and the modal can group notes by that phase.
- This is enough as long as we only need one note thread per phase. If we later need multiple issues per phase, ownership, acknowledgements, or resolved/dismissed lifecycle, then we should revisit a separate table.

**Backend implication**
- `GET /api/admin/orders` needs date range params and probably a default current-day range when omitted.
- `GET /api/admin/orders/{id}` should become a richer detail response or gain an adjacent detail endpoint that includes items, timeline, and phase-linked feedback notes.
- The backend should continue to own status transitions and the retry-dispatch rule.

**Frontend implication**
- The list page should preserve the existing status chips, warning state, and polling.
- The detail surface should be a modal or drawer, not a full navigation hop, so operators can inspect multiple orders quickly.

---

### A6: Customer Accounts

**Business intent**
- Turn customer management from a read-only directory into a segmentation and account-intelligence surface.
- Help admin staff identify top customers, current loyalty value, and customers worth attention or retention.

**Primary actors**
- Admin operator

**Triggers**
- Admin searches, sorts, filters, or opens a customer profile.

**Main flow**
1. Admin opens `/admin/customers`.
2. Page defaults to a useful ranking, not raw user id order.
3. Admin filters or sorts by tier, points, order count, lock state, or name.
4. Admin opens `/admin/customers/{id}`.
5. Detail page shows profile, recent order history, loyalty summary, and account-state context.
6. The UI highlights what the customer can currently redeem or what segment they belong to.

**Customer detail should include**
- Identity/profile: name, phone, email, address, lock state.
- Loyalty context: current points, total earned points, membership tier.
- Order history: recent orders, totals, status, date, and quick drill-down if needed.
- Quick stats: total orders, delivered orders, total spend, average order value, last order date.
- Eligibility/benefits section: what the customer can currently redeem based on points and current loyalty rules.

**Benefits interpretation**
- The current codebase already has loyalty math, but it does not define explicit tier perks beyond the `membership_tier` label.
- For the first iteration, the detail page should expose computed loyalty capabilities:
  - points balance
  - maximum redeemable discount value
  - current tier
  - frequency/value signals derived from order history
- If tier-specific perks are expected, that needs an explicit business rule source before implementation.

**Backend implication**
- `GET /api/admin/customers` should gain sort and filter params such as:
  - `sort_by=tier|points|orders|name|created_at`
  - `sort_dir=asc|desc`
  - optional `tier=` filter
  - optional `locked=` filter
- `GET /api/admin/customers/{id}` should expand from a shallow profile response into a richer detail payload that includes order history and summary stats.

**Frontend implication**
- The list page should support sorting and filtering without forcing a separate analytics page.
- The detail page should look like an account dossier, not just a profile card.

---

### A7: Sales and Orders Report

**Business intent**
- Replace the current “some bars and totals” report with a proper business dashboard that mirrors the mockup.

**Primary actors**
- Admin operator

**Triggers**
- Admin opens `/admin/reports`.
- Admin changes the date preset or custom range.
- Admin exports CSV.

**Main flow**
1. Page loads with the last 7 days preset selected by default.
2. Backend returns a structured report envelope for the requested range.
3. Dashboard renders:
   - Total Revenue
   - Total Orders
   - Avg Order Value
   - Active Customers
   - Daily Revenue line chart
   - Daily Orders bar chart
   - Top Selling Items table with rank and revenue
4. Admin switches to Last 30 Days or a custom date range.
5. Charts and stat cards update from the same backend payload.

**Metric definitions**
- Total Revenue: sum of `order.total_amount_vnd` for completed/delivered orders in range.
- Total Orders: count of completed/delivered orders in range.
- Avg Order Value: revenue divided by order count.
- Active Customers: count of distinct non-null `orders.user_id` that had delivered/completed orders in the range.
- Daily Revenue: grouped revenue by day.
- Daily Orders: grouped order count by day.
- Top Selling Items: aggregated across the selected range, with both order count and revenue.

**How item revenue should be calculated**
- Use `OrderItem.unit_price_vnd * quantity` as the base line revenue.
- That works because the pricing pipeline already writes the authoritative priced line into `unit_price_vnd`.
- If future product rules need to split toppings revenue from base pizza revenue, that becomes a separate analytical requirement; do not over-normalize now.

**Backend implication**
- The current list-shaped report response is not enough for the full dashboard.
- The endpoint should either:
  - return an envelope with `summary`, `series`, and `top_items`, or
  - add a dedicated overview endpoint and keep the existing list endpoint for compatibility.
- The dashboard needs aggregate queries for:
  - summary totals
  - daily revenue/order series
  - distinct active customers
  - top item ranking with revenue

**Frontend implication**
- Replace date inputs + group select with preset chips:
  - Last 7 Days
  - Last 30 Days
  - Custom Range
- Render SVG charts rather than progress bars.
- Render the top items table with:
  - rank badge
  - item name
  - order count
  - revenue

---

## Relation / Schema Impact

### Phase-linked feedback on `order_tracking`

- Extend `order_tracking` with one lightweight enum:
  - `note_source` enum: `system`, `kitchen`, `transport`, `customer`
  - default `system`
- Keep `note` as the free-text field.
- Keep `status` as the phase marker.
- Suggested indexes:
  - `order_id`
  - `status`
  - `note_source`
  - `created_at`
- Relationship intent:
  - `Order 1 -> N OrderTracking` continues to be the single operational timeline
  - each tracking row can carry one phase-linked feedback note
- Interpretation:
  - `status` tells us which phase the note belongs to
  - `note_source` tells us who/what the note is about
  - this keeps the model simple while still letting the modal show kitchen / transport / customer feedback grouped by phase

### Remaining surfaces can stay read-only in the first pass

- A6 can use existing `users` and `orders`.
- A7 can use existing `orders`, `order_items`, `products`, and `combos`.

### What would require a migration later

- A separate customer benefits/rules table if tier perks become a first-class business system.
- A denormalized analytics cache table if report queries become too expensive at scale.
- A separate issue table only if we later need multiple tickets per phase, ownership, or an open/ack/resolved workflow.

### Recommendation

- Ship the first pass with a small migration that adds `note_source` to `order_tracking`.
- Keep A6 and A7 on the current relations.
- Avoid broader schema churn unless the review asks for explicit tier-perk modeling or a full issue lifecycle.

---

## API / Contract Impact

### A5

- Extend `GET /api/admin/orders` with date range support.
- Extend or replace `GET /api/admin/orders/{id}` with a detail shape that includes items, timeline entries, and phase-linked feedback notes.
- Keep `POST /api/admin/orders/{id}/retry-dispatch` and `POST /api/admin/orders/{id}/cancel` as the state-changing actions.
- Add a lightweight note tagging path for phase feedback, likely through the detail payload and an optional admin note update endpoint if needed.
- The payload should return `note_source` as a string so the frontend can render source chips without extra mapping.

### A6

- Extend `GET /api/admin/customers` with sort and filter params.
- Extend `GET /api/admin/customers/{id}` to include recent orders and summary stats.

### A7

- Add a new dashboard overview endpoint for the richer UI, and keep `GET /api/admin/reports/sales` for compatibility unless the review later chooses a clean replacement.
- Regenerate `Application/openapi.json` and `Application/frontend/lib/api/types.ts` after the contract is finalized.

### Docs to update

- `Application/CONTRACTS.md`
- `Application/docs/plans/2026-06-10-admin-a5-a10-plan.md` if the old tranche overview should reflect the new deeper A5-A7 scope

---

## Implementation Plan

### Chunk 1: A5 Order Monitoring Detail + Date Filter

**Files:**
- Modify: `Application/backend/app/api/admin/orders.py`
- Modify: `Application/backend/tests/test_admin_orders_dispatch.py`
- Modify: `Application/backend/app/infra/db/models.py`
- Create: `Application/backend/app/infra/db/migrations/versions/<new_revision>_add_order_tracking_note_source.py`
- Create: `Application/backend/tests/test_admin_order_tracking_notes.py`
- Modify: `Application/frontend/app/admin/orders/page.tsx`
- Add or modify: `Application/frontend/tests/e2e/admin-orders.spec.ts`
- Possibly modify: `Application/frontend/components/shared/status-badge.tsx` if new stage badges are needed

- [ ] Write backend tests for order detail payload, date filtering, and timeline coverage.
- [ ] Write backend tests for the new `note_source` tagging on order tracking entries.
- [ ] Write frontend tests for the detail drawer/modal and default current-day filtering.
- [ ] Implement the minimal backend contract changes for order detail and date filtering.
- [ ] Add `note_source` to `order_tracking` and wire it into the detail payload.
- [ ] Implement the detail UI and wire it to the richer payload.
- [ ] Run backend + frontend tests and confirm the modal, filters, and retry/cancel actions still work.

### Chunk 2: A6 Customer Intelligence Detail + Sorting

**Files:**
- Modify: `Application/backend/app/api/admin/customers.py`
- Modify: `Application/backend/tests/test_admin_customers.py`
- Modify: `Application/frontend/app/admin/customers/page.tsx`
- Modify: `Application/frontend/app/admin/customers/[id]/page.tsx`
- Add or modify: `Application/frontend/tests/e2e/admin-customers.spec.ts`

- [ ] Write tests for sort/filter params and for the richer customer detail payload.
- [ ] Write frontend tests for tier/points/order sorting and the richer profile page.
- [ ] Implement the new query params and richer customer detail response.
- [ ] Implement the account dossier UI with order history and loyalty capability sections.
- [ ] Run backend + frontend tests and confirm lock/unlock still behaves correctly.

### Chunk 3: A7 Report Dashboard Overhaul

**Files:**
- Modify or replace: `Application/backend/app/api/admin/reports.py`
- Modify: `Application/backend/tests/test_admin_reports.py`
- Modify: `Application/frontend/app/admin/reports/page.tsx`
- Modify: `Application/frontend/lib/api/types.ts` after regenerating OpenAPI types
- Modify: `Application/CONTRACTS.md`
- Add or modify: `Application/frontend/tests/e2e/admin-reports.spec.ts`

- [ ] Write backend tests for the new report envelope, summary metrics, top-items revenue, and date presets.
- [ ] Write frontend tests for the 4 stat cards, 2 charts, and top-items table.
- [ ] Implement the backend aggregate queries and the frontend dashboard layout.
- [ ] Regenerate types and re-run the report tests.

---

## Resolved Decisions

- A5 detail surface will be a modal/drawer, with phase-by-phase timeline, state, and issues shown inline.
- A5 feedback/issues will stay attached to `order_tracking` as phase-linked notes with a `note_source` tag.
- A6 membership tier remains a label for now.
- A7 will use a new overview endpoint for the richer dashboard UI, while keeping the existing sales route compatible unless review says otherwise.
