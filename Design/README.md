# Design — v2 handoff bundle

Static HTML/CSS/JS mockups exported from **Claude Design** (claude.ai/design), the
visual source for the PizzaHUST v2 build. The canonical written spec is
[`../DESIGN_BRIEF.md`](../DESIGN_BRIEF.md); this folder is the pixel reference behind it.

These are **prototypes, not production code** — recreate the visual output in the real
stack (Next.js + Tailwind), don't port the prototype's internal structure. Everything you
need (colors, spacing, layout) is in the HTML/CSS; read it directly. `design-chat.md` is
the full design conversation (where the intent landed).

## Layout

- `*.html` — 27 screen mockups (open any in a browser; they share `assets/`).
- `assets/` — `styles.css` (design tokens + components), `chrome.js`, `data.js` (mock data).
- `screens/` — 14 reference screenshots of key states (dark mode, scroll positions, pickers).
- `design-chat.md` — design-session transcript (provenance / intent).

## Screen index

**Customer**
| Mockup | Surface / use case |
|---|---|
| `index.html` | Home / landing |
| `menu.html` | Menu listing (U1) |
| `product.html` | Item detail + customizer (U2/U3) |
| `combos.html` | Combos listing (U4) |
| `combo-customize.html` | Combo customizer (U15) |
| `cart.html` | Cart (U5) |
| `checkout.html` | Checkout / COD (U6) |
| `order-confirmed.html` | Order confirmation |
| `track.html` | Order tracking |
| `order-history.html` | Order history |
| `account.html` / `edit-profile.html` | Account + profile (incl. avatar / change password) |
| `loyalty.html` | Loyalty (U13/U14) |
| `gallery.html` | Image gallery (A9 multi-image) |
| `auth.html` | Login / register |

**Staff / admin**
| Mockup | Surface / use case |
|---|---|
| `kitchen.html` | Kitchen queue (K-series) |
| `admin-dashboard.html` | Admin home |
| `admin-menu.html` / `admin-item-edit.html` | Catalog + item edit incl. options (A1/A2/A8) |
| `admin-categories.html` / `admin-category-edit.html` | Categories (A1) |
| `admin-combos.html` / `admin-combo-edit.html` | Combos incl. choice-slots (A4/A10) |
| `admin-orders.html` | Order management |
| `admin-customers.html` / `admin-customer-detail.html` | Customers |
| `admin-reports.html` | Reports |
| `admin-import.html` | Bulk import |

> Screenshots in `screens/` cover the states worth eyeballing (e.g. `item-edit-options.png`
> for the generic-options admin UI, `combo-picker.png` for the combo customizer).
