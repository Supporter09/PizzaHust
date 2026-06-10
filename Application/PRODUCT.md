# PRODUCT.md

Locked scope for PizzaHUST MVP. Derived from `Documents/InClassDocument/ProjectFeasibility.md`, `Documents/Latex/section2_planning.tex`, `Documents/Latex/section3_analysis.tex`, and `Documents/Mermaid.md`.

## Mission

Web-only online ordering and store management for a single pizza shop. Replaces phone/in-person orders with a unified ordering, kitchen, and delivery handoff flow.

## In Scope (MVP)

- Public menu browsing, category filters, item detail pages.
- Pizza customization via admin-defined option groups (e.g. size, crust, toppings — see "v2 Design Additions § Options Model").
- Combo and category management with time-based availability; combos are customizable and orderable (customer's-choice component slots).
- Cart and checkout with cash on delivery.
- Guest checkout with order-code tracking.
- Per-dish notes (to kitchen) and per-order delivery notes (to courier) — see "v2 Design Additions § Notes Taxonomy".
- Customer register, login, profile (incl. avatar + password change), order history, loyalty points, redeem at checkout.
- Admin: pizzas (multi-image), generic options, categories, combos (choice-slots), customers, order monitoring, basic reports.
- Kitchen order queue with prioritized display, preparation status updates, dispatch handoff, and manual pickup-confirmation fallback.
- Mock-first third-party delivery integration with status synchronization.
- Basic sales and order reports for the store owner.

## Out of Scope (rejected by harness)

- Online payment gateway (Momo/VNPay/card).
- Internal shipper/staff delivery portal.
- AI-based menu recommendation widget.
- Native mobile apps (iOS/Android).
- Multi-branch / multi-tenant support.
- Advanced BI dashboards or warehouse analytics.
- Online chat or live customer support.

## Actors

| ID | Actor | Authentication |
|---|---|---|
| Guest | Anonymous visitor | None (session cart only) |
| Customer | Registered user | Cookie session, role=`customer` |
| Admin | Store owner / admin staff | Cookie session, role=`admin` |
| Kitchen | Kitchen staff | Cookie session, role=`kitchen` |
| Delivery | Third-party delivery service | Signed webhook + outbound API key |

`Customer` inherits all `Guest` capabilities.

## Use Case Index

Source: `Documents/Latex/section3_analysis.tex`. IDs are reused as feature IDs in `feature_list.json`.

### Customer-facing (U)

| ID | Name | Notes |
|---|---|---|
| U1 | Browse Menus | category-based |
| U2 | View Item Details | pizza shows size/crust/toppings |
| U3 | Customize Pizza | size / crust / toppings; live total; per-dish note input (U16) |
| U4 | View Combo Promotions | time-windowed availability; customizable & orderable via U15 (v2) |
| U5 | Manage Cart | session-bound for guest, account-bound for customer; lines show options + dish note |
| U6 | Place COD Order | includes U6.1 delivery info and U6.2 review/confirm; extended by U14; delivery note (U16) |
| U7 | Track Order | includes U7.1 sync delivery; calls T2 |
| U8 | Register | customer only |
| U9 | Log In | customer only |
| U11 | View Order History | customer only (`U10` reserved for deferred AI flow) |
| U12 | Manage Profile | customer only; profile + avatar + password change (v2) |
| U13 | View Loyalty Points | customer only |
| U14 | Redeem Points for Discount | extends U6, customer only |
| U15 | Customize Combo | resolve choice-slots + per-pizza options; combos orderable (v2) |
| U16 | Order Notes | per-dish note → kitchen; per-order delivery note → courier (v2) |

### Admin (A)

| ID | Name |
|---|---|
| A1 | Manage Pizza Catalog |
| A2 | Manage Pizza Options and Side Dishes (v2: generic Options, embedded in dish editor — see A8) |
| A3 | Manage Menu Categories |
| A4 | Manage Combo Campaigns |
| A5 | Monitor Orders and Delivery Exceptions |
| A6 | Manage Customer Accounts |
| A7 | View Sales and Order Reports |
| A8 | Generic Options Model (v2) |
| A9 | Multi-image Dishes (v2) |
| A10 | Combo Choice-Slots and Component Picker (v2) |

### Kitchen (K)

| ID | Name |
|---|---|
| K1 | View Incoming Orders |
| K2 | Update Preparation Status |
| K3 | Mark Order Ready for Dispatch (includes T1) |
| K4 | Confirm Pickup (fallback) (v2) |

### Third-Party Delivery (T)

| ID | Name |
|---|---|
| T1 | Request Delivery Service |
| T2 | Synchronize Delivery Status |

> **v2 extensions.** `U15`, `U16`, `A8`–`A10`, and `K4` are design-derived extensions from
> `DESIGN_BRIEF.md` (v2), not in the original `section3_analysis.tex` catalog. They track the
> combo-customization, generic-options, multi-image, notes, and pickup-fallback work added by
> the 2026-06-10 scope decision. Details in "v2 Design Additions" below.

## Business Constants

These values live in `backend/app/domain/pricing.py` and `backend/app/domain/loyalty.py`. Frontend reads them via `/api/config/*`. Never hardcode in frontend.

| Key | Value | Source |
|---|---|---|
| `DELIVERY_FEE_VND` | `22000` | section3_analysis U6 |
| `SERVICE_AREA` | `inner-Hanoi` (2025 post-reorganization ward whitelist; see ARCHITECTURE) | section3_analysis U6 + Nghị quyết 1656/NQ-UBTVQH15 |
| `LOYALTY_ACCRUAL_RATE` | 1 point per `10_000` VND of subtotal | feasibility doc + team confirmation |
| `LOYALTY_REDEEM_VALUE_VND` | 1 point = `1_000` VND discount | feasibility doc + team confirmation |
| `LOYALTY_MAX_REDEEM_PCT` | 50% of subtotal | feasibility doc + team confirmation |
| `LOYALTY_ACCRUAL_TRIGGER` | on `Delivered` only | harness decision |
| `LOYALTY_REFUND_ON_CANCEL` | true | harness decision |
| `ORDER_CODE_FORMAT` | `PIZZ-` + 6 Crockford base32 chars (exclude I/L/O/U) | harness decision |
| `ORDER_CODE_LOOKUP_RATE_LIMIT` | 5 req / minute / IP | harness decision |
| `ORDER_PROMISED_TIME_DEFAULT_MIN` | 45 minutes from creation (confirm) | harness decision |

## Order State Machine

Defined in `ARCHITECTURE.md`. Summary:

```
Received → Preparing → Ready for Dispatch → Delivering → Delivered
            ↘ DispatchPending → Delivering
            ↘ Cancelled       ↘ Delivery Failed
```

Only transitions in this graph are valid. Any other transition raises a domain error.
`Ready for Dispatch → Delivering` is triggered by the courier pickup scan (T2) **or** the
kitchen's manual Confirm Pickup fallback (K4) — the same edge, attributed to a different actor.

## Loyalty Rules

- Accrual: `floor(subtotal_after_discount / LOYALTY_ACCRUAL_RATE)` points, credited only when order reaches `Delivered`.
- Redemption: customer chooses `n` points at checkout; discount = `n * LOYALTY_REDEEM_VALUE_VND`, capped at `LOYALTY_MAX_REDEEM_PCT * subtotal_after_combo`.
- Reservation: redeemed points are held until order reaches `Delivered` (consumed) or `Cancelled` / `Delivery Failed` (released).

## Delivery Service Area

Inner Hanoi only. Hanoi's 2025 reorganization ended district-level operations and created 126 commune-level units: 51 wards and 75 communes. The MVP delivery area is the 51 new wards in `backend/app/domain/service_area.py`. Checkout rejects any address whose administrative unit is not in the whitelist. Frontend disables submit until address validates.

## Tracking & Privacy

- Order code is the only identifier accepted for guest tracking.
- Tracking endpoint exposes only: status, status timeline, recipient first name, last 4 digits of phone, masked address.
- Authenticated customers see full order detail when the order belongs to their account.

## Reporting Scope (A7)

MVP-only metrics:

- Revenue by date range
- Order count by status
- Top 10 best-selling items
- Delivery success / failure rate

No cohort analysis, no funnels, no retention curves.

## v2 Design Additions

Source: `DESIGN_BRIEF.md` (v2). These extend the locked MVP per the 2026-06-10 team decision.
Where v2 and the API contracts disagree on payload shapes, contracts win; v2 wins on UX flow.

### Options Model (A8)

Replaces the fixed `PizzaSize` / `PizzaCrust` / `Topping` tables with admin-defined **option
groups**. A group has a name (e.g. *Sizes*, *Crusts*, *Toppings* — arbitrary; rename/add/delete
anytime). Each group holds **options** with: name, description, **price delta (VND)**, and an
enable toggle (disabled options are hidden from the customizer). Price deltas are shared across
pizzas; *which* options a given pizza offers is per-dish. The same option chips power the combo
customizer's per-pizza sub-menus (U15). Crusts now carry a price delta (the old fixed
`PizzaCrust` had none). Pricing still flows through `POST /api/cart/quote` — the frontend never
computes.

