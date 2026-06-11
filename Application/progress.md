# progress.md

Append-only session journal. Each session ends with a dated block. Keep blocks ≤ 20 lines.

---

## 2026-04-28 — infra-001 in progress

**Done**
- Created `Application/` wrapper.
- Wrote `AGENTS.md`, `PRODUCT.md`, `ARCHITECTURE.md`, `CONTRACTS.md`.
- Wrote `feature_list.json` with full use case index (U/A/K/T) and infra features.
- Wrote `init.sh`, `verify.sh`, `docker-compose.yml`, `.env.example`.
- Stubbed `backend/` (FastAPI healthcheck), `frontend/` (Next.js minimum), `delivery_mock/`.
- Repo-root `README.md` redirects to `Application/AGENTS.md`.

**Verified**
- Files written. `init.sh` and `verify.sh` not yet executed locally. No CI run.

**Blockers**
- Team must confirm 6 assumptions in PRODUCT.md before `U13` and `infra-loyalty` start.
- Hieu must translate `Week 1/ERD.pdf` into `schema.dbml` + first Alembic migration (`infra-003`).

**Next**
- Run `./Application/init.sh` end-to-end on a dev machine. Fix any reproducible setup issue.
- Mark `infra-001` done with evidence once `verify.sh` exits 0 on the empty skeleton.

---

## 2026-04-28 — infra-001 dependency uplift

**Done**
- Bumped frontend deps to current latest (npm registry checked):
  - `next` 14.2.15 → 16.2.4 (ctx7-confirmed Next.js 16.2 line)
  - `react` / `react-dom` 18.3.1 → 19.2.5
  - `tailwindcss` 3.4.13 → 4.2.4 (CSS-first migration)
  - `eslint` 8.57.1 → 10.2.1 (flat config)
  - `eslint-config-next` 16.2.4
  - `typescript` 5.6.2 → 6.0.3, `vitest` 2.1.2 → 4.1.5, `@playwright/test` 1.47.2 → 1.59.1
  - `@types/node` 25, `@types/react` 19.2, `@types/react-dom` 19.2
- Bumped backend deps in `pyproject.toml`: fastapi 0.136, uvicorn 0.46, alembic 1.18, cryptography 47, pydantic 2.13, pydantic-settings 2.14, argon2-cffi 25.1, python-ulid 3.1, structlog 25.5, httpx 0.28, starlette 1.0, pytest 9.0, pytest-asyncio 1.3, ruff 0.15, mypy 1.20, import-linter 2.11.
- Bumped `delivery_mock/Dockerfile` pins to fastapi 0.136.1, uvicorn 0.46.0, httpx 0.28.1, pydantic 2.13.3.
- Tailwind v4 migration: removed `tailwind.config.ts`, swapped `globals.css` to `@import "tailwindcss";`, switched PostCSS plugin to `@tailwindcss/postcss`, dropped `autoprefixer` (built into Lightning CSS).
- ESLint v10 flat config: removed `.eslintrc.json`, added `eslint.config.mjs` using `FlatCompat` over `next/core-web-vitals` + `next/typescript`.
- Frontend Dockerfile bumped to `node:22-alpine`. `init.sh` prereq message updated.

**Verified**
- `bash -n` on `init.sh`, `verify.sh` → OK
- JSON parse on `feature_list.json`, `openapi.json` → OK
- `python -m py_compile` on backend + delivery-mock Python → OK
- `docker compose config` → OK
- Not yet run: `npm install` against the new versions (no network/install in this session). Team should `rm -rf node_modules package-lock.json && npm install` on first session under `infra-002`.

**Risks introduced by this uplift**
- Tailwind 3→4 is a paradigm shift. Any utility-class assumptions or `@apply` patterns must be re-checked when real UI lands.
- React 19 + Next 16 server actions and async cookies/headers APIs change behavior. Affects `U6` (place order) and any auth route — design accordingly when implementing.
- ESLint 10 only supports flat config. CI must call `eslint .` not `next lint` (deprecated).
- Pin floors are loose (`>=`) on backend. If the team wants reproducibility, switch to `uv` lock or pin upper bounds before any CI run.

