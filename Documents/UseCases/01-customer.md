# Customer Ordering Use Cases (U1–U16)

Actors: **Guest** (anonymous visitor) and **Customer** (registered, role=`customer`).
Customer inherits all Guest capabilities. `U10` is reserved (deferred AI recommendation).

Conventions: "User" in a flow means Guest or Customer. Flows marked *Customer only*
require an authenticated session. Status badges per `feature_list.json` (2026-06-11).

---

## U1 — Browse Menus

**Status:** Implemented · **Actors:** Guest, Customer

**Brief description.** The user views the menu of active dishes, organized by menu
categories, to find something to order.

**Preconditions.** None. The system has at least one active category with active dishes
(seeded by the store).

**Basic flow of events.**

| Step | Performed by | Action |
|---|---|---|
| 1 | User | Opens the menu page. |
| 2 | System | Retrieves active categories and displays them as filter tabs. |
| 3 | System | Displays active dishes as menu cards (cover image, name, base price in VND). |
| 4 | User | Selects a category filter. |
| 5 | System | Displays only the active dishes of the selected category. |

**Alternative flows.**

| No | Location | Condition | Action | Resume location |
|---|---|---|---|---|
| 1 | Step 5 | The selected category has no active dishes. | System shows an empty-category message. | Resumes at Step 4. |
| 2 | Any step | Catalog request fails (network/server error). | System shows an error state with a retry control. | Resumes at Step 1. |

**Postconditions.** None (read-only). The user can proceed to U2 (item details) or U4
(combo promotions).

---

## U2 — View Item Details

**Status:** Implemented · **Actors:** Guest, Customer

**Brief description.** The user opens a dish's detail page to see its images, price,
and — for pizzas — the option groups available for customization.

**Preconditions.** The dish exists and is active.

**Basic flow of events.**

| Step | Performed by | Action |
|---|---|---|
| 1 | User | Selects a dish from the menu (U1). |
| 2 | System | Retrieves the item detail, including the option groups enabled for this dish (sizes, crusts, toppings, or any admin-defined group). |
| 3 | System | Displays name, cover image, base price, and the customizer entry point for pizzas. (The multi-image gallery arrives with A9 — planned.) |
| 4 | User | Reviews the details and proceeds to customize (U3) or add to cart (U5). |

**Alternative flows.**

| No | Location | Condition | Action | Resume location |
|---|---|---|---|---|
| 1 | Step 2 | The dish was deactivated after the menu page loaded. | System shows a "no longer available" message and links back to the menu. | Use case ends. |
| 2 | Step 3 | The dish is a side dish (no option groups). | System hides the customizer and offers direct add-to-cart. | Resumes at Step 4. |

**Postconditions.** None (read-only).

---

## U3 — Customize Pizza

**Status:** Implemented · **Actors:** Guest, Customer ·
**Includes:** U3.1 Select Pizza Size, U3.2 Select Crust Type ·
**Extended by:** U3.3 Add Extra Toppings, U16 (per-dish note)

**Brief description.** The user configures a pizza through the admin-defined option
groups (e.g. *Sizes*, *Crusts*, *Toppings*) before adding it to the cart. The live
total always comes from the server quote — the frontend never computes prices.

**Preconditions.** The pizza is active and has at least its required option groups
enabled (a `single`-select required group, such as size, must be chosen).

**Basic flow of events.**

| Step | Performed by | Action |
|---|---|---|
| 1 | User | Opens the customizer from the item detail page (U2). |
| 2 | System | Displays the dish's enabled option groups as chips with name and price delta (VND); disabled options are hidden. |
| 3 | User | Selects a pizza size (U3.1) — required, single-select. |
| 4 | User | Selects a crust type (U3.2) — single-select; crusts may carry a price delta. |
| 5 | User | (Optional) Adds extra toppings (U3.3) — multi-select, each with its price delta. |
| 6 | User | (Optional, *U16 — planned*) Enters a dish note for the kitchen, e.g. "no onions". |
| 7 | System | Calls `POST /api/cart/quote` in preview mode (no address) with the configured line and displays the returned line total. (See Table A / Table B) |
| 8 | User | Confirms the configuration and adds the line to the cart (U5). |

**Alternative flows.**

