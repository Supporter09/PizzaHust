# PizzaHUST — Use-Case & Flow Recap (Design Brief) · v2

> **Purpose.** Single-page recap of every use case (U / A / K / T) and the end-to-end
> application flow, **updated to match the hi-fi design set** (27 screens, `gallery.html`).
> v1 described the intended build; v2 is the design-aligned source of truth for flows,
> panels, and the data each renders.
>
> **Source of truth.** Derived from `uploads/DESIGN_BRIEF.md` (v1) + the design set in this
> project. Where v2 and the API contracts disagree, contracts win for payload shapes; v2 wins
> for UX flow and panel inventory.
>
> **As of:** June 2026 · design set "PizzaHust refined" (customer + kitchen + admin, light/dark).

---

## 1. Product snapshot

**Mission.** Web-only online ordering + store management for a *single* pizza shop.
One ordering → kitchen → delivery-handoff flow.

**Hard constraints (unchanged from v1):**

- **Cash on delivery only.** No payment gateway. The checkout shows a COD notice card.
- **Inner-Hanoi only.** Checkout validates the address against the 51-ward whitelist.
- **Polling, not realtime.** Kitchen polls 3s (visible "Auto-refresh · 3s" indicator), admin 15s,
  tracking shows an "auto-updating" pulse.
- **Money is integer VND** in production. ⚠️ *The design set uses `$` placeholder pricing by
  the client's instruction — swap to `formatVnd` at build time (see §10).*
- **Frontend never computes prices.** Quotes come from `POST /api/cart/quote`. The live totals
  in the designs (customizer, combo builder) illustrate the *rendered result* of a quote.
- **Light/dark + mobile-responsive.** ✅ Designed: persisted theme toggle in the customer nav,
  admin sidebar, kitchen bar, and gallery. All tokens themed.

### Actors

| Actor | Auth | Can do |
|---|---|---|
| **Guest** | none | Browse, customize, combo-build, cart, COD checkout, track by code (masked projection) |
| **Customer** | session, `role=customer` | Guest + register/login, profile edit, history, loyalty, redeem |
| **Admin** | session, `role=admin` | Catalog (dishes, options, categories, images), combos, customers (lock), orders, import, reports |
| **Kitchen** | session, `role=kitchen` | Queue, accept, prep, mark ready, **confirm pickup (fallback)** |
| **Delivery** | webhook + API key | Provider; pickup scan auto-advances status. No human UI |

---

## 2. Use-case catalog — design status

Legend: 🎨 designed (hi-fi panel exists) · file = panel in this project.

### Customer (U)

| ID | Name | Status | Panel |
|---|---|---|---|
| U1 | Browse Menus | 🎨 | `menu.html` — category chips, 4-col grid |
| U2 | View Item Details | 🎨 | `product.html` (merged with U3) |
| U3 | Customize Pizza | 🎨 | `product.html` — size/crust/toppings, live total |
| **U3.1** | **Dish Note** *(new)* | 🎨 | `product.html` — per-dish note → cart → kitchen (yellow chip) |
| U4 | View Combo Promotions | 🎨 | `combos.html` — component lists, "Save $X" badge, nav link |
| **U4.1** | **Customize Combo** *(new — was deferred to U5 in v1)* | 🎨 | `combo-customize.html` — pick each component **and per-pizza options** |
| U5 | Manage Cart | 🎨 | `cart.html` — line opts + dish notes, loyalty toggle |
| U6 | Place COD Order | 🎨 | `checkout.html` — delivery info, COD card, courier-only delivery note |
| U7 | Track Order | 🎨 | `track.html` — lookup + timeline, **guest masked projection** |
| U8 | Register | 🎨 | `auth.html` — Full name, Phone, Password, Address (optional) |
| U9 | Log In | 🎨 | `auth.html` — Phone + Password (tabbed with U8) |
| U11 | View Order History | 🎨 | `order-history.html` |
| U12 | Manage Profile | 🎨 | `account.html` + `edit-profile.html` (phone locked — sign-in id) |
| U13 | View Loyalty Points | 🎨 | `loyalty.html` — balance, how-it-works, history |
| U14 | Redeem Points | 🎨 | `checkout.html` — redeem input, "100 pts = $10 · max 50% of subtotal" |
| — | Order Confirmed | 🎨 | `order-confirmed.html` — code, what's next, → track |

### Admin (A)