**Next**
- Same as above: `infra-001` exits when `init.sh` + `verify.sh` are green on a clean machine with the new versions.

---

## 2026-05-02 — infra-001 completed, infra-002 started

**Done**
- Ran `./init.sh` in `Application/` with exit code `0`.
- Ran `./verify.sh` in `Application/` with exit code `0`.
- Updated `feature_list.json`: `infra-001` -> `done` with evidence, `infra-002` -> `in-progress`.
- Updated `session-handoff.md` to point to `infra-002`.

**Verified**
- `verify.sh` green at commit `f17af03` on `2026-05-02T20:08:32+07:00`.

**Blockers**
- Existing blocker remains: `infra-003` depends on Hieu's ERD-to-DBML + initial Alembic migration.

**Next**
- Execute `infra-002` acceptance: bring up compose stack and confirm all service healthchecks green end-to-end.

---

## 2026-05-02 — infra-002 completed (WSL compatibility fixes)

**Done**
- Made MySQL host port configurable in `docker-compose.yml` via `MYSQL_HOST_PORT` (default `33306`), documented in `.env.example`.
- Fixed `init.sh` host-run migration/seed DB connectivity by rewriting `DATABASE_URL` from compose host to `127.0.0.1:${MYSQL_HOST_PORT}`.
- Made `init.sh` WSL-safe by skipping Linux Playwright Chromium install and relying on Windows Chrome debug endpoint.
- Updated Playwright e2e spec and `verify.sh` to support CDP attach flow (`~/.local/bin/open-chrome-debug`) for WSL smoke tests.
- Fixed frontend dependency issues: pinned `typescript` to `5.9.3` (openapi-typescript peer compatibility) and `eslint` to `9.39.1` (Next.js tooling compatibility).
- Switched `frontend/eslint.config.mjs` to current Next.js 16 flat-config style (`eslint-config-next/*` imports).
- Made `verify.sh` phase-aware for pre-`infra-003` Alembic metadata and separated frontend unit tests from e2e (`vitest --exclude tests/e2e/**`).

**Verified**
- `./init.sh` exits `0`.
- `./verify.sh` exits `0` at commit `51fa769` on `2026-05-02T20:44:32+07:00`.

**Next**
- Start `infra-003`: translate ERD to `schema.dbml` and create initial Alembic migration (including `kitchen_queue_view`).

---

## 2026-05-30 — infra-003 + infra-004 completed

**Done**
- Closed `infra-003` state tracking and finalized schema/auth dependency chain.
- Implemented backend auth stack: session middleware, Argon2 password hashing, auth error envelope, request-id header propagation.
- Implemented `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`, `PATCH /api/auth/me`, `GET /api/loyalty/me`.
- Added auth security controls: in-memory per-IP rate limit, CSRF double-submit, current-user/role guard utilities.
- Updated seeds to idempotently provision demo `admin` + `kitchen` accounts from env.
- Built frontend auth UI and state flow: `/login`, `/register`, `/account`, auth-aware navbar, profile edit, loyalty panel, red theme token `#D32F2F`.
- Updated `CONTRACTS.md`, regenerated `openapi.json`, regenerated `frontend/lib/api/types.ts`, and saved continuation doc to `Application/docs/plans/2026-05-30-infra-004-auth-ui-plan.md`.

**Verified**
- `./verify.sh` exits `0` (includes fallback Playwright CDP run) at `2026-05-30T20:11:14+07:00`.

**Next**
- Start `infra-005` (delivery port + mock service hardening) or `infra-007` (OpenAPI export/CI drift pipeline) based on team assignment.

---

## 2026-06-06 — A1–A4 admin catalog integrated (PR #9)