| No | Location | Condition | Action | Resume location |
|---|---|---|---|---|
| 1 | Step 7 | A selected option is not enabled for this dish (`option_not_available`). | System rejects the quote, highlights the invalid option, and refreshes the option list. | Resumes at Step 2. |
| 2 | Step 7 | A required group has no selection (`required_group_missing`). | System marks the group as required and blocks add-to-cart. | Resumes at Step 3. |
| 3 | Step 7 | Two options of a single-select group are selected (`single_group_conflict`). | System keeps only the last selection and re-quotes. | Resumes at Step 7. |
| 4 | Step 7 | Duplicate option IDs are submitted (e.g. double-click). | System deduplicates them server-side; the option is never double-charged. | Resumes at Step 7. |
| 5 | Any step | The dish becomes inactive during customization. | System shows a "no longer available" message. | Use case ends. |

**Input data (Table A).**

| No | Data field | Description | Mandatory | Valid condition | Example |
|---|---|---|---|---|---|
| 1 | Size option | One option from the required single-select size group. | Yes | Enabled for this dish; exactly one per single group. | Large |
| 2 | Crust option | One option from the crust group. | Yes (if group required) | Enabled for this dish. | Thin crust |
| 3 | Topping options | Zero or more options from multi-select groups. | No | Each enabled for this dish; no duplicates after dedupe. | Extra cheese, Mushroom |
| 4 | Dish note | Free-text note to the kitchen for this dish (U16 — planned, not in the implemented customizer yet). | No | Max 255 characters. | No onions, please |
| 5 | Quantity | Number of units of this configured line. | Yes | Integer ≥ 1. | 2 |

**Output data (Table B).**

| No | Data field | Description | Display format | Example |
|---|---|---|---|---|
| 1 | Line total | Server-computed price: base + sum of option deltas, × quantity. | Currency in VND | 195,000 VND |
| 2 | Selected options | The chosen option names grouped by option group. | Chip list under the dish | Large · Thin crust · Extra cheese |

**Postconditions.** A fully configured pizza line (item, options, note, quantity) is
ready to be added to the cart; no order data is persisted yet.

---

## U4 — View Combo Promotions

**Status:** Implemented · **Actors:** Guest, Customer · **Extended by:** U15

**Brief description.** The user views the combo promotions currently available for the
present time window, with their components, price, and savings versus buying the parts
separately.

**Preconditions.** At least one combo is `Active` (current time inside its validity
window).

**Basic flow of events.**

| Step | Performed by | Action |
|---|---|---|
| 1 | User | Opens the combos page. |
| 2 | System | Retrieves combos whose validity window covers the current time and displays each with image, name, components, price, and computed savings (`max(0, Σ component reference prices − combo price)`). |
| 3 | User | Opens a combo to see its detail: fixed components and customer's-choice slots (e.g. "any large pizza"). |
| 4 | User | Proceeds to customize and order the combo (U15 — planned; combos are view-only until U15 ships). |

**Alternative flows.**

| No | Location | Condition | Action | Resume location |
|---|---|---|---|---|
| 1 | Step 2 | No combo is active in the current time window. | System shows an empty state with upcoming (`Scheduled`) combos hidden. | Use case ends. |
| 2 | Step 2 | A combo is over-priced (price > sum of reference parts). | System still lists it (accepted by design) and shows savings as 0. | Resumes at Step 3. |
| 3 | Step 3 | The combo expires while the user is viewing it. | On the next interaction the system reports the combo is no longer active. | Use case ends. |

**Postconditions.** None (read-only).

---

## U5 — Manage Cart

**Status:** Planned · **Actors:** Guest, Customer

**Brief description.** The user reviews and edits the shopping cart: configured pizza
lines, combo lines, side dishes, quantities, and per-dish notes. The cart is
session-bound for a Guest and account-bound for a Customer.

**Preconditions.** None to view; at least one line for edits to be meaningful.

**Basic flow of events.**

| Step | Performed by | Action |
|---|---|---|
| 1 | User | Opens the cart page. |
| 2 | System | Displays each line — dish or combo — with its selected options, dish note, quantity, and server-quoted line total. |
| 3 | User | Changes a line's quantity, edits its configuration (reopens U3/U15), or removes it. |
| 4 | System | Re-quotes the cart via `POST /api/cart/quote` (preview mode, no address) and refreshes subtotal and combo discounts. (See Table B) |
| 5 | User | Proceeds to checkout (U6). |

**Alternative flows.**

