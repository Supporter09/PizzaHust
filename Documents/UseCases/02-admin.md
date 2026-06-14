# Administration Use Cases (A1–A10)

Actor: **Admin / Store Owner** (authenticated session, role=`admin`). All admin
endpoints live under `/api/admin/` and require the admin role; all mutations carry the
CSRF double-submit token.

Status badges per `feature_list.json` (2026-06-11).

---

## A1 — Manage Pizza Catalog

**Status:** Implemented · **Actors:** Admin ·
**Extended by:** A9 (image gallery)

**Brief description.** The Admin creates, edits, activates, and deactivates dishes
(pizzas and side dishes) so the catalog reflects current offerings. Includes single
image upload and CSV bulk import.

**Preconditions.** Admin is authenticated. Target categories exist and are active.

**Basic flow of events.**

| Step | Performed by | Action |
|---|---|---|
| 1 | Admin | Opens the dish management page. |
| 2 | System | Lists dishes with kind (pizza/side), category, status, base price, and thumbnail; filterable by kind, category, and active state. |
| 3 | Admin | Creates a new dish or selects one to edit. |
| 4 | System | Displays the dish form: name, kind, category, base price, active status. (See Table A) |
| 5 | Admin | Fills the form and saves. |
| 6 | System | Validates (category must exist and be active) and persists the dish. |
| 7 | Admin | (Optional) Uploads a dish image (multipart, field `image`). |
| 8 | System | Validates extension (png/jpg/jpeg/webp) and size cap, stores the file, and sets the dish's image URL. (See Table B) |

**Alternative flows.**

| No | Location | Condition | Action | Resume location |
|---|---|---|---|---|
| 1 | Step 6 | `category_id` references a missing or inactive category (`VALIDATION_FAILED`). | System rejects the save and marks the category field. | Resumes at Step 5. |
| 2 | Step 8 | Image has a disallowed extension or exceeds the size cap. | System rejects the upload listing allowed formats. | Resumes at Step 7. |
| 3 | Step 3 | Admin deletes (deactivates) a pizza still referenced by a combo. | System returns `409 CONFLICT` listing the blocking combo names; the pizza stays active. | Resumes at Step 3 (after editing the combos, A4). |
| 4 | Step 3 | Admin runs CSV bulk import instead (`name, category_name, base_price_vnd, is_pizza`). | System upserts rows by name (idempotent re-import); rows with unknown/inactive `category_name` or non-boolean `is_pizza` are reported as per-row errors and skipped — categories are never auto-created. | Resumes at Step 2. |

**Input data (Table A).**

| No | Data field | Description | Mandatory | Valid condition | Example |
|---|---|---|---|---|---|
| 1 | Name | Dish display name. | Yes | Non-empty; unique (import upserts by name). | Spicy Pepperoni |
| 2 | Kind | Pizza or side dish. | Yes | `pizza` or `side`. | pizza |
| 3 | Category | Menu category assignment. | Yes | Existing, active category. | Main Course |
| 4 | Base price | Price before option deltas. | Yes | Integer VND ≥ 0. | 149000 |
| 5 | Active status | Visible/orderable by customers. | Yes | Active or Inactive. | Active |
| 6 | Image | Dish photo. | No | png/jpg/jpeg/webp; within size cap. | pepperoni.jpg |

**Output data (Table B).**

| No | Data field | Description | Display format | Example |
|---|---|---|---|---|
| 1 | Catalog entry | The saved dish row in the management list. | Table row: name, kind, category, status, thumbnail | Spicy Pepperoni · pizza · Main Course · Active |
| 2 | Image URL | Public URL of the uploaded image. | URL string | /images/items/42.webp |
| 3 | Import report | Per-row results of a CSV import. | Created/updated/error counts + row errors | 18 upserted, 2 skipped |

**Postconditions.** The catalog reflects the changes; active dishes are immediately
browsable (U1/U2) and orderable. Deactivation is soft (`is_active=false`) — order
history is unaffected.

