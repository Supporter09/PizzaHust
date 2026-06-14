# session-handoff.md

**Current state:** `K2` Update Preparation Status and `K3` Mark Order Ready for Dispatch are done and verified on `feat/k2-3-kitchen-actions`, **rebased onto `main` after #36 (A11 + A12 + A13) merged**. Kitchen cards now drive the prep flow: **Accept** (`Received → Preparing`) and **Mark Ready for Dispatch** (`Preparing → ReadyForDispatch`, requesting a courier via the delivery port; provider failure → `DispatchPending`, which makes admin A5 retry reachable). PR #35 is ready to merge once green.

**Next feature:** `K4` Confirm Pickup (fallback) (`depends_on: ["K3"]`, owner Hung) — the kitchen queue's last missing action. Adds a **Confirm Pickup** button on `ReadyForDispatch` cards and the manual `ReadyForDispatch → Delivering` transition (the fallback for when the delivery provider's T2 pickup webhook doesn't arrive). After K4 the kitchen screen is "visually complete"; until then `ReadyForDispatch` cards intentionally render no action button (only the courier delivery-note block).

**What shipped (K2/K3):**
- K2 `POST /api/kitchen/orders/{id}/accept` (kitchen, 204): row-locked `Received → Preparing` via `order_state.transition()`, 404/409 guards, KITCHEN tracking note. Frontend Accept button on `Received` cards (pending/aria-busy; 409 → refetch-reconcile, 5xx/network → inline per-card error).
- K3 `POST /api/kitchen/orders/{id}/mark-ready` (kitchen, 200 `{status}`): requests a courier via `DeliveryPort.request(OrderForDispatch(...))`. Success → store `delivery_reference` + `ReadyForDispatch` + TRANSPORT tracking. `DeliveryError` → `DispatchPending` (committed, NOT re-raised; 200 not 502) — first reachable producer of `DispatchPending`, so admin A5 `retry_dispatch` is reachable. `MarkReadyOut.status` is a `Literal["ReadyForDispatch","DispatchPending"]` (OpenAPI enum / discriminated TS union). Mark Ready button on `Preparing` cards + queue-level deferred notice (state on `QueueClient`, set before the refetch so it survives the card leaving). `Ticket` card extracted to `frontend/app/kitchen/ticket.tsx` (keeps `queue-client.tsx` < 300 lines).

**Rebase notes (#36 → this branch):** kitchen code is disjoint from #36's admin surface; the only code reconciliation was re-registering `kitchen_actions_router` in `backend/app/main.py` alongside #36's routers. `openapi.json` + `frontend/lib/api/types.ts` were regenerated on top of #36's contract (not hand-merged); `CONTRACTS.md` / `feature_list.json` / `progress.md` reconciled to carry both A11–A13 and K2/K3.

**Verification:** see the K2/K3 `evidence` in `feature_list.json`. Gate re-run green post-rebase — backend pytest, contract parity (OpenAPI ↔ types, no drift), frontend tsc/eslint/vitest/build.

**Blockers:** None on the feature.