| No | Location | Condition | Action | Resume location |
|---|---|---|---|---|
| 1 | Step 4 | A line's dish or combo was deactivated since it was added. | System flags the line as unavailable and excludes it from the quote until removed. | Resumes at Step 3. |
| 2 | Step 4 | A line's option is no longer enabled for the dish. | System rejects the quote for that line (`option_not_available`) and prompts the user to re-customize. | Resumes at Step 3 (reopens U3). |
| 3 | Step 5 | The cart is empty. | System disables checkout. | Resumes at Step 1. |
| 4 | Step 1 | A Guest logs in mid-session (U9). | System carries the session cart over to the account-bound cart. | Resumes at Step 1. |

**Input data (Table A).**

| No | Data field | Description | Mandatory | Valid condition | Example |
|---|---|---|---|---|---|
| 1 | Quantity | New quantity for a cart line. | Yes (on change) | Integer ≥ 1; removal is an explicit action. | 3 |
| 2 | Line selection | Which cart line an edit/remove applies to. | Yes | Existing line in this cart. | Line 2 (Combo "Family Feast") |

**Output data (Table B).**

| No | Data field | Description | Display format | Example |
|---|---|---|---|---|
| 1 | Line totals | Server-quoted price per line. | Currency in VND per line | 390,000 VND |
| 2 | Subtotal | Sum of line values before delivery fee. | Currency in VND | 585,000 VND |
| 3 | Combo discount | Accumulated combo savings across combo lines. | Currency in VND (negative) | −45,000 VND |

**Postconditions.** The cart reflects the user's edits; pricing shown equals the
server quote. No order exists yet.

---

## U6 — Place COD Order

**Status:** Planned · **Actors:** Guest, Customer ·
**Includes:** U6.1 Provide Delivery Information, U6.2 Review and Confirm Order ·
**Extended by:** U14 (redeem points), U16 (delivery note)

**Brief description.** The user submits the cart as a cash-on-delivery order with
delivery to an inner-Hanoi address. The system validates the address against the
service-area whitelist, persists the order (including resolved combo configurations),
generates an order code, and places the order in the kitchen queue.

**Preconditions.** The cart contains at least one valid line. For loyalty redemption
(U14) the user must be an authenticated Customer.

**Basic flow of events.**

| Step | Performed by | Action |
|---|---|---|
| 1 | User | Proceeds to checkout from the cart (U5). |
| 2 | System | Displays the delivery information form (U6.1). |
| 3 | User | Enters recipient name, phone number, delivery address (ward selection), and an optional delivery note for the courier (U16). (See Table A) |
| 4 | System | Validates the ward against the 51-ward inner-Hanoi whitelist, then re-quotes the cart with the address: subtotal, combo discount, delivery fee 22,000 VND, total. The submit control stays disabled until the address validates. |
| 5 | Customer | (Optional, *extension point* U14) Redeems loyalty points for a discount. |
| 6 | User | Reviews the order summary (U6.2) and confirms cash on delivery. |
| 7 | System | Re-validates lines (availability, option rules, combo selections) and the address server-side. |
| 8 | System | Creates the order (status `Received`, promised time = now + 45 min), persists all lines with option snapshots and resolved combo picks, reserves any redeemed points, and generates a unique order code `PIZZ-XXXXXX`. (See Table B) |
| 9 | System | Shows the confirmation page with the order code and tracking link; the order appears in the kitchen queue (K1). |

**Alternative flows.**

| No | Location | Condition | Action | Resume location |
|---|---|---|---|---|
| 1 | Step 4 | The address's ward is outside the service area (`OUT_OF_SERVICE_AREA`). | System rejects the address and keeps submission disabled. | Resumes at Step 3. |
| 2 | Step 3 | Recipient phone number is not a valid Vietnamese mobile number. | System highlights the field with a validation error. | Resumes at Step 3. |
| 3 | Step 7 | A cart line's dish/combo became unavailable. | System reports the failing line and returns to the cart for correction. | Resumes at Step 1 (after U5 fix). |
| 4 | Step 7 | Redeemed points exceed the balance or the 50% cap (`INSUFFICIENT_LOYALTY`). | System rejects the redemption and recalculates without it. | Resumes at Step 5. |
| 5 | Step 8 | Order-code collision on generation. | System retries generation (max 3 attempts) transparently. | Resumes at Step 8. |
| 6 | Step 8 | Persistence fails (server error). | System shows an error; no order is created; the cart is preserved. | Resumes at Step 6. |

