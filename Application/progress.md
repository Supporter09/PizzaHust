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
