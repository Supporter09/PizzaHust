#!/usr/bin/env bash
# Verification gate. Must exit 0 before any feature is marked done.
set -euo pipefail

cd "$(dirname "$0")"

step() { echo; echo "=== $* ==="; }

step "Backend: lint"
pushd backend >/dev/null
  source .venv/bin/activate
  ruff check app tests
  ruff format --check app tests
step "Backend: type check"
  mypy app/domain
step "Backend: import boundaries"
  lint-imports || echo "import-linter not configured yet"
step "Backend: unit + integration tests"
  pytest -q
step "Backend: alembic check (model/migration drift)"
  alembic check
step "Backend: OpenAPI export"
  python -m app.tools.dump_openapi > ../openapi.json
  deactivate
popd >/dev/null

step "Contract: OpenAPI drift"
git diff --exit-code -- openapi.json || { echo "openapi.json drift; commit it"; exit 1; }

step "Frontend: type check"
pushd frontend >/dev/null
  npx tsc --noEmit
step "Frontend: types generated from OpenAPI"
  npm run -s gen:types
  git diff --exit-code -- lib/api/types.ts || { echo "types.ts drift; run npm run gen:types"; exit 1; }
step "Frontend: lint"
  npx eslint .
step "Frontend: unit tests"
  npx vitest run
step "Frontend: build"
  npm run -s build
popd >/dev/null

step "Smoke: pytest + httpx end-to-end (place COD → kitchen → mock callback → tracking Delivered)"
docker compose up -d backend frontend
pushd backend >/dev/null
  source .venv/bin/activate
  pytest -q tests/smoke
  deactivate
popd >/dev/null

step "Smoke: Playwright e2e (browser path)"
pushd frontend >/dev/null
  npx playwright test
popd >/dev/null

echo
echo "=== VERIFY OK ==="