**Done**
- Re-integrated #8 admin catalog into `Application/` on `feat/admin-catalog-a1-a4`; opened PR #9 → `main` (refs #8). 16 commits.
- `domain/combos.py` (derived status + price helper); migration `0003` (products `image_url`/`is_active`, categories `sort_order`/`is_active`, drop `combos.target_people`, validity CHECK).
- Routers: `/api/admin/items` (+`/{id}/image` upload), `/sizes|crusts|toppings`, `/categories`, `/combos`, `/import/{pizzas,toppings}` — soft-delete + combo/FK guards, warn-not-reject combo pricing, derived status (no scheduler), no silent category auto-create.
- Frontend admin pages (items, categories, combos, pizza-options, import) + Breadcrumb/SearchBar on generated types + `{error:{message}}` envelope; layout nav updated.
- Seeds: catalog/combos/demo orders, idempotent order codes. `CONTRACTS.md` + `openapi.json` + `types.ts` regenerated (contract change flagged for Minh+Hung). `feature_list` A1–A4 → `done`.
- Fixed pre-existing `react-hooks/set-state-in-effect` lint **error** (react-hooks@7.1.1) in `admin/orders` + `customers/[id]` — `main`'s lint gate was already red without this.

**Verified**
- Backend ruff/mypy/import-linter green, **70 passed / 1 skipped**, `alembic check` clean, OpenAPI drift clean. Frontend `tsc`/`eslint`/`vitest`/`next build` green. Validated at `bbf4679`, `2026-06-06T16:43:05+07:00`.

**Blockers**
- `verify.sh` red ONLY on 6 **pre-existing, out-of-scope** e2e (specs byte-identical to `main`): 4 hit unbuilt public pages `/menu`//`track`/item-detail/register (U1/U2/U4); 2 admin specs' `loginAsAdmin` POST to `:3000/api` (frontend origin, no `/api` proxy → 404; API is `:8000`). `verify.sh` also never seeds before e2e.

**Next**
- Merge PR #9 after Minh+Hung contract review. Separate ticket: fix e2e harness (seed before e2e + point `loginAsAdmin` at `:8000`) and pin `eslint-plugin-react-hooks`.

---

## 2026-06-08 — infra-005 delivery port + open items

**Done**
- infra-005: `MockDeliveryAdapter` (DeliveryPort over httpx → delivery-mock), `get_delivery_port()` selector keyed on `DELIVERY_PROVIDER`, delivery config (`DELIVERY_BASE_URL/TIMEOUT_SECONDS/PICKUP_ADDRESS`). `DeliveryError` moved to `port.py`.
- Wired admin `retry-dispatch`: DispatchPending → `port.request()` → store `delivery_reference`, → Delivering; provider failure → 502, order stays retryable. No OpenAPI schema change (docstring-only → regenerated openapi.json + types.ts).
- Tests (new): adapter (MockTransport), selector, **previously-untested T2 webhook** (HMAC/fail-closed/idempotency/status-map/terminal-state), retry-dispatch. 88 backend tests green.
- Open items: pinned `eslint-plugin-react-hooks@7.1.1` (direct devDep); gitignored `.deploy/`, `*.egg-info/`, `CLAUDE.md`; e2e harness — verify.sh seeds + brings up delivery-mock before Playwright, `loginAsAdmin` → `E2E_API_URL` (:8000).
- CONTRACTS.md: retry-dispatch behavior + 502 + delivery provider note. Smoke skip reason corrected (blocked on U6/kitchen/tracking, not infra).

**Verified**
- `./verify.sh` exits 0 at `5bd7417`, `2026-06-08T15:38:11+07:00`. e2e: 3 passed, 6 deferred (test.fixme).

**Out-of-scope bugs found (NOT fixed — surgical scope; for A5/A6 owner)**
- Admin layout guard (`app/admin/layout.tsx`) redirects an authenticated admin to /login: it reads `profile.role` but `GET /api/auth/me` returns `{user:{role}}`, and fetches a relative `/api/auth/me` that 404s in split-origin dev. Blocks A5/A6 admin pages + their e2e (deferred via `test.fixme`).

**Next**
- A5/A6: fix the admin layout guard (above) to re-enable the deferred admin e2e.
- Remaining infra: `infra-006/007/008`. Or customer flow `U1/U2/U4` to re-enable the deferred happy-path e2e.

**CodeRabbit PR #10 review (addressed, all valid)**
- mock adapter: invalid/missing provider payload → DeliveryError (was 500).
- get_delivery_port lru_cached (per-request httpx.Client leak).
- retry-dispatch: SELECT ... FOR UPDATE row lock (double-dispatch race).
- 502 now emits closed-set `DELIVERY_UPSTREAM_ERROR` (added status→code map); CONTRACTS reconciled (dropped stale ReadyForDispatch line).
- quoted `DELIVERY_PICKUP_ADDRESS` in .env.example; Crockford order_code in webhook test.
- Re-verified: `verify.sh` green at `f03f3bb`, `2026-06-08T16:04:04+07:00`.

