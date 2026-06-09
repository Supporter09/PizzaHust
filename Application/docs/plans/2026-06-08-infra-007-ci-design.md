# infra-007 CI Pipelines Design

## Goal

Stand up the project's first GitHub Actions CI under `.github/workflows/`, covering two
separate concerns: (A) a contract-drift gate that fails PRs when `openapi.json` or the
generated frontend types fall out of sync (the named infra-007 deliverable), and
(B) a build-and-push pipeline that publishes first-party component images to GHCR.

The export and type-generation pipeline itself already exists (`app.tools.dump_openapi`,
`npm run gen:types`, and the drift checks in `verify.sh:41-66`); infra-007 lifts those
gates into CI rather than reimplementing them.

## Scope decisions (settled)

- **Registry:** GHCR (`ghcr.io/supporter09/pizzahust-*`), pushed with the built-in
  `GITHUB_TOKEN` — no new secrets, no cloud federation.
- **Cutover:** build + push only. The VM keeps building on boot (`startup.sh.tftpl:173`).
  Rewiring the VM to pull `image:`-pinned tags is a deliberate follow-up task, not this one.
- **Components:** `backend` and `frontend` only. `delivery-mock` is excluded — it is a real
  prod dependency today (`DELIVERY_PROVIDER=mock`), so replacing it with a real provider is a
  hard prerequisite before the image-pull cutover task can land.

## Part A — `ci.yml` (contract-drift gate)

Trigger: `pull_request` + `push` to `main`. One `contracts` job on `ubuntu-latest`, no MySQL
service (`app.openapi()` builds the schema from routes without a live DB). `app.main` calls
`get_settings()` at import, and `Settings` (`backend/app/infra/config.py:12`) requires
`DATABASE_URL` + `SESSION_SECRET` — so the job sets both as dummies (never connected; the
URL string is only validated, not dialed). `DELIVERY_WEBHOOK_SECRET` is read from the env
directly by the webhook handler, not via `Settings`, so it is not needed for schema export.
The job mirrors `verify.sh:41-66`:

1. Install backend deps, run `dump_openapi`, `cmp` against committed `openapi.json` — fail on drift.
2. `npm ci` in `frontend/`, run `gen:types`, `cmp` against committed `lib/api/types.ts` — fail on drift.
3. Cheap no-DB static gates: backend `ruff check` + `ruff format --check` + `mypy app/domain` +
   `lint-imports`; frontend `tsc --noEmit` + `eslint`.

Out of scope: `pytest` (needs MySQL) — deferred to a later DB-services CI task.

## Part B — `docker-images.yml` (build + push to GHCR)

Trigger: `push` to `main` + tags `v*`; on `pull_request`, build-only (no push) to catch
Dockerfile breakage. Permissions: `contents: read`, `packages: write`.

Matrix over `backend` and `frontend`. Per component: `login-action@v4` → ghcr.io
(skipped on `pull_request` — PR jobs are build-only with `push: false`, and a fork PR's
token is read-only, so logging in is both unnecessary and a failure risk),
`setup-buildx-action@v4`, `metadata-action@v6`, `build-push-action@v7` with
`context: Application/<component>`, `platforms: linux/amd64` (VM is amd64 — no QEMU/arm64),
`cache-from/to: type=gha`, and `push: ${{ github.event_name != 'pull_request' }}`.
The frontend build passes `build-args: NEXT_PUBLIC_API_BASE_URL=/api` so the published image
matches the prod same-origin value and is cutover-ready.

Tags via metadata-action: `sha-<short>`, branch, `latest` on main, semver on `v*`.
Both images build on every main push (two small images — simplest). Path-filtered
per-component rebuild is a noted-but-unbuilt optimization.

## Testing / Definition of Done

Workflow files can't be fully executed locally, so the gate is `actionlint` clean, then proof
on a real PR:

1. Flip one byte in `openapi.json` → the `contracts` job goes red; revert → green.
2. Merge to `main` → `pizzahust-backend` and `pizzahust-frontend` appear in GHCR packages with
   the expected tags.

## Explicitly out of scope (follow-up tasks)

- VM image-pull cutover (rewire `startup.sh.tftpl` `$DC build` → `pull` + `image:` overlay).
- GHCR package visibility (public vs private + VM pull creds) — decided at cutover.
- `pytest`-in-CI with a MySQL service container.
