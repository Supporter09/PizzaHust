# session-handoff.md

**Current feature:** `A1`–`A4` admin catalog — code complete, **PR #9 open → `main`** (refs #8), awaiting review/merge.
**Branch:** `feat/admin-catalog-a1-a4`
**Resume command:**

```bash
cd Application && ./init.sh && ./verify.sh
```

**State:** All backend + frontend gates green (ruff/mypy/import-linter, 70 tests, alembic check, OpenAPI drift, tsc/eslint/vitest/build). Contract change flagged in `CONTRACTS.md` for Minh + Hung review.

**Top blocker:** `verify.sh` exits 1 ONLY on 6 **pre-existing, out-of-scope** Playwright e2e (specs byte-identical to `main`, none touch the admin catalog):
- 4 `happy-path` tests hit unbuilt public pages `/menu`, `/track`, item-detail, register (U1/U2/U4 — not built on `main`).
- 2 `admin-customers`/`orders` tests: `loginAsAdmin` POSTs to `:3000/api/...` (frontend origin, no `/api` proxy → 404). API is `:8000` (`NEXT_PUBLIC_API_BASE_URL`). `verify.sh` also never seeds before e2e.

**Follow-up ticket (separate from PR #9):** fix the e2e harness — seed the DB before e2e and point `loginAsAdmin` at the backend origin — and pin `eslint-plugin-react-hooks` (7.1.1 escalated `set-state-in-effect` to an error, which had already broken `main`'s lint gate).

**Next feature after this:** `infra-005` — Delivery port + mock service, or remaining `A5`–`A7` per team assignment.
