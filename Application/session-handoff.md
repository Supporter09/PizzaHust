# session-handoff.md

**Current state:** `T1` Request Delivery Service (mock-first) and `T2` Synchronize Delivery Status (webhook) are **done and verify-green** on `feat/t1-t2-verify`. These were the **last two `todo` entries** — with them closed, every feature in `feature_list.json` is `done`. The branch is a worktree off `main`, deliberately isolated from the parallel U14/catalog work.

**Scope (verify + formalize, not a rebuild):** the end-to-end delivery loop already existed — K3 `mark-ready` dispatches through `DeliveryPort.create_delivery` to the mock (T1, built in infra-005/K3/A5), and `POST /api/webhooks/delivery` HMAC-verifies + idempotently applies the mock's signed callbacks through the order state machine (T2, built in infra-005/K4/U7). This branch verifies that loop end-to-end and fills the two gaps that kept it from being formally "done": a parked smoke test and missing observability on the webhook's silent branches.

**What shipped (5 files, commits `3e608d7..769a754`):**
- **T2 — `backend/app/api/webhooks.py`:** the two no-op branches now emit structured warnings — `delivery_webhook_unknown_reference` (signed callback for an order we don't hold) and `delivery_webhook_illegal_transition` (a transition `order_state` forbids). Both still return 200 so the provider doesn't retry a callback we intentionally drop. Unit-tested via `structlog.testing.capture_logs` (`tests/test_delivery_webhook.py`). U14's row-locked reserved-points release on Delivery-Failed is preserved unchanged.
- **T1+T2 — `backend/tests/smoke/test_end_to_end.py`:** unparked `test_place_cod_order_through_to_delivered` — places a COD order, kitchen accepts + marks ready (T1 books the **real** mock), then polls the public tracking projection until the mock's HMAC-signed webhooks (T2) drive it to **Delivered**, asserting the timeline carries Delivering + Delivered. Polls at the frontend's 15s cadence to stay under the public track endpoint's 5/min/IP rate limit.
- **T2 — `frontend/tests/e2e/track.spec.ts` + `components/shared/status-badge.tsx`:** added `data-testid="order-status-badge"` so the e2e asserts the **live** status badge rather than the always-rendered timeline labels (the original assertion was a false-positive that passed in 1.4s); the spec now drives a real checkout + kitchen dispatch and waits for the badge to read Delivered.

**No contract/route change:** `openapi.json`, `frontend/lib/api/types.ts`, and `CONTRACTS.md` are byte-identical to `main` — this branch adds no endpoints, only logging + tests + one test hook.

**Deviations / scope notes:** loyalty-on-Delivered is intentionally **out of scope** — U14 credits accrual at placement and reverses on Cancel / Delivery-Failed; delivery completion does not touch points. The rate-limit knob was left at the shipped default (5/min/IP) and the smoke poll cadence was tuned to fit it, rather than widening the limit.

**Verification:** `./verify.sh` **EXIT 0** at `769a754`, `2026-06-15T15:11:50Z` (containers rebuilt from this worktree first) — backend **456 passed**, vitest **136 passed**, smoke **2 passed** (incl. the unparked `test_place_cod_order_through_to_delivered`), Playwright **51 passed/4 skipped/0 failed** (incl. `track.spec.ts:40` auto-advance to Delivered — 17.1s genuine wait, no flake).

**Resume:** `git checkout feat/t1-t2-verify && cd Application && ./init.sh && ./verify.sh`. With T1/T2 merged, the MVP feature list is fully `done` — next steps are the PR for this branch and any post-MVP polish.

**Top blocker:** None. The delivery loop is proven end-to-end (smoke + e2e), the HMAC callback path is exercised by the real mock, and the gate is green.