**Input data (Table A).**

| No | Data field | Description | Mandatory | Valid condition | Example |
|---|---|---|---|---|---|
| 1 | Recipient name | Full name of the delivery recipient. | Yes | Non-empty; max 100 characters. | Nguyen Van An |
| 2 | Phone number | Recipient contact number. | Yes | Vietnamese mobile format (10 digits, starts 03/05/07/08/09). | 0912345678 |
| 3 | Delivery address | Street address + ward within inner Hanoi. | Yes | Ward in the 51-ward post-2025 whitelist. | 15 Tran Hung Dao, Cua Nam ward, Hanoi |
| 4 | Delivery note | Instructions for the courier (U16) — per order, never shown to the kitchen during prep. | No | Max 255 characters. | Leave at reception desk |
| 5 | Redeemed points | Loyalty points to redeem (U14, Customer only). | No | ≤ balance; discount ≤ 50% of subtotal after combo. | 50 |

**Output data (Table B).**

| No | Data field | Description | Display format | Example |
|---|---|---|---|---|
| 1 | Order code | Unique tracking code. | `PIZZ-` + 6 Crockford base32 chars (no I/L/O/U) | PIZZ-7K3M9X |
| 2 | Order summary | Lines with options, notes, and resolved combo picks. | Itemized list with subtotals | Pepperoni L, thin crust ×1 — 195,000 VND |
| 3 | Delivery fee | Flat inner-Hanoi fee. | Currency in VND | 22,000 VND |
| 4 | Loyalty discount | Applied redemption discount, if any. | Currency in VND (negative) | −50,000 VND |
| 5 | Grand total | Final COD amount. | Currency in VND | 412,000 VND |

**Postconditions.** An order exists with status `Received`, a unique order code, and a
45-minute promised time; redeemed points are reserved; the order is visible in the
kitchen queue (K1) and to the admin monitor (A5).

---

## U7 — Track Order

**Status:** Planned · **Actors:** Guest, Customer ·
**Includes:** U7.1 Synchronize Delivery Status (→ T2)

**Brief description.** The user follows an order's progress. A Guest tracks by order
code and sees a privacy-minimal projection; an authenticated Customer sees full detail
for orders on their own account. Status freshness comes from polling, with delivery
states synchronized from the provider via T2 webhooks.

**Preconditions.** The order exists. Guest tracking requires the order code.

**Basic flow of events.**

| Step | Performed by | Action |
|---|---|---|
| 1 | User | Opens the tracking page and enters the order code (or follows the link from the confirmation page / order history). |
| 2 | System | Rate-limits the lookup (5/min/IP), resolves the code, and returns the tracking projection: status, status timeline, recipient first name, last 4 phone digits, masked address. For the customer's own order the view also carries the delivery note (U16 — v2 design; the conditional contract field is pending, see CONTRACTS.md "v2 Planned Deltas"). (See Table B) |
| 3 | System | Displays the status timeline (`Received → Preparing → ReadyForDispatch → Delivering → Delivered`) with timestamps and the promised time. |
| 4 | System | Polls for updates; delivery-phase changes (Delivering, Delivered, DeliveryFailed) arrive via U7.1/T2 webhook synchronization. |
| 5 | User | Closes the page once the order reaches a terminal state. |

**Alternative flows.**

| No | Location | Condition | Action | Resume location |
|---|---|---|---|---|
| 1 | Step 2 | The order code does not exist. | System shows "order not found" without leaking whether the code format was close. | Resumes at Step 1. |
| 2 | Step 2 | The IP exceeds 5 lookups/minute. | System rejects with a rate-limit message and a retry-after hint. | Resumes at Step 1 (after waiting). |
| 3 | Step 4 | The order becomes `DeliveryFailed`. | System displays the failure state and advises contacting the store. | Use case ends. |
| 4 | Step 4 | The order is `Cancelled` by the admin (A5). | System displays the cancelled state; reserved points (if any) are released. | Use case ends. |
| 5 | Step 1 | An authenticated Customer opens an order belonging to another account. | System denies full detail; only code-based minimal tracking is available. | Resumes at Step 1. |

**Input data (Table A).**

| No | Data field | Description | Mandatory | Valid condition | Example |
|---|---|---|---|---|---|
| 1 | Order code | The tracking identifier. | Yes (guest path) | Format `PIZZ-` + 6 valid chars. | PIZZ-7K3M9X |

