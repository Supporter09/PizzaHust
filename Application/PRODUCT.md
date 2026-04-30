# PRODUCT.md

Locked scope for PizzaHUST MVP. Derived from `Documents/InClassDocument/ProjectFeasibility.md`, `Documents/Latex/section2_planning.tex`, `Documents/Latex/section3_analysis.tex`, and `Documents/Mermaid.md`.

## Mission

Web-only online ordering and store management for a single pizza shop. Replaces phone/in-person orders with a unified ordering, kitchen, and delivery handoff flow.

## In Scope (MVP)

- Public menu browsing, category filters, item detail pages.
- Pizza customization: size (S, M, L), crust type, optional toppings.
- Combo and category management with time-based availability.
- Cart and checkout with cash on delivery.
- Guest checkout with order-code tracking.
- Customer register, login, profile, order history, loyalty points, redeem at checkout.
- Admin: pizzas, options/side dishes, categories, combos, customers, order monitoring, basic reports.
- Kitchen order queue with prioritized order handling and preparation status updates.
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
| U3 | Customize Pizza | includes U3.1 size, U3.2 crust; extends with U3.3 toppings |
| U4 | View Combo Promotions | time-windowed availability |
| U5 | Manage Cart | session-bound for guest, account-bound for customer |
| U6 | Place COD Order | includes U6.1 delivery info, U6.2 fee, U6.3 confirm; extended by U13 |
| U7 | Track Order | includes U7.1 sync delivery; calls T2 |
| U8 | Register | customer only |
| U9 | Log In | customer only |
| U10 | View Order History | customer only |
| U11 | Manage Profile | customer only |
| U12 | View Loyalty Points | customer only |
| U13 | Redeem Points for Discount | extends U6, customer only |

### Admin (A)

| ID | Name |
|---|---|
| A1 | Manage Pizza Catalog |
| A2 | Manage Pizza Options and Side Dishes |
| A3 | Manage Menu Categories |
| A4 | Manage Combo Campaigns |
| A5 | Monitor Orders and Delivery Exceptions |
| A6 | Manage Customer Accounts |
| A7 | View Sales and Order Reports |

### Kitchen (K)

| ID | Name |
|---|---|
| K1 | View Kitchen Order Queue |
| K2 | Process Prioritized Order |
| K3 | Update Preparation Status |
| K4 | Mark Order Ready for Dispatch (includes T1) |

### Third-Party Delivery (T)

| ID | Name |
|---|---|
| T1 | Request Delivery Service |
| T2 | Synchronize Delivery Status |

## Business Constants

These values live in `backend/app/domain/pricing.py` and `backend/app/domain/loyalty.py`. Frontend reads them via `/api/config/*`. Never hardcode in frontend.

| Key | Value | Source |
|---|---|---|
| `DELIVERY_FEE_VND` | `22000` | section3_analysis U6 |
| `SERVICE_AREA` | `inner-Hanoi` (city-district whitelist; see ARCHITECTURE) | section3_analysis U6 |
| `LOYALTY_ACCRUAL_RATE` | 1 point per `10_000` VND of subtotal (placeholder — confirm) | feasibility doc |
| `LOYALTY_REDEEM_VALUE_VND` | 1 point = `1_000` VND discount (placeholder — confirm) | feasibility doc |
| `LOYALTY_MAX_REDEEM_PCT` | 50% of subtotal (placeholder — confirm) | feasibility doc |
| `LOYALTY_ACCRUAL_TRIGGER` | on `Delivered` only | harness decision |
| `LOYALTY_REFUND_ON_CANCEL` | true | harness decision |
| `ORDER_CODE_FORMAT` | ULID, displayed as 26-char Crockford base32 | harness decision |
| `ORDER_CODE_LOOKUP_RATE_LIMIT` | 5 req / minute / IP | harness decision |
| `ORDER_PROMISED_TIME_DEFAULT_MIN` | 45 minutes from creation (confirm) | harness decision |

Placeholders must be replaced with team-confirmed numbers before `U13` and `infra-loyalty` start.

## Order State Machine

Defined in `ARCHITECTURE.md`. Summary:

```
Received → Preparing → Ready for Dispatch → Delivering → Delivered
                                                       ↘ Delivery Failed
            ↘ Cancelled (admin-only, before Ready for Dispatch)
```

Only transitions in this graph are valid. Any other transition raises a domain error.

## Loyalty Rules (placeholder — confirm before U13)

- Accrual: `floor(subtotal_after_discount / LOYALTY_ACCRUAL_RATE)` points, credited only when order reaches `Delivered`.
- Redemption: customer chooses `n` points at checkout; discount = `n * LOYALTY_REDEEM_VALUE_VND`, capped at `LOYALTY_MAX_REDEEM_PCT * subtotal`.
- Reservation: redeemed points are held until order reaches `Delivered` (consumed) or `Cancelled` / `Delivery Failed` (released).

## Delivery Service Area

Inner Hanoi only. Whitelist of districts in `backend/app/domain/service_area.py`. Checkout rejects any address whose district is not in the whitelist. Frontend disables submit until address validates.

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