---

## A2 — Manage Pizza Options and Side Dishes

**Status:** Implemented — **superseded by A8** (v2)

**Brief description.** v1 managed fixed `PizzaSize` / `PizzaCrust` / `Topping` tables
and a separate side-dish surface. The v2 generic options model (A8) replaced the fixed
tables, and side dishes merged into the unified dish surface (A1, `kind=side`). The
option-management flows now live in **A8**; side-dish flows in **A1**.

No separate specification — see A8 and A1. Retained as an index entry because the ID
appears in the original analysis catalog.

---

## A3 — Manage Menu Categories

**Status:** Implemented · **Actors:** Admin

**Brief description.** The Admin creates, renames, orders, and deactivates the menu
categories that structure browsing (U1) and scope combo choice-slots (A10).

**Preconditions.** Admin is authenticated.

**Basic flow of events.**

| Step | Performed by | Action |
|---|---|---|
| 1 | Admin | Opens the category management page. |
| 2 | System | Lists categories with name, sort order, active status, and dish count. |
| 3 | Admin | Creates, renames, reorders, or toggles a category and saves. |
| 4 | System | Validates and persists; the public menu reflects the change immediately. |

**Alternative flows.**

| No | Location | Condition | Action | Resume location |
|---|---|---|---|---|
| 1 | Step 4 | Category name duplicates an existing one. | System rejects with a uniqueness error. | Resumes at Step 3. |
| 2 | Step 3 | Admin deactivates a category that scopes a combo choice-slot (A10). | New combo saves referencing it fail validation (`slot_category_unavailable`); existing combos surface the issue on edit. | Resumes at Step 3. |
| 3 | Step 3 | Admin deactivates a category that still has active dishes. | Dishes remain active but disappear from category browsing until re-categorized; new dish saves into it are rejected (A1). | Resumes at Step 3. |

**Postconditions.** Category structure matches the admin's intent; public menu
filters update immediately.

---

## A4 — Manage Combo Campaigns

**Status:** Implemented · **Actors:** Admin ·
**Extended by:** A10 (choice-slots)

**Brief description.** The Admin creates and edits combo promotions with a price, a
validity window (e.g. lunch, dinner, weekend campaign), an optional target group size,
an image, and at least two components — fixed products and/or customer's-choice slots
(A10).

**Preconditions.** Admin is authenticated. Component products exist and are active;
slot categories are active with ≥ 1 active product.

**Basic flow of events.**

| Step | Performed by | Action |
|---|---|---|
| 1 | Admin | Opens the combo management page. |
| 2 | System | Lists combos with derived status — `Scheduled` / `Active` / `Expired` — from each validity window. |
| 3 | Admin | Creates a new combo or selects one to edit. |
| 4 | System | Displays the combo form: name, price, validity start/end, target group, components editor. (See Table A) |
| 5 | Admin | Adds ≥ 2 component units: fixed products (`product_id`, quantity) and/or choice slots (`category_id`, quantity) via A10. |
| 6 | Admin | Saves the combo. |
| 7 | System | Validates components, validity, and price; persists; computes savings shown to customers as `max(0, Σ reference parts − combo price)`. (See Table B) |
| 8 | Admin | (Optional) Uploads or clears the combo image. |

**Alternative flows.**

| No | Location | Condition | Action | Resume location |
|---|---|---|---|---|
| 1 | Step 7 | Total component quantity < 2. | System rejects: a combo needs at least 2 component units. | Resumes at Step 5. |
| 2 | Step 7 | A fixed product is missing or inactive. | System rejects with the failing product. | Resumes at Step 5. |
| 3 | Step 7 | A slot category is unavailable — inactive or without active products (`slot_category_unavailable`). | System rejects naming the category. | Resumes at Step 5. |
| 4 | Step 7 | `validity_end` < `validity_start`. | System rejects the window (equality is allowed). | Resumes at Step 4. |
| 5 | Step 7 | Combo price exceeds the sum of reference parts (over-priced). | System accepts and saves, but the editor shows a warning; customers see savings 0 (U4). | Resumes at Step 8. |