**Output data (Table B).**

| No | Data field | Description | Display format | Example |
|---|---|---|---|---|
| 1 | Status | Current order state. | Status label | Delivering |
| 2 | Status timeline | Ordered state changes with timestamps. | Vertical timeline | Received 18:02 → Preparing 18:05 |
| 3 | Recipient | Privacy-masked recipient info. | First name + last 4 phone digits + masked address | An · ****5678 · Tran Hung Dao, C*** N*** |
| 4 | Promised time | Expected delivery time. | HH:MM | 18:47 |

**Postconditions.** None (read-only).

---

## U8 — Register

**Status:** Planned · **Actors:** Guest

**Brief description.** A Guest creates a Customer account. The phone number is the
sign-in identifier; email is not collected.

**Preconditions.** The visitor has no active session. Registration is rate-limited
5 requests/minute/IP.

**Basic flow of events.**

| Step | Performed by | Action |
|---|---|---|
| 1 | Guest | Opens the registration page. |
| 2 | System | Displays the registration form. (See Table A) |
| 3 | Guest | Enters full name, phone number, password, and address, then submits. |
| 4 | System | Validates the fields and checks phone-number uniqueness. |
| 5 | System | Hashes the password (argon2id), creates the customer account, starts a session (httpOnly signed cookie + CSRF token). (See Table B) |
| 6 | System | Redirects to the menu with the user logged in; any session cart is carried over to the account. |

**Alternative flows.**

| No | Location | Condition | Action | Resume location |
|---|---|---|---|---|
| 1 | Step 4 | Phone number is already registered. | System shows a "phone already in use" error. | Resumes at Step 3. |
| 2 | Step 4 | Password fails the strength policy. | System highlights the password requirements. | Resumes at Step 3. |
| 3 | Step 3 | The IP exceeds 5 registration attempts/minute. | System rejects with a rate-limit error. | Resumes at Step 3 (after waiting). |

**Input data (Table A).**

| No | Data field | Description | Mandatory | Valid condition | Example |
|---|---|---|---|---|---|
| 1 | Full name | Customer's display name. | Yes | Non-empty; max 100 characters. | Nguyen Van An |
| 2 | Phone number | Sign-in identifier; immutable after registration. | Yes | Vietnamese mobile format; unique. | 0912345678 |
| 3 | Password | Account password. | Yes | Meets strength policy. | ******** |
| 4 | Address | Default delivery address. | Yes | Non-empty. | 15 Tran Hung Dao, Cua Nam ward, Hanoi |

**Output data (Table B).**

| No | Data field | Description | Display format | Example |
|---|---|---|---|---|
| 1 | Session | Authenticated session established. | httpOnly signed cookie (not displayed) | — |
| 2 | Profile summary | The created account's name shown in the header. | Text in navigation bar | Hi, An |

**Postconditions.** A customer account exists (role=`customer`, loyalty balance 0);
the user is authenticated.

---

## U9 — Log In

**Status:** Planned · **Actors:** Customer

**Brief description.** A registered Customer signs in with phone number and password
to access account features (history, profile, loyalty).

**Preconditions.** The account exists and is not locked. Login is rate-limited
5 requests/minute/IP.

**Basic flow of events.**

| Step | Performed by | Action |
|---|---|---|
| 1 | Customer | Opens the login page and enters phone number and password. (See Table A) |
| 2 | System | Verifies credentials against the stored argon2id hash. |
| 3 | System | Starts a session (httpOnly signed cookie, role=`customer`, CSRF token). (See Table B) |
| 4 | System | Merges the guest session cart (if any) into the account cart and redirects to the previous page. |

**Alternative flows.**

| No | Location | Condition | Action | Resume location |
|---|---|---|---|---|
| 1 | Step 2 | Credentials are invalid. | System shows a generic "invalid phone or password" error (no field-level hint). | Resumes at Step 1. |
| 2 | Step 2 | The account is locked by the admin (A6). | System rejects with 403 and a "contact the store" message. | Use case ends. |
| 3 | Step 1 | The IP exceeds 5 login attempts/minute. | System rejects with a rate-limit error. | Resumes at Step 1 (after waiting). |

**Input data (Table A).**

| No | Data field | Description | Mandatory | Valid condition | Example |
|---|---|---|---|---|---|
| 1 | Phone number | Sign-in identifier. | Yes | Registered number. | 0912345678 |
| 2 | Password | Account password. | Yes | Matches stored hash. | ******** |