**Admin layout guard bug — now FIXED (was flagged out-of-scope above)**
- `app/admin/layout.tsx` now consumes the shared `useAuth()` session instead of a local raw `fetch("/api/auth/me")`: fixes the relative-URL 404 (split-origin dev) and the wrong field read (`profile.role` → the response is `{user:{role}}`), which had bounced authenticated admins to /login. Also inherits the provider's 401-only logout semantics.
- Re-enabled the two admin e2e (A5/A6 render) — `verify.sh` e2e now 5 passed / 4 deferred (only U1/U2/U4 + register remain). Green at `2026-06-08T16:13:44+07:00`.

---

## 2026-06-08 — infra-006 order domain completed

**Done**
- Added pure domain modules: `order_state.py`, `pricing.py`, `loyalty.py`, `service_area.py`; domain imports remain clean.
- Reconciled admin cancel/retry-dispatch and delivery webhook status writes through the state machine; illegal webhook transitions are no-ops.
- Added `/api/config/delivery` and `/api/config/loyalty`; regenerated `openapi.json` and frontend API types.
- Updated service area to Hanoi's 2025 post-reorganization 51 ward units (126 total commune-level units citywide).

**Verified**
- `./verify.sh` exits `0` at `656479f`, `2026-06-08T16:42:16+07:00`; backend 140 passed / 1 skipped; Playwright 5 passed / 4 skipped.

**Next**
- `infra-007` is the next unblocked board feature. `U1` remains blocked on `infra-008`; `U6` remains blocked on `U5`.

---

## 2026-06-09 — infra-007 CI pipelines completed

**Done**
- Merged PR #12 (`9f9b3aa`): `.github/workflows/ci.yml`, `docker-images.yml`; CI design + implementation plans; synced `frontend/package-lock.json` for `npm ci`.
- Proved drift gate: `openapi.json` whitespace → `contracts` red (run `27191063194`); revert → green (`27191106432`).

**Verified**
- Post-merge GHCR publish run `27191165080` success; tags `latest`, `main`, `sha-9f9b3aa` on `pizzahust-backend` and `pizzahust-frontend`.

**Next**
- `infra-008` frontend shell. VM image-pull cutover and pytest-in-CI remain follow-ups.

---

## 2026-06-09 — infra-008 frontend shell (theme) on branch

**Done**
- Semantic CSS token system (`globals.css`), tested `lib/theme.ts` + no-flash bootstrap in `layout.tsx`.
- Vendored Poppins (latin 400/600/700, OFL-1.1); `ThemeToggle` in TopNav + admin sidebar.
- App `error` / `not-found` / `loading`; mechanical color sweep + hue-lookup badge `dark:` pairs.
- `tests/e2e/theme.spec.ts` added.

**Verified**
- `npx vitest run lib/theme.test.ts`, `tsc`, `eslint`, `npm run build` green on branch `infra-008-frontend-shell` @ `2750431`.
- `./verify.sh` not run to completion: Docker/OrbStack daemon unavailable (MySQL compose).

**Next**
- Squash-merge PR `infra-008-frontend-shell`.

---

## 2026-06-09 — infra-008 done

**Done**
- Closed theme plan: rebuilt `pizzahust-frontend` image for e2e; theme spec clears `localStorage` before system-default assertion.

**Verified**
- `./verify.sh` exit 0 at `752a625`, `2026-06-09T15:44:02+07:00` (7 Playwright passed, 4 skipped).

**Next**
- `U1` Browse Menus.

---

## 2026-06-09 — U1 Browse Menus done

**Done**
- Backend `app/api/menu.py`: public categories + items; 7 integration tests.
- Contract export + `CONTRACTS.md` reconcile (veg/kids/description deferred).
- Frontend `formatVnd`, `lib/api/menu.ts`, `PizzaCard`, `CategoryFilter`, `/menu` page; combos de-dup.
- `tests/e2e/menu.spec.ts`; `ThemeBootstrap` + font on `<body>` so system-dark e2e passes after hydration.