**Input data (Table A).**

| No | Data field | Description | Mandatory | Valid condition | Example |
|---|---|---|---|---|---|
| 1 | Name | Combo display name. | Yes | Non-empty. | Family Feast |
| 2 | Combo price | Bundle price charged before surcharges/options. | Yes | Integer VND ≥ 0. | 399000 |
| 3 | Validity start/end | Visibility window. | Yes | `end ≥ start`. | 2026-06-15 11:00 → 2026-06-15 14:00 |
| 4 | Target group | Intended diner count. | No | Integer ≥ 1. | 4 |
| 5 | Components | ≥ 2 units of fixed products and/or category slots. | Yes | Products active; slot categories available. | 1× slot "any large pizza", 2× Coke |
| 6 | Image | Combo photo. | No | png/jpg/jpeg/webp; within size cap. | family-feast.jpg |

**Output data (Table B).**

| No | Data field | Description | Display format | Example |
|---|---|---|---|---|
| 1 | Derived status | Scheduled / Active / Expired from the window. | Status chip | Active |
| 2 | Savings preview | Reference value minus combo price. | Currency in VND | 45,000 VND |
| 3 | Combo entry | Saved combo in the list. | Table row | Family Feast · 399,000 VND · Active |

**Postconditions.** The combo is persisted; while `Active` it is immediately visible
on the promotions page (U4) and orderable through the customizer (U15).

---

## A5 — Monitor Orders and Delivery Exceptions

**Status:** Planned · **Actors:** Admin

**Brief description.** The Admin supervises all orders across every status, cancels
orders when needed, and resolves delivery-handoff exceptions by retrying dispatch for
`DispatchPending` orders.

**Preconditions.** Admin is authenticated.

**Basic flow of events.**

| Step | Performed by | Action |
|---|---|---|
| 1 | Admin | Opens the order monitor. |
| 2 | System | Lists all orders (any status), refreshed by 15-second polling; filterable by status. Shows an alert banner whenever `DispatchPending` count > 0. |
| 3 | Admin | Opens an order to inspect detail: lines, notes, customer/recipient info, status timeline, delivery reference. |
| 4 | Admin | For a `DispatchPending` order, triggers **retry dispatch**. |
| 5 | System | Re-attempts the provider handoff (T1). On success: stores the delivery reference and advances the order to `Delivering`. |

**Alternative flows.**

| No | Location | Condition | Action | Resume location |
|---|---|---|---|---|
| 1 | Step 5 | The provider call fails again (`DELIVERY_UPSTREAM_ERROR`, 502). | System leaves the order `DispatchPending` (retryable) and keeps the alert active. | Resumes at Step 4. |
| 2 | Step 4 | Retry is triggered on an order not in `DispatchPending`. | System rejects with a wrong-state error (409). | Resumes at Step 3. |
| 3 | Step 3 | Admin cancels an order in `Received`, `Preparing`, or `DispatchPending`. | System transitions it to `Cancelled` (terminal) and releases any reserved loyalty points (U14). | Resumes at Step 2. |
| 4 | Step 3 | Admin attempts to cancel an order already `Delivering` or terminal. | System rejects — the transition is not in the state machine. | Resumes at Step 3. |

**Postconditions.** Order statuses reflect admin interventions; every transition is a
valid state-machine edge; cancelled orders release loyalty reservations.

---

## A6 — Manage Customer Accounts

**Status:** Planned · **Actors:** Admin

**Brief description.** The Admin searches customer accounts and locks or unlocks them
(e.g. abuse, repeated COD refusals). Locked customers cannot log in.

**Preconditions.** Admin is authenticated.

