# session-handoff.md

**Current feature:** `infra-006` order state machine + pricing + loyalty domain — **done** on branch `infra-006-order-domain`.

**Resume command:**

```bash
cd Application && ./init.sh && ./verify.sh
```

**State:** `./verify.sh` exits `0` at implementation commit `656479f`, `2026-06-08T16:42:16+07:00`. Backend gates green: ruff, format, mypy, import-linter, 140 tests passed / 1 skipped, alembic check, OpenAPI drift. Frontend gates green: type check, generated types parity, eslint (1 pre-existing warning), vitest no tests, build. E2E: 5 passed / 4 skipped.

**Shipped this session:**
- `backend/app/domain/order_state.py`: closed transition graph + delivery-event mapping; existing admin/webhook status writes now call it.
- `backend/app/domain/pricing.py`, `loyalty.py`, `service_area.py`: canonical COD pricing constants, loyalty rules, and Hanoi 2025 ward whitelist.
- `/api/config/delivery` and `/api/config/loyalty`; regenerated `openapi.json` and `frontend/lib/api/types.ts`.
- Docs updated for the 2025 Hanoi administrative model: 126 commune-level units citywide, MVP service area = 51 wards.

**Top blocker / next feature:** `infra-007` (OpenAPI/type-gen pipeline) is the next unblocked board item. Product features remain blocked: `U1` needs `infra-008`; `U6` needs `U5`.

**Local note:** `Application/frontend/package-lock.json` is locally modified by `./init.sh` / npm install churn and was intentionally not committed.