**Verified**
- `./verify.sh` exit 0 at `3f857a7683f07c16002aefd9906ab67dd14f167d`, `2026-06-09T10:34:33Z`.

**Next**
- `U2` View Item Details.

---

## 2026-06-09 — U2 View Item Details done

**Done**
- Backend `app/api/menu.py`: public `GET /api/items/{id}` embeds global pizza options (`sizes` ordered by `price_modifier_vnd`, then `name`; `crusts` by `crust_id`; `toppings` by `name`); 404 on missing/inactive, 400 on bad id; non-pizzas return empty option lists. 6 integration tests (`tests/test_menu_detail.py`).
- Contract regenerated: `openapi.json` + `frontend/lib/api/types.ts` (`MenuItemDetailOut`/`MenuSizeOut`/`MenuCrustOut`/`MenuToppingOut`).
- Frontend `lib/pricing.ts` `computePizzaLineTotal` (6 vitest) — **display-only, non-authoritative** price preview (documented deviation; U5 replaces with `POST /api/cart/quote`). `fetchItem` wrapper.
- `components/menu/`: `SizeSelector`, `CrustSelector`, `ToppingSelector`, `QuantityStepper` (presentational, a11y radiogroup/checkbox roles, state lifted to page).
- `/menu/[id]` client page: `use()` params unwrap, deferred fetch, loading/notfound/error/ready states, customizer + estimate preview for pizzas, image/name/price for non-pizzas. U1 cards link in (with `aria-label` for an accessible link name).
- `tests/e2e/item-detail.spec.ts` (customizer, non-pizza, not-found).

**Deviation (pre-approved)**
- Per-item price total is computed client-side in `lib/pricing.ts` as a display-only preview. Math lives only there. U5 supersedes it with the authoritative backend cart quote.

**Follow-ups (non-blocking)**
- `/menu/[id]` + `/menu` fetch on mount without an in-flight cancellation guard (mirrors U1); a rapid param change could race. Add an `AbortController`/cancelled flag if needed.
- Size/crust radiogroups are button-based without arrow-key roving-tabindex (deliberate; APG radiogroup keyboard nav not implemented).

**Verified**
- `./verify.sh` exit 0 at `ebc115b31539c19deaaa77b45c71c5f44f0db427`, `2026-06-09T17:05:57Z` (U2 e2e 3 passed; full gate green).

**Next**
- `U3` Customize Pizza (first job: replace the client price preview with `POST /api/cart/quote`).

---

## 2026-06-09 — U3 Customize Pizza done

**Done**
- Domain `app/domain/pricing.py`: added pure `compute_pizza_unit_price(base + size_modifier + toppings)`; made `compute_order_total(address_district=None)` a preview mode (no service-area check, `delivery_fee_vnd=0`). Existing address-bearing callers/tests unchanged. +5 domain tests.
- Backend `app/api/cart.py`: new public, non-mutating `POST /api/cart/quote`. Resolves prices from the DB (pizza: size-by-name modifier, crust existence, topping ids; side: base price), rejects combo (deferred U4/U5), `is_pizza`/kind mismatches, and side-with-options as `VALIDATION_FAILED` 400; `OUT_OF_SERVICE_AREA`/`INSUFFICIENT_LOYALTY` → 422. 15 integration tests.
- Contract regenerated: `openapi.json` + `frontend/lib/api/types.ts` (`CartQuoteIn`/`CartQuoteOut`/`QuoteLineIn`/`QuoteAddressIn`/`QuoteLoyaltyOut`). `CONTRACTS.md` updated (authoritative-pricing note replaces the U2 deviation; combo/loyalty examples corrected — `max_redeemable` is 50% of post-combo subtotal).
- Frontend `lib/api/cart.ts` (`quoteCart`) + 2 vitest; new minimal `vitest.config.ts` (`@`→root, first test using the alias). `/menu/[id]` now renders the authoritative server quote via a 250ms-debounced call with an `active`-flag stale/unmount guard; `aria-live` on the estimate. Deleted `lib/pricing.ts` + `lib/pricing.test.ts` (deviation retired).