**Basic flow of events.**

| Step | Performed by | Action |
|---|---|---|
| 1 | Admin | Opens the customer management page. |
| 2 | System | Lists customers with pagination; searchable by full name, phone number, or email. |
| 3 | Admin | Opens a customer to view detail: profile, order summary, lock state. |
| 4 | Admin | Locks the account with an optional reason, or unlocks it. |
| 5 | System | Persists the lock state and reason. (See Table B) |

**Alternative flows.**

| No | Location | Condition | Action | Resume location |
|---|---|---|---|---|
| 1 | After Step 5 | The locked customer attempts to log in (U9). | System rejects with 403; existing sessions are not used to place new orders. | Use case ends. |
| 2 | Step 4 | The customer has in-progress orders at lock time. | System locks the account but does **not** cancel the orders — the kitchen continues processing them. | Resumes at Step 5. |
| 3 | Step 2 | Search yields no matches. | System shows an empty result state. | Resumes at Step 2. |

**Input data (Table A).**

| No | Data field | Description | Mandatory | Valid condition | Example |
|---|---|---|---|---|---|
| 1 | Search query | Name, phone, or email fragment. | No | — | 0912 |
| 2 | Lock reason | Why the account is locked. | No | Max 255 characters; nullable. | Repeated COD refusal |

**Output data (Table B).**

| No | Data field | Description | Display format | Example |
|---|---|---|---|---|
| 1 | Customer list | Paginated matching accounts. | Table: name, phone, email, status | Nguyen Van An · 0912345678 · Active |
| 2 | Lock state | Current state with reason and timestamp. | Status chip + tooltip | Locked — Repeated COD refusal |

**Postconditions.** The account's lock state is persisted and enforced at login;
in-flight orders are unaffected.

---

## A7 — View Sales and Order Reports

**Status:** Planned · **Actors:** Admin

**Brief description.** The store owner views MVP-scope business reports: revenue by
date range, order counts by status, top 10 best-selling items, and delivery
success/failure rate; aggregated by day or week, exportable as CSV.

**Preconditions.** Admin is authenticated. Orders exist in the selected range.

**Basic flow of events.**

| Step | Performed by | Action |
|---|---|---|
| 1 | Admin | Opens the reports page and selects a date range (`from`, `to`) and aggregation (day/week). |
| 2 | System | Computes and displays: revenue over time, order count by status, top 10 items by sold count, delivery success vs. failure rate. (See Table B) |
| 3 | Admin | (Optional) Exports the report as CSV (`?format=csv`). |

**Alternative flows.**

| No | Location | Condition | Action | Resume location |
|---|---|---|---|---|
| 1 | Step 2 | The range contains no orders. | System renders zeroed metrics with an empty-range note. | Resumes at Step 1. |
| 2 | Step 1 | `from` is after `to`. | System rejects the range. | Resumes at Step 1. |

**Output data (Table B).**

| No | Data field | Description | Display format | Example |
|---|---|---|---|---|
| 1 | Revenue | Total revenue per day/week bucket. | Chart + table, VND | 12,450,000 VND |
| 2 | Order counts | Orders per status in range. | Table per status | Delivered 132 · Cancelled 7 |
| 3 | Top items | 10 best sellers with counts. | Ranked list `{name, count}` | 1. Pepperoni — 86 |
| 4 | Delivery rate | Delivered vs. DeliveryFailed share. | Percentage | 95.2% success |

**Postconditions.** None (read-only). No cohort/funnel/retention analytics (out of
MVP scope).

---

## A8 — Manage Generic Option Groups (v2)

**Status:** Implemented · **Actors:** Admin · **Supersedes:** A2

**Brief description.** The Admin defines arbitrary option groups (e.g. *Sizes*,
*Crusts*, *Toppings* — rename/add/delete anytime) with options carrying a name,
description, price delta (VND), and enable toggle; then chooses per dish which options
are offered. These options power both the pizza customizer (U3) and the combo
customizer's per-pizza sub-menus (U15).

