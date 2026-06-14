# session-handoff.md

**Current state:** `K4` Confirm Pickup (fallback) is **done and verify-green** on `feat/k4-confirm-pickup`, **rebased onto `main` to stand alone (K4-only, 8 commits)**. The kitchen queue's action set is now complete — every card surfaces its one verb: **Accept** (`Received → Preparing`), **Mark Ready for Dispatch** (`Preparing → ReadyForDispatch`), **Confirm Pickup** (`ReadyForDispatch → Delivering`). The kitchen screen is "visually complete." Branch is local-only (not pushed); ready to merge/PR.

**Next feature:** `T1` Request Delivery Service (mock-first) or `T2` Synchronize Delivery Status (webhook) — the automatic courier path that K4 manually backstops. K4 exists precisely for when T2's pickup-scan webhook never arrives.

**What shipped (K4):**
- `POST /api/kitchen/orders/{id}/pickup` (kitchen, 204): row-locked `ReadyForDispatch → Delivering` via `order_state.transition()`, 404/409 guards, KITCHEN tracking note (`note="Pickup confirmed by kitchen"`). **No delivery-port call** — pure local state advance (deliberate: this is the manual fallback, not a re-dispatch). Handler appended to `backend/app/api/kitchen/actions.py` (docstring now K2/K3/K4); role-guarded only (staff verb; SameSite=lax, no per-route CSRF), consistent with K2/K3.
- Frontend Confirm Pickup control on `ReadyForDispatch` cards — **inline two-step confirm** (Confirm Pickup → Yes, picked up / Cancel) guarding the irreversible transition, plus helper text "Usually auto-confirmed when the courier scans the order". 409 → refetch-reconcile, 5xx/network → inline per-card error. `confirmKitchenPickup` in `lib/api/kitchen.ts`; UI in `ticket.tsx`.
- Contract: `openapi.json` + `types.ts` regenerated; `CONTRACTS.md` K-section retitled K1–K4 (and fixed a stale `GET /api/kitchen/queue` → `/api/kitchen/orders`). Seed now **resets** demo-order status on re-seed (`backend/app/seeds/run.py`) so the RFD e2e is repeatable.

**Fidelity / fixes:** `/matching-design-mockups` pass — card matches the `kitchen-ready` mockup; the inline confirm is a documented **accepted deviation** (mockup shows one-click). The pass surfaced a **pre-existing light-mode legibility bug**: filled brand buttons used `text-brand-fg`, which is the same red as `--brand` in light `:root` (red-on-red, invisible; only worked in dark mode). Fixed K2 Accept + K4 Yes-picked-up to `text-on-brand` (commit `187f04d`). Only those 2 pairs existed in the app, both in `ticket.tsx`.

**Verification:** `./verify.sh` green at `898a723` (K4 rebased onto `main`, K4-only), `2026-06-14T13:34:28Z` — backend 412 passed/1 skipped, contract parity (no drift), frontend 94 vitest + build, smoke, e2e **47 passed / 4 skipped** including "K4 — Confirm Pickup (fallback)". See K4 `evidence` in `feature_list.json`.

**Branch note:** `feat/k4-confirm-pickup` was originally cut on top of the frontend image-URL fix; it has been **rebased onto `main`** so it carries K4 only. The image-URL fix is unaffected and lives on its own branch `fix/image-asset-origin` (pushed; its own PR). The branch also carries `898a723`, an unrelated 1-line tz fix to `test_admin_orders_dispatch.py` — it seeded `created_at=datetime.now()` (naive *local* +07), which on a +07 host after 17:00 lands past the naive-UTC business-today window and was wrongly excluded from the default order listing. Fixed to `datetime.now(UTC).replace(tzinfo=None)`. Orders-domain *code* is byte-identical to `main`; this is a test-only fix, committed separately and clearly labelled.

**Blockers:** None.
