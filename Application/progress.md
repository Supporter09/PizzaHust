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