| ID | Name | Status | Panel |
|---|---|---|---|
| A1 | Manage Catalog | 🎨 | `admin-menu.html` (list) + `admin-item-edit.html` (editor) |
| **A1.1** | **Dish images — multi-upload** *(new)* | 🎨 | item editor — up to 8 images, cover badge, set-cover/remove |
| A2 | Manage Options | 🎨 **redefined, see §5** | inside `admin-item-edit.html` — *no standalone page* |
| A3 | Manage Categories | 🎨 | `admin-categories.html` (list) + `admin-category-edit.html` (editor) |
| A4 | Manage Combos | 🎨 | `admin-combos.html` (cards) + `admin-combo-edit.html` (editor + **component picker**) |
| A5 | Monitor Orders | 🎨 | `admin-orders.html` — full status set, **DispatchPending banner + Retry** |
| A6 | Manage Customers | 🎨 | `admin-customers.html` (list) + `admin-customer-detail.html` (**lock/unlock**) |
| A7 | Reports | 🎨 | `admin-reports.html` — revenue/orders charts, top sellers |
| — | Bulk Import | 🎨 | `admin-import.html` — CSV dropzone, format guide, history |
| — | Dashboard | 🎨 | `admin-dashboard.html` |

### Kitchen (K)

| ID | Name | Status | Panel |
|---|---|---|---|
| K1 | View Incoming Orders | 🎨 | `kitchen.html` — oldest-first cards, urgency ring, 3s poll chip |
| K2 | Update Prep Status | 🎨 | "Accept Order" → Preparing |
| K3 | Mark Ready for Dispatch | 🎨 | "Mark Ready for Dispatch" → triggers T1 |
| **K4** | **Confirm Pickup (fallback)** *(new)* | 🎨 | Ready card — manual "Confirm Pickup" → Delivering; normally auto via T2 |

### Delivery (T) — unchanged, no human UI
T1 dispatch request on K3 · T2 HMAC webhook drives `ReadyForDispatch → Delivering → Delivered/Failed`.
**The courier's pickup scan is the primary pickup confirmation; K4 is the staff fallback.**

---

## 3. The ordering spine (updated)

```
  Home (/index) ──────────────┬──────────────► Combos (combos.html) · U4
    │ "Order Now"             │                   │ "Order Now" on a combo card
    ▼                         │                   ▼
  Menu (menu.html) · U1       │            Combo Customizer (combo-customize.html) · U4.1
    │                         │              1. pick pizza #1  ─┐ each pizza has an
    ▼                         │              2. pick pizza #2  ─┤ "Options for {pizza}"
  Customize (product.html)    │              3. pick 2 sides   │ sub-menu: crust chips +
   U2/U3 size·crust·toppings  │              4. pick 4 drinks  │ extra-topping chips;
   U3.1 Dish Note (yellow)    │                                └ upcharges add to total
    │ "Add to Cart"           │                 │ "Add Combo to Cart"
    ▼                         ▼                 ▼
  Cart (cart.html) · U5  — lines show: options text + yellow Dish Note · loyalty toggle
    ▼
  Checkout (checkout.html) · U6 — delivery info · Delivery Note (courier only) ·
    U14 redeem points · COD card · Place Order — $total(incl. tax)
    ▼
  Confirmed (order-confirmed.html) ──► Track (track.html) · U7
    guest sees masked projection: first name, phone last-4, masked address,
    own delivery note, status timeline (auto-updating)
```

---

## 4. Notes taxonomy *(new — governs three panels)*

| | **Dish Note** (yellow chip) | **Delivery Note** (gray dashed) |
|---|---|---|
| Entered | `product.html` "Dish Note" field (per dish) | `checkout.html` "Delivery Notes" field (per order) |
| Audience | **Kitchen** | **Courier** |
| Shown | under its dish in `cart.html`; under the same dish on the kitchen card | kitchen card **only at Ready for Dispatch** ("Delivery note — for the courier"); customer's own `track.html` |
| Never | sent to the courier | shown during prep |

The dish line text itself (`Margherita Classic (M) · Regular crust · Extra Cheese`) is
**composed from the customer's option choices** — the dish editor shows a
"How it appears in cart & kitchen" preview of exactly this composition.

---

## 5. Options model *(redefined — replaces v1's fixed sizes/crusts/toppings)*

Options live **inside the dish editor** (`admin-item-edit.html`), not on a standalone page:

- Admin defines **option categories** (e.g. *Sizes, Crusts, Toppings* — but arbitrary):
  rename inline, add ("+ Add Category") or delete at any time.