**Deviation retired**
- The U2 client-side `computePizzaLineTotal` preview is gone; all pizza pricing is server-authoritative via `POST /api/cart/quote`.

**Follow-ups (non-blocking)**
- `redeem_points` is wired but inert until U13/U14 (balance 0 → any `>0` is `INSUFFICIENT_LOYALTY`); cart-line/combo quoting and multi-line carts land in U4/U5.
- Pre-existing: leftover `*.sqlite3` test artifacts under `backend/tests/`; two seed tests need `ADMIN_SEED_PASSWORD`/`KITCHEN_SEED_PASSWORD` env (skipped/green under verify.sh env).

**Verified**
- `./verify.sh` exit 0 at `f93e6eac35addf1509d873f9cf7d2ba3f75a763b`, `2026-06-09T18:30:35Z` (backend 175 passed/1 skipped; frontend unit 11 passed; smoke 1; Playwright 11 passed/4 skipped; OpenAPI + types drift clean).

**Next**
- `U4` View Combo Promotions (`depends_on`: `U1`, `A4` — both done). Combo-line quoting in `POST /api/cart/quote` is the natural extension point.

---

## 2026-06-09 — U4 View Combo Promotions done

**Done**
- Domain `combo_savings_vnd` (clamped savings vs sum-of-parts).
- Public `GET /api/combos`: Active window + all components active; eager-loaded items; 7 API tests.
- OpenAPI + `frontend/lib/api/types.ts`; `lib/api/combos.ts` + vitest; `ComboCard`, `/combos`, top-nav links; Playwright `combos.spec.ts`.
- `CONTRACTS.md` `GET /api/combos` schema example; cart combo quoting still deferred to U5.

**Verified**
- `./verify.sh` exit 0 at `30f0ffdf6befa1c3512b09d3b96d6f4f80ff6efd`, `2026-06-09T22:07:47Z`.

**Next**
- `U5` Manage Cart — combo lines in `POST /api/cart/quote` + cart persistence.

## 2026-06-10 — A8 Generic Options Model (verify.sh green at 9ed8bae)

