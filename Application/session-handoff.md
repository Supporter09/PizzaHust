# session-handoff.md

**Current feature:** `infra-007` CI pipelines (contract drift + GHCR images) — **done** on `main` @ `9f9b3aa`.

**Resume command:**

```bash
cd Application && ./init.sh && ./verify.sh
```

**State:** PR #12 squash-merged. `ci.yml` + `docker-images.yml` on `main`. Drift gate exercised: intentional `openapi.json` drift → `contracts` failed (run `27191063194`); revert → green (run `27191106432`). Post-merge `docker-images` run `27191165080` pushed `ghcr.io/supporter09/pizzahust-{backend,frontend}` with `latest`, `main`, `sha-9f9b3aa`. Synced `package-lock.json` committed with infra-007 (required for `npm ci` in CI).

**Shipped:**
- GitHub Actions: OpenAPI + `gen:types` drift, static gates (ruff/mypy/lint-imports/tsc/eslint).
- GHCR build/push on `main` / `v*`; PR build-only smoke.
- Plans: `Application/docs/plans/2026-06-08-infra-007-ci-design.md`, `...-ci.md`.

**Top blocker / next feature:** `infra-008` (frontend shell: layout, routing, theme, API client) — unblocked. Customer `U1` depends on `infra-008`. Follow-ups out of scope: VM image-pull cutover, pytest-in-CI with MySQL, pin backend dev tool versions in `pyproject.toml`.