**Output data (Table B).**

| No | Data field | Description | Display format | Example |
|---|---|---|---|---|
| 1 | Session | Authenticated session. | httpOnly signed cookie (not displayed) | — |
| 2 | Profile summary | Account name + loyalty balance in the header. | Text in navigation bar | Hi, An · 120 pts |

**Postconditions.** The Customer is authenticated; subsequent mutating requests carry
the CSRF double-submit token.

---

## U11 — View Order History

**Status:** Planned · **Actors:** Customer

**Brief description.** An authenticated Customer lists their past and in-progress
orders and opens full order details.

**Preconditions.** Customer is logged in (U9).

**Basic flow of events.**

| Step | Performed by | Action |
|---|---|---|
| 1 | Customer | Opens the order history page. |
| 2 | System | Lists the account's orders, newest first: code, date, status, total. |
| 3 | Customer | Opens one order. |
| 4 | System | Displays full detail: all lines with options and dish notes, delivery info, delivery note, status timeline, totals, and loyalty points earned/redeemed. |
| 5 | Customer | (Optional) Jumps to live tracking (U7) for an in-progress order. |

**Alternative flows.**

| No | Location | Condition | Action | Resume location |
|---|---|---|---|---|
| 1 | Step 2 | The account has no orders. | System shows an empty state linking to the menu. | Use case ends. |
| 2 | Step 3 | The order ID belongs to a different account. | System denies access (404/403). | Resumes at Step 2. |

**Postconditions.** None (read-only).

---

## U12 — Manage Profile

**Status:** Planned · **Actors:** Customer

**Brief description.** An authenticated Customer edits their profile: full name and
default address, plus (v2) avatar upload and password change. The phone number is the
locked sign-in identifier and cannot be changed.

