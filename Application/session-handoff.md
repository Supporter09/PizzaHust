# session-handoff.md

**Current state:** `K1` View Incoming Orders done and verified on branch `feat/k1-incoming-orders` (`verify.sh` green at `8fed231`). The kitchen spine has its first screen: a read-only, role-guarded incoming-orders queue at `/kitchen`.

**Next feature:** `K2` Update Preparation Status (`depends_on: ["K1"]`, owner Hung) — adds the kitchen action buttons (Accept → Preparing, Mark Ready) to the queue cards. The attach point is already marked by a placeholder comment in `frontend/app/kitchen/queue-client.tsx`; the order-state transitions live in `backend/app/domain/order_state.py` (do not recompute in the frontend).

**Resume command:**

```bash
git checkout feat/k1-incoming-orders && git pull
cd Application && ./init.sh && docker compose up -d backend frontend
# Open PR for feat/k1-incoming-orders → main when ready; next branch e.g. k2-prep-status
```

**State:** K1 shipped migration `0012` (`kitchen_queue_view` now surfaces `ReadyForDispatch`, not `DispatchPending`), read-only `GET /api/kitchen/orders` returning lean prep-ticket DTOs (per-line item/options/note, combo children nested under their parent line, delivery note surfaced), pure queue helpers (`lib/kitchen-queue.ts`), `/kitchen` chrome suppression + role-guarded shell + 3s-polling queue page, and a seeded `ReadyForDispatch` demo order. MySQL smoke + Playwright `kitchen.spec.ts` cover the non-kitchen redirect and the kitchen-login-sees-tickets path.

**Relation notes:** no new model/table relation introduced. K1 reuses the existing order / order-item / `order_item_options` snapshot relations and reads the SQL `kitchen_queue_view` (membership corrected in `0012`); it is a read-only projection.

**Verification:** `./verify.sh` exit 0 at `8fed231`, `2026-06-13T18:04:21+07:00` — backend 329 passed/1 skipped, frontend 65 unit, smoke 1, Playwright 34 passed/4 skipped (both K1 kitchen specs green), OpenAPI + types drift clean.

**Blockers:** None. `E2E_KITCHEN_PHONE` / `E2E_KITCHEN_PASSWORD` are needed in `.env` for the kitchen e2e (defaults match the seeded kitchen user; test files fall back to them).

**Notes:** Pre-existing U5 `cart.spec.ts` is flaky under the 5-worker parallel Playwright run (passes in isolation, intermittent under load); confirmed NOT introduced by K1 (fails the same way with the kitchen specs excluded). It passes on re-run; the gate has `retries: 0`, so a red cart line on a full run is the flake, not a regression — re-run to confirm green.