**Preconditions.** Admin is authenticated. For per-dish enablement, the dish exists.

**Basic flow of events.**

| Step | Performed by | Action |
|---|---|---|
| 1 | Admin | Opens option-group management. |
| 2 | System | Lists groups with `select_type` (`single`/`multi`), `required` flag, and sort order, each with its options. |
| 3 | Admin | Creates or edits a group (name, select type, required, sort order). (See Table A) |
| 4 | Admin | Adds or edits options in the group: name, description, price delta, sort order, enable toggle. |
| 5 | System | Validates (group name unique globally; option name unique per group; `price_delta_vnd ≥ 0`) and persists. |
| 6 | Admin | In the dish editor (A1), selects which options this dish offers (per-dish enablement, replace-set semantics). |
| 7 | System | Persists the enabled set; the dish's customizer (U2/U3) now surfaces exactly those options. (See Table B) |

**Alternative flows.**

| No | Location | Condition | Action | Resume location |
|---|---|---|---|---|
| 1 | Step 5 | Group or option name duplicates an existing one (409). | System rejects with a uniqueness error. | Resumes at Step 3 or 4. |
| 2 | Step 5 | Negative price delta (`VALIDATION_FAILED`). | System rejects the option. | Resumes at Step 4. |
| 3 | Step 3 | Admin deletes a whole group. | System cascades the delete to its options and their per-dish enablement. Order history is safe — orders store snapshots (`order_item_options`: group/option names + delta at order time). | Resumes at Step 2. |
| 4 | Step 4 | Admin disables an option in use. | Option disappears from customizers immediately; existing carts fail quote with `option_not_available` and prompt re-customization. | Resumes at Step 4. |

**Input data (Table A).**

| No | Data field | Description | Mandatory | Valid condition | Example |
|---|---|---|---|---|---|
| 1 | Group name | Option category label. | Yes | Unique globally. | Sizes |
| 2 | Select type | Single- or multi-select. | Yes | `single` or `multi`. | single |
| 3 | Required | Whether a selection is mandatory. | Yes | Boolean. | true |
| 4 | Option name | Option label. | Yes | Unique within group. | Large |
| 5 | Price delta | Surcharge added by this option. | Yes | Integer VND ≥ 0. | 40000 |
| 6 | Enabled | Whether the option is selectable. | Yes | Boolean. | true |
| 7 | Per-dish enabled set | Option IDs the dish offers. | Yes (on PUT) | Each option exists; replaces previous set. | [1, 2, 7, 9] |

**Output data (Table B).**

| No | Data field | Description | Display format | Example |
|---|---|---|---|---|
| 1 | Group tree | Groups with nested options and deltas. | Grouped list | Sizes: S +0 / M +20k / L +40k |
| 2 | Dish option view | What the customizer will show for a dish. | Chip preview | Large · Thin crust · +Cheese |

**Postconditions.** Option groups, options, and per-dish enablement are persisted;
customizers (U3/U15) and quote validation reflect them immediately; price deltas are
shared across dishes while availability stays per-dish.

---

## A9 — Manage Dish Image Gallery (v2)

**Status:** Planned · **Actors:** Admin · **Extends:** A1

**Brief description.** A dish carries up to 8 images with one designated **cover**.
Menu cards and combo views render only the cover; the gallery appears on the item
detail page (U2) and in the admin editor.

**Preconditions.** Admin is authenticated; the dish exists.

**Basic flow of events.**

| Step | Performed by | Action |
|---|---|---|
| 1 | Admin | Opens a dish's image gallery in the dish editor (A1). |
| 2 | System | Shows current images with the cover flagged. |
| 3 | Admin | Uploads additional images (multipart), deletes images, or sets a different cover. |
| 4 | System | Validates each file (extension allowlist, size cap, ≤ 8 images per dish) and persists; read paths keep exposing the single cover URL plus `images[]`. |