- Replaced fixed `pizza_sizes`/`pizza_crusts`/`toppings` with `option_groups`/`options`
  (deltas shared) + `product_options` (per-dish enablement) + `order_item_options`
  (order-history snapshots, no FK). Migration `0005_generic_options` transforms data,
  backfills history (topping qty multiplied into delta), drops old tables — backfill
  manually verified against compose MySQL (evidence on PR #19).
- Cart quote: lines are `{kind: item|combo, item_id, option_ids, quantity}`; server
  dedupes ids; group rules in `domain/options.py`; `VALIDATION_FAILED` + `details.reason`.
  Negative deltas rejected at schema (ge=0) and domain.
- Admin: `/api/admin/option-groups` CRUD, per-dish `GET/PUT /api/admin/items/{id}/options`;
  dish editor at `/admin/items/[id]` (categories inline, single|multi + required controls,
  enable toggles, cart-line preview via `composeLineText`); `/admin/pizza-options` and
  `POST /api/admin/import/toppings` removed. Customizer now renders generic groups.
- **Cross-cutting fix:** FastAPI 0.118+ runs yield-dependency teardown after the response,
  so `get_db`'s commit raced immediate follow-up requests. All routers now use
  `Depends(get_db, scope="function")` (commit before response).
- SQLite tests now enforce FKs (PRAGMA) so option cascades match MySQL.
- Local e2e: `AUTH_RATE_LIMIT_PER_MINUTE` overridable via compose (parallel specs exceed
  5 logins/min); `E2E_*` vars required in `.env`.
- Unrelated issue noted, not fixed here: none outstanding (seeds `print` replaced with
  structlog as part of this change since seeds were rewritten anyway).

---

## 2026-06-11 — A10 Combo Choice-Slots and Component Picker

**Done**
- Migration `0006_combo_choice_slots`: `combo_items.category_id` XOR `product_id`, `combos.image_url`.
- Domain `combo_slots.py` (reference/min price, surcharges, resolved line pricing); admin/public/cart APIs.
- Admin combo editor + component picker; public combo detail; cart quote for resolved combos; combo images.
- Seeds: `Pick-Any Feast` (pizza + drinks slots); e2e admin combo editor; menu e2e drinks filter aligned with seed data.

**Verified**
- `./verify.sh` exit 0 at `697d345`, `2026-06-11T15:05:00+07:00`.

**Next**
- `U15` Customize Combo UI; order persistence of combo lines remains `U6`.

---

## 2026-06-11 — U15 Customize Combo

**Done**
- Public combo detail client; `/combos/[id]` customizer with slot picks, per-pick A8 options, debounced cart quote, savings, expiry and selection-error states.
- `combo-selections` model + `buildComboLine`; combo cards link to customizer; vitest + Playwright `combo-customize.spec.ts`.

**Verified**
- `./verify.sh` exit 0 (e2e fix: premium surcharge chip must be unchecked before click).

**Next**
- `U5` Manage Cart (`buildComboLine` persistence); `U6` persists resolved combo lines on `POST /api/orders`.

---

## 2026-06-12 — U15 Post-Review Fixes

**Done**
1. `setPickProduct` no-op on same-product re-pick (options no longer wiped).
2. Premium-pick e2e selector scoped to `slot-pick` chips (no option-chip false match).
3. `PickOptions`: dead `latest` ref replaced with cleanup `active` flag; keyed-remount invariant documented here and at the `key={unit.productId}` usage.
4. `buildComboLine` return type annotated as `ComboQuoteLineIn`; `_Check` assertion lines removed.
5. vitest excludes `tests/e2e/**` — bare `npx vitest run` is green.
6. a11y: option group heading `h4`→`h3`; combo-card Customize link gets `aria-label`.
7. `package-lock.json` peer-flag/dedupe churn restored (no real dependency changes).

**Verified**
- `./verify.sh` exit 0 at `29e7bf9`, `2026-06-11T17:40:17Z`.

---

## 2026-06-12 — U4/U15 Mockup-Fidelity Pass

**Done** (per `matching-design-mockups`; compared rendered screens against `Design/combos.html` and `Design/combo-customize.html`)
1. Bug: customizer slot headings rendered "…customer's choicecustomer's choice" — API name already carries the suffix; frontend badge removed.
2. Customizer: two-column layout (sticky summary card with image/Save badge/struck `items_total_vnd`/large price), numbered step circles — one step per pick unit, green "n of n selected" per-slot counters (`slotProgress`, vitest), slot picks as cards (thumbnail, Included/+surcharge, radio circle; testids/roles/44px kept), options panel named "Options for {picked product}" in brand red, mockup bottom bar with disabled "Add Combo to Cart" + "Cart is coming soon".
3. Combos list: hero band with lead line, component mini-panels (thumbnail + bold qty), Save badge overlaid on cover (warning tokens), CTA renamed Customize → "Order Now" (DESIGN_BRIEF flow map; e2e selectors updated), 2-up wide grid with 16/7 image band, price `text-2xl font-extrabold`, cover fallback fixed (`combo.image_url` → first item image → placeholder).
4. Quantity stepper removed from the customizer (not in mockup; cart-line quantity is U5 scope — quote uses quantity 1).

**Documented deviations**
- Accepted partial: "Add Combo to Cart" is rendered disabled — cart ships with U5; no fake interactivity.
- Accepted: Size option group stays visible (server requires the group; mockup slots are size-scoped, ours aren't).
- Accepted: no site footer (site-shell scope, not this feature).
- Contract-driven, not implemented: "Valid until {date}" rows — public combos API exposes no validity field; contracts win on payloads.
- Data-driven: "No image" placeholders everywhere (seeds carry no image URLs); mockup drink steppers replaced by per-unit radio steps (one pick per unit is the CONTRACTS.md selection model).

**Verified**
- `npx tsc --noEmit`, `npx eslint .` (no new warnings), `npx vitest run` (41 passed) green.
- `./verify.sh` exit 0 at `368a36e`, `2026-06-11T18:35:35Z` (20 e2e passed incl. updated combo specs).
- Screenshots in `Application/docs/superpowers/`: `u15-after-{light,dark,mobile}.png`, `combos-fidelity-after-{light,dark,mobile}.png` (customizer shot in fully-picked state, combo 3).
