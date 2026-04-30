# AGENTS.md

PizzaHUST web ordering MVP. Next.js + Tailwind frontend, FastAPI backend, MySQL. COD only. Mock-first delivery. No AI. No mobile.

## Startup Workflow

Before writing code, in this order:

1. Read this file.
2. Read `PRODUCT.md` (locked MVP scope, business constants).
3. Read `ARCHITECTURE.md` (module boundaries, order state machine, contracts).
4. Read `CONTRACTS.md` (REST endpoints, schemas, error envelope).
5. Read `session-handoff.md` (where the previous session left off).
6. Read `feature_list.json` (active feature, dependencies, ownership).
7. Run `./init.sh` (idempotent: containers, deps, migrations, seed).

## Working Rules

- **One feature in-progress at a time.** Only one entry in `feature_list.json` may have `status: "in-progress"`.
- **MVP boundary is non-negotiable.** Reject any change touching online payments, internal shipper portal, AI recommendation, native mobile, multi-branch, or BI dashboards.
- **Mock-first delivery.** All delivery calls go through `backend/app/infra/delivery/port.py`. The mock is the default. Real provider is a separate adapter.
- **Single-source business constants.** Delivery fee, loyalty rules, service area come from backend config and are exposed via `/api/config/*`. Frontend never hardcodes values.
- **Order state machine is enforced in `backend/app/domain/order_state.py`.** No router or service mutates status outside it.
- **Contract parity.** When backend routes change, regenerate types into `frontend/lib/api/types.ts` from the OpenAPI export. CI fails on drift.
- **Verification before claiming done.** `./verify.sh` must exit 0 and the timestamp + commit hash must be recorded in `feature_list.json` evidence.
- **Surgical edits only.** Touch only what the current feature requires. Mention unrelated issues in `progress.md`, do not fix them in the same change.
- **No debug logs, no `print`, no `console.log` in commits.** Use the configured logger.
- **Conventional commits, no co-author footer.** One logical change per commit.

## Definition of Done

- Implementation complete in the smallest scope that satisfies the use case.
- Unit tests for domain logic, integration tests for API boundary, smoke test still passes.
- `CONTRACTS.md` updated if any endpoint changed.
- `feature_list.json` `status` set to `done` with `evidence: "verify.sh green at <commit-sha>, <iso-timestamp>"`.
- `progress.md` appended.
- `session-handoff.md` rewritten to point to the next feature.

## End of Session

In this order:

1. Run `./verify.sh`. Stop if red.
2. Update `feature_list.json` (status, evidence).
3. Append a dated block to `progress.md`.
4. Rewrite `session-handoff.md` (current feature, branch, resume command, top blocker).
5. Commit with conventional-commit message naming the feature ID (e.g., `feat(U6): place COD order endpoint`).
6. Push.

## Required Artifacts

| File | Purpose |
|---|---|
| `PRODUCT.md` | Locked MVP scope, actors, use case index, business constants |
| `ARCHITECTURE.md` | Module boundaries, order state machine, kitchen queue, delivery port, auth |
| `CONTRACTS.md` | REST endpoints, request/response schemas, error envelope |
| `feature_list.json` | Feature state board (use case IDs U/A/K/T + infra) |
| `progress.md` | Append-only session journal |
| `session-handoff.md` | Snapshot of current session state |
| `init.sh` | Bootstrap: compose up, deps, migrations, seed |
| `verify.sh` | Static + unit + contract + integration + smoke (pytest+httpx) + Playwright |
| `docker-compose.yml` | mysql, backend, frontend, delivery-mock |
| `.env.example` | All required environment variables |

## Non-Negotiables (matches PRODUCT.md)

- COD only. No payment gateway code.
- Inner-Hanoi service area only. Reject other addresses at checkout.
- Delivery fee constant `DELIVERY_FEE_VND` lives in `backend/app/domain/pricing.py`.
- Order codes are non-guessable (ULID or 10-char base32). Tracking endpoint is rate-limited.
- Auth = httpOnly signed-cookie sessions, role claim inside session. No JWT.
- Polling, not WebSocket, for kitchen and tracking views.
- Kitchen queue priority is a SQL view expression, not Python. Single source of truth.

## When in doubt

If a request expands MVP scope, push back and link to `PRODUCT.md` out-of-scope list. Do not silently widen scope.