> Endpoint design for avatar and password change is pending (CONTRACTS.md "v2 Planned
> Deltas"); the current `PATCH /api/auth/me` covers `full_name` / `address` only.

**Preconditions.** Customer is logged in (U9).

**Basic flow of events.**

| Step | Performed by | Action |
|---|---|---|
| 1 | Customer | Opens the profile page. |
| 2 | System | Displays current profile: avatar, full name, phone (read-only), address. |
| 3 | Customer | Edits full name and/or address and saves. (See Table A) |
| 4 | System | Validates and persists the changes; confirms inline. |
| 5 | Customer | (Optional) Uploads a new avatar image. |
| 6 | System | Validates the image (allowed type/size), stores it, and refreshes the avatar. |
| 7 | Customer | (Optional) Opens the password-change form, enters current and new password, and confirms. |
| 8 | System | Verifies the current password, applies the new hash, and confirms. (See Table B) |

**Alternative flows.**

| No | Location | Condition | Action | Resume location |
|---|---|---|---|---|
| 1 | Step 4 | A field fails validation (e.g. empty name). | System highlights the field. | Resumes at Step 3. |
| 2 | Step 6 | Avatar file exceeds size cap or has a disallowed extension. | System rejects the upload with the allowed formats. | Resumes at Step 5. |
| 3 | Step 8 | Current password is wrong. | System rejects the change without revealing more. | Resumes at Step 7. |
| 4 | Step 8 | New password fails the strength policy. | System highlights the requirements. | Resumes at Step 7. |

**Input data (Table A).**

| No | Data field | Description | Mandatory | Valid condition | Example |
|---|---|---|---|---|---|
| 1 | Full name | Display name. | Yes | Non-empty; max 100 characters. | Nguyen Van An |
| 2 | Address | Default delivery address. | Yes | Non-empty. | 15 Tran Hung Dao, Cua Nam ward, Hanoi |
| 3 | Avatar image | Profile picture (v2). | No | png/jpg/jpeg/webp; within size cap. | avatar.jpg |
| 4 | Current password | Required for password change (v2). | Yes (for change) | Matches stored hash. | ******** |
| 5 | New password | Replacement password (v2). | Yes (for change) | Meets strength policy; ≠ current. | ******** |

**Output data (Table B).**

| No | Data field | Description | Display format | Example |
|---|---|---|---|---|
| 1 | Updated profile | The saved profile values. | Profile form refreshed | — |
| 2 | Confirmation | Success notification per action. | Inline banner | Password updated. |

**Postconditions.** Profile changes are persisted; a password change takes effect for
subsequent logins; the phone number is unchanged.

---

## U13 — View Loyalty Points

**Status:** Planned · **Actors:** Customer

**Brief description.** An authenticated Customer views their loyalty balance and how
points are earned and spent.

**Preconditions.** Customer is logged in (U9).

**Basic flow of events.**

| Step | Performed by | Action |
|---|---|---|
| 1 | Customer | Opens the loyalty page (or sees the balance in the header). |
| 2 | System | Displays the current balance and the rules: earn 1 point per 10,000 VND of subtotal after discounts (credited on `Delivered`); redeem 1 point = 1,000 VND, up to 50% of the subtotal after combo discounts. |
| 3 | System | Shows pending points: reservations held by in-progress orders (redeemed but not yet consumed). |

**Alternative flows.**

| No | Location | Condition | Action | Resume location |
|---|---|---|---|---|
| 1 | Step 2 | Balance is 0 with no history. | System shows the earning rules as an empty-state explainer. | Use case ends. |

**Postconditions.** None (read-only).

---

## U14 — Redeem Points for Discount

**Status:** Planned · **Actors:** Customer · **Extends:** U6 (at Step 5)

**Brief description.** During checkout, an authenticated Customer converts loyalty
points into an order discount. Redeemed points are reserved until the order completes.

**Preconditions.** Customer is logged in with balance > 0; checkout (U6) has a valid
quoted cart.

**Basic flow of events.**

| Step | Performed by | Action |
|---|---|---|
| 1 | Customer | At U6 Step 5, opens the redemption control showing the available balance. |
| 2 | Customer | Enters the number of points to redeem. (See Table A) |
| 3 | System | Validates: points ≤ balance, and discount (points × 1,000 VND) ≤ 50% of the subtotal after combo discounts. |
| 4 | System | Re-quotes the order with `discount_loyalty` applied and shows the reduced total. (See Table B) |
| 5 | Customer | Continues checkout (returns to U6 Step 6). |

**Alternative flows.**

| No | Location | Condition | Action | Resume location |
|---|---|---|---|---|
| 1 | Step 3 | Points exceed the balance (`INSUFFICIENT_LOYALTY`). | System rejects and shows the maximum redeemable amount. | Resumes at Step 2. |
| 2 | Step 3 | Discount would exceed the 50% cap. | System clamps the input to the cap and explains the rule. | Resumes at Step 2. |
| 3 | After U6 | The order is cancelled or delivery fails. | System releases the reserved points back to the balance. | Use case ends. |
| 4 | After U6 | The order reaches `Delivered`. | System consumes the reserved points permanently. | Use case ends. |

**Input data (Table A).**

| No | Data field | Description | Mandatory | Valid condition | Example |
|---|---|---|---|---|---|
| 1 | Points to redeem | Number of loyalty points to convert. | Yes | Integer ≥ 1; ≤ balance; discount ≤ 50% of subtotal after combo. | 50 |

**Output data (Table B).**

| No | Data field | Description | Display format | Example |
|---|---|---|---|---|
| 1 | Loyalty discount | Applied discount amount. | Currency in VND (negative) | −50,000 VND |
| 2 | New total | Order total after redemption. | Currency in VND | 412,000 VND |
| 3 | Remaining balance | Points left after reservation. | Integer | 70 pts |

**Postconditions.** The order quote includes the loyalty discount; on order creation
the points are reserved (consumed on `Delivered`, released on `Cancelled` /
`DeliveryFailed`).

---

## U15 — Customize Combo (v2)

**Status:** Planned · **Actors:** Guest, Customer · **Extends:** U4

**Brief description.** The user makes a combo orderable by resolving each
customer's-choice slot to a concrete product and configuring each pizza in the combo
(crust, extra toppings) through the same option chips as U3. Premium picks and options
add to the combo total.

**Preconditions.** The combo is `Active`. Every slot's category has at least one
active product.

**Basic flow of events.**

| Step | Performed by | Action |
|---|---|---|
| 1 | User | Opens the combo customizer from the combo detail (U4). |
| 2 | System | Displays each component: fixed products as locked entries; choice slots with the eligible products of the slot's category and each pick's surcharge (`max(0, pick base − category reference price)`, reference = cheapest active product in the category). |
| 3 | User | Resolves each choice slot by picking a product (one configured pick per unit of component quantity). |
| 4 | User | Configures each pizza in the combo: crust and extra toppings via its enabled option chips; (optional) adds a per-dish note (U16). |
| 5 | System | Quotes the combo line via `POST /api/cart/quote`: charged total = combo price + surcharges + option deltas per unit; savings shown = `max(0, full reference value − charged)`. (See Table B) |
| 6 | User | Confirms the configuration; the resolved combo line is ready to be added to the cart (U5 — planned). |

**Alternative flows.**

| No | Location | Condition | Action | Resume location |
|---|---|---|---|---|
| 1 | Step 5 | A slot has no selection (`component_selection_missing`). | System marks the unresolved slot and blocks add-to-cart. | Resumes at Step 3. |
| 2 | Step 5 | Pick count ≠ component quantity (`pick_count_mismatch`). | System shows how many picks are still needed. | Resumes at Step 3. |
| 3 | Step 5 | A picked product is outside the slot's category (`product_not_in_slot_category`). | System rejects the pick and refreshes eligible products. | Resumes at Step 3. |
| 4 | Step 5 | A pick's option violates option rules (e.g. `option_not_available`). | System highlights the offending pizza configuration. | Resumes at Step 4. |
| 5 | Step 5 | The combo left its validity window (`combo_not_active`). | System reports the combo is no longer active. | Use case ends. |
| 6 | Step 2 | The combo is over-priced versus its parts. | System shows a "no savings" warning but still allows ordering (accepted by design). | Resumes at Step 3. |

**Input data (Table A).**

| No | Data field | Description | Mandatory | Valid condition | Example |
|---|---|---|---|---|---|
| 1 | Slot picks | One product per unit of each choice-slot component. | Yes | Product active and in the slot's category; count = component quantity. | Pepperoni (slot: any large pizza) |
| 2 | Pizza options | Crust/topping options per configured pizza. | Per group rules | Enabled for that dish; group rules hold. | Thin crust, Extra cheese |
| 3 | Dish notes | Per-dish kitchen note (U16). | No | Max 255 characters. | Cut in 8 slices |
| 4 | Quantity | Number of fully configured combo units. | Yes | Integer ≥ 1. | 1 |

**Output data (Table B).**

| No | Data field | Description | Display format | Example |
|---|---|---|---|---|
| 1 | Charged total | Combo price + surcharges + option deltas, × quantity. | Currency in VND | 365,000 VND |
| 2 | Savings | Reference value minus charged amount (≥ 0). | Currency in VND | 45,000 VND |
| 3 | Resolved configuration | Slot picks and per-pizza options. | Nested list under the combo line | Slot 1: Pepperoni L (thin crust) |

**Postconditions.** A fully resolved, server-quoted combo line is ready to be added
to the cart (cart persistence ships with U5); order persistence of the resolved
configuration happens at U6.

---

## U16 — Add Order Notes (v2)

**Status:** Planned · **Actors:** Guest, Customer · **Extends:** U3/U15 (dish note), U6 (delivery note)

**Brief description.** The user attaches free-text notes to an order. Two distinct
notes, never conflated: a **dish note** (per dish, written in the customizer, read by
the kitchen) and a **delivery note** (per order, written at checkout, read by the
courier).

**Preconditions.** Dish note: a dish/combo pick is being customized (U3/U15).
Delivery note: checkout (U6) is in progress.

**Basic flow of events.**

| Step | Performed by | Action |
|---|---|---|
| 1 | User | While customizing (U3/U15), enters a dish note under the dish. |
| 2 | System | Stores the note on that line; shows it under the line in the cart. |
| 3 | User | At checkout (U6.1), enters a delivery note for the courier. |
| 4 | System | Stores the delivery note on the order. |
| 5 | System | Routes each note to its audience: the dish note appears under the same dish on the kitchen order card (K1/K2); the delivery note appears on the kitchen card only at `ReadyForDispatch` (for handoff) and on the customer's own tracking view (U7). |

**Alternative flows.**

| No | Location | Condition | Action | Resume location |
|---|---|---|---|---|
| 1 | Step 1 or 3 | Note exceeds the maximum length. | System truncates input at the limit and shows a counter. | Resumes at the same step. |
| 2 | Step 5 | An order has no notes. | Kitchen card and tracking view simply omit the note sections. | Use case ends. |

**Postconditions.** The dish note is persisted per order line (kitchen-facing); the
delivery note is persisted per order (courier-facing). The dish note is never sent to
the courier; the delivery note is never shown during preparation.