**Alternative flows.**

| No | Location | Condition | Action | Resume location |
|---|---|---|---|---|
| 1 | Step 4 | Upload would exceed 8 images. | System rejects the upload until one is deleted. | Resumes at Step 3. |
| 2 | Step 4 | File fails extension/size validation. | System rejects that file with the allowed formats. | Resumes at Step 3. |
| 3 | Step 3 | Admin deletes the cover image. | System requires choosing a new cover (or promotes the next image). | Resumes at Step 3. |

**Postconditions.** The dish has ≤ 8 images with exactly one cover; menu/combo cards
render the cover; the detail page renders the gallery.

---

## A10 — Configure Combo Choice-Slots (v2)

**Status:** Implemented · **Actors:** Admin · **Extends:** A4

**Brief description.** Inside the combo editor (A4), the Admin builds the component
list from two kinds: **fixed products** and **customer's-choice slots** scoped to a
category (e.g. "any large pizza"). Slots are resolved by the customer at order time
(U15); each pick pays a surcharge above the category's reference price.

**Preconditions.** Admin is authenticated and editing a combo (A4). Slot categories
are active with ≥ 1 active product.

**Basic flow of events.**

| Step | Performed by | Action |
|---|---|---|
| 1 | Admin | In the combo components editor, adds a component and chooses its kind: fixed product or category slot. |
| 2 | Admin | For a fixed product: picks the product and quantity. For a slot: picks the scope category and quantity. (See Table A) |
| 3 | System | For each slot, derives the reference price = minimum active product base price in the category, and previews per-product surcharges (`max(0, base − reference)`). |
| 4 | Admin | Saves the combo (continues A4 Step 6). |
| 5 | System | Validates kind-specific rules and persists components; public combo detail exposes eligible slot products and surcharges to the customizer (U15). (See Table B) |

**Alternative flows.**

| No | Location | Condition | Action | Resume location |
|---|---|---|---|---|
| 1 | Step 5 | Slot category inactive or empty of active products (`slot_category_unavailable`). | System rejects naming the category. | Resumes at Step 2. |
| 2 | Step 5 | Fixed product missing or inactive. | System rejects naming the product. | Resumes at Step 2. |
| 3 | Step 5 | Wrong fields for the declared kind (e.g. `product_id` on a category slot). | System rejects as a schema validation failure. | Resumes at Step 2. |
| 4 | After save | The cheapest product in a slot category is later deactivated. | The reference price re-derives from the remaining active products; surcharges shift accordingly at quote time. | Use case ends. |

**Input data (Table A).**

| No | Data field | Description | Mandatory | Valid condition | Example |
|---|---|---|---|---|---|
| 1 | Component kind | Fixed product or category slot. | Yes | `product` or `category`. | category |
| 2 | Product | The fixed product (kind=product). | Yes for kind=product | Existing, active. | Coca-Cola 1.5L |
| 3 | Slot category | Scope of customer choice (kind=category). | Yes for kind=category | Active category with ≥ 1 active product. | Large Pizzas |
| 4 | Quantity | Units of this component per combo. | Yes | Integer ≥ 1; combo total ≥ 2 across components. | 2 |

**Output data (Table B).**

| No | Data field | Description | Display format | Example |
|---|---|---|---|---|
| 1 | Component list | Saved components with kinds and quantities. | Editor list | 2× slot: Large Pizzas · 2× Coca-Cola |
| 2 | Reference price | Cheapest active product per slot category. | Currency in VND | 149,000 VND |
| 3 | Surcharge preview | Per-product surcharge within each slot. | Currency in VND per product | Pepperoni +46,000 VND |

**Postconditions.** The combo's components (fixed + slots) are persisted; the public
combo API and cart quote resolve slot picks and surcharges server-side; order
persistence of resolved configurations belongs to U6/U15.