### Notes Taxonomy (U16)

Two distinct notes, never conflated:

| | Dish Note | Delivery Note |
|---|---|---|
| Entered | product / combo customizer, **per dish** | checkout, **per order** |
| Audience | kitchen | courier |
| Shown | under its line in cart; under the same dish on the kitchen card | kitchen card **only at Ready for Dispatch**; customer's own tracking view |
| Never | sent to the courier | shown during prep |

Storage: dish note reuses `OrderItem.notes`; delivery note is a new `Order` field.

### Combo Customization (U15, A10)

Combos are **orderable**, not view-only. A combo component (`ComboItem`) is either a fixed
product or a **customer's-choice slot** scoped to a category (e.g. "any large pizza"). The
customer resolves each slot and configures each pizza (crust + extra toppings) in the combo
customizer; premium options add to the combo total. A combo still needs ≥ 2 components; an
over-priced combo is accepted (UI warns). Savings = `max(0, Σ component base − combo price)`.

### Multi-image Dishes (A9)

A dish carries up to 8 images with one designated **cover** (the image menu cards/combos
render). Menu/combo read paths keep using a single cover URL; the gallery is an admin/detail
concern.

### Profile, extended (U12)

Edit Profile adds **avatar upload** and **password change**; phone number stays the locked
sign-in identifier (extends the v1 full_name + address only).

### Pickup Confirmation (K4)

When the courier's pickup scan (T2) is unavailable, kitchen staff may manually confirm pickup —
the same `Ready for Dispatch → Delivering` transition, attributed to the kitchen actor.

## Performance Targets

Academic-scope only:

- p95 page load < 2s on local dev
- p95 API response < 500ms on local dev
- Kitchen view polling at 3s interval (not WebSocket)
- Concurrent users targeted: ≤ 50 in demo

## Security Baseline

- Passwords hashed with `argon2` (or `bcrypt` cost ≥ 12 if `argon2-cffi` unavailable).
- Sessions: httpOnly + Secure + SameSite=Lax signed cookies.
- CSRF: SameSite=Lax + double-submit token on state-changing routes.
- Rate limit on `/api/auth/*` and `/api/orders/track/*`.
- No secrets in repo. `.env` is gitignored. `.env.example` lists required keys with safe placeholders.