- Each category holds **options**: editable **name, description, price delta**, and an
  **enable/disable toggle** (disabled rows dim and are hidden from the customizer).
- Option price deltas are shared across pizzas; enablement is per-dish.
- The same option chips power the **combo customizer's** per-pizza sub-menus (U4.1).

Implied API delta vs v1: option groups become admin-editable resources
(`categories[] → options[{name, desc, delta_vnd, enabled}]`) rather than fixed enums.

---

## 6. Combo model (updated)

- `admin-combo-edit.html`: basics + wide image · **Components** list (qty steppers, remove)
  with an **Add Component picker** — search + full dish list, headed by special entries
  *"Large/Medium Pizza — customer's choice"* (price "from $X").
- Rules kept from v1: **≥ 2 components**; over-priced combo accepted with a **warning**
  (live: typing a price above the components total shows the warning and hides the savings
  badge); status derived **Scheduled / Active / Expired** from the validity window.
- Customer side: combos are no longer view-only — **U4.1** lets the customer resolve each
  "customer's choice" slot and configure each pizza; premium options add to the combo total.

---

## 7. Order state machine (unchanged set, one clarification)

`Received → Preparing → ReadyForDispatch → Delivering → Delivered | DeliveryFailed`,
with `DispatchPending` (admin warning + Retry) and `Cancelled` as in v1.

**Clarification (K4):** `ReadyForDispatch → Delivering` is triggered by the courier's
pickup scan (T2) — *"usually auto-confirmed when the courier scans the order"* — or by the
kitchen's manual **Confirm Pickup** fallback. Both remove the card from the kitchen queue.

Badge tones in the design system: Received `blue` · Preparing `red-tint` ·
ReadyForDispatch `cyan` · DispatchPending `amber (warning)` · Delivering `violet` ·
Delivered `green` · DeliveryFailed `red-outline` · Cancelled `muted`.

---

## 8. Screen inventory — designed panels (27 + gallery)

**Customer (14):** `index` · `auth` (U8/U9 tabs) · `menu` · `combos` · `combo-customize` ·
`product` · `cart` · `checkout` · `order-confirmed` · `track` · `account` · `edit-profile` ·
`order-history` · `loyalty`

**Kitchen (1):** `kitchen` — reachable from the admin sidebar "Staff Views → Kitchen Queue"
(in production: the kitchen role's post-login route).

**Admin (12):** `admin-dashboard` · `admin-orders` · `admin-menu` · `admin-item-edit` ·
`admin-categories` · `admin-category-edit` · `admin-combos` · `admin-combo-edit` ·
`admin-customers` · `admin-customer-detail` · `admin-import` · `admin-reports`

**Index:** `gallery.html` — all panels by role.

---

## 9. Cross-cutting design-system notes

- Shared chrome: `assets/styles.css` (tokens, light/dark) + `assets/chrome.js`
  (nav · footer · admin sidebar · theme toggle, persisted) + `assets/data.js` (menu data).
- Customer nav: Home / Menu / **Combos** / Track Order + points badge, cart, account, theme.
- Imagery: striped placeholders throughout (drop-in real photos later); dishes support
  **multi-image** with a cover (menu cards) + gallery (customizer).
- Auth: **phone number is the sign-in identifier**; profile edit locks it (support-only change).
- 44px touch targets, visible focus, `prefers-reduced-motion` honored on pulses.

---

## 10. Known deltas / open items (deliberate or pending)

1. **Currency** — designs show `$` placeholders (client instruction); production renders
   integer VND via `formatVnd`. Single-pass swap in `data.js` + page copy.
2. **Order codes** — kitchen + admin orders use `PIZZ-XXXXXX` (v1 spec); some earlier customer
   screens still show legacy `ORD…` codes. Normalize to `PIZZ-XXXXXX` in a cleanup pass.
3. **Service-area gate (U6)** — the `OUT_OF_SERVICE_AREA` rejected-address state and disabled
   submit are specified but **not yet designed**.
4. **Error/empty/loading states** — v1's skeleton/empty/retry triad is not yet drawn per screen.
5. **Rate-limit / locked-account auth states** (429 / 403) — copy not yet designed on `auth.html`.
6. **Solo Special** — the combo customizer shows Family Feast; the 1-pizza variant reuses the
   same template (steps 1, 3→1 side, 4→1 drink).
7. **Out of scope (unchanged):** online payment, shipper portal, AI widget, native apps,
   multi-branch, live chat.
