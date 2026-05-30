# infra-004 Auth + Auth UI Continuation Plan

## Goal
Deliver demo-ready authentication end-to-end for PizzaHust with cookie sessions, role-aware backend guards, CSRF protection, and a frontend auth experience aligned to the current design system.

## Implemented Checkpoints

### Checkpoint 1
- Added backend auth core: `register`, `login`, `logout`.
- Added session middleware in FastAPI app.
- Added Argon2 password hashing + verification utilities.
- Added error envelope handlers and request-id propagation.
- Added backend tests for auth core and health.

### Checkpoint 2
- Added auth rate limiting (in-memory, per-IP, per-route).
- Added CSRF double-submit guard.
- Added current-user guard and role guard utilities.
- Enforced rate limit on `register` + `login`.
- Enforced CSRF + authenticated user on `logout`.
- Added backend security tests (rate-limit + CSRF).

### Checkpoint 3
- Added `GET /api/auth/me` and `PATCH /api/auth/me`.
- Added `GET /api/loyalty/me`.
- Added seed logic for demo `admin` + `kitchen` users.
- Added env/docker seed variables.
- Added backend tests for profile + loyalty + seed accounts.

### Checkpoint 4 (Current)
- Added frontend auth provider + session bootstrap.
- Added auth-aware top navigation.
- Added `/login`, `/register`, `/account` pages.
- Added account profile edit + loyalty summary UI.
- Added frontend API client error handling + CSRF header injection.
- Added brand tokens and auth UI styling with primary `#D32F2F`.

## Pending Finalization
- Regenerate backend OpenAPI and sync `Application/openapi.json`.
- Run full `./verify.sh` from `Application/`.
- Update `feature_list.json`, `progress.md`, `session-handoff.md` with final evidence.
- Ensure `infra-003` marked done before closing `infra-004`.

## Commit Cadence
- Commit 1: backend auth core.
- Commit 2: guards + CSRF + rate-limit.
- Commit 3: me/profile/loyalty + seed accounts.
- Commit 4: frontend auth UI + docs/contracts/openapi/handoff.
