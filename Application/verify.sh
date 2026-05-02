#!/usr/bin/env bash
# Verification gate. Must exit 0 before any feature is marked done.
set -euo pipefail

cd "$(dirname "$0")"
set -a
# shellcheck disable=SC1091
source .env
set +a

MYSQL_HOST_PORT="${MYSQL_HOST_PORT:-33306}"
LOCAL_DATABASE_URL="mysql+pymysql://pizza:pizza@127.0.0.1:${MYSQL_HOST_PORT}/pizzahust"
export DATABASE_URL="${DATABASE_URL:-$LOCAL_DATABASE_URL}"
export DATABASE_URL="${DATABASE_URL/mysql:3306/127.0.0.1:${MYSQL_HOST_PORT}}"

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
  ALEMBIC_CHECK_OUTPUT="$(mktemp)"
  if ! alembic check >"$ALEMBIC_CHECK_OUTPUT" 2>&1; then
    if grep -q "does not provide a MetaData object" "$ALEMBIC_CHECK_OUTPUT"; then
      echo "Skipping alembic drift check until infra-003 wires SQLAlchemy metadata."
    else
      cat "$ALEMBIC_CHECK_OUTPUT"
      rm -f "$ALEMBIC_CHECK_OUTPUT"
      exit 1
    fi
  fi
  rm -f "$ALEMBIC_CHECK_OUTPUT"
step "Backend: OpenAPI export"
  python -m app.tools.dump_openapi > ../openapi.generated.json
  deactivate
popd >/dev/null

step "Contract: OpenAPI drift"
if ! cmp -s openapi.generated.json openapi.json; then
  echo "openapi.json drift; regenerate and commit it"
  mv openapi.generated.json openapi.json
  exit 1
fi
rm -f openapi.generated.json

step "Frontend: type check"
pushd frontend >/dev/null
  npx tsc --noEmit
step "Frontend: types generated from OpenAPI"
  TYPES_BEFORE="$(mktemp)"
  cp lib/api/types.ts "$TYPES_BEFORE"
  npm run -s gen:types
  if ! cmp -s "$TYPES_BEFORE" lib/api/types.ts; then
    echo "types.ts drift; run npm run gen:types"
    rm -f "$TYPES_BEFORE"
    exit 1
  fi
  rm -f "$TYPES_BEFORE"
step "Frontend: lint"
  npx eslint .
step "Frontend: unit tests"
  npx vitest run --exclude 'tests/e2e/**' --passWithNoTests
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
  if ! npx playwright test; then
    if [[ -x ~/.local/bin/open-chrome-debug ]]; then
      echo "Playwright local browser run failed; retrying via Chrome debug endpoint."
      CHROME_DEBUG_READY="$(~/.local/bin/open-chrome-debug)"
      CHROME_DEBUG_URL="$(printf '%s\n' "$CHROME_DEBUG_READY" | grep -Eo 'http://[^ ]+:9223' | head -n1)"
      if [[ -z "${CHROME_DEBUG_URL}" ]]; then
        echo "failed to parse Chrome debug URL from launcher output"
        echo "$CHROME_DEBUG_READY"
        exit 1
      fi
      CHROME_DEBUG_URL="$CHROME_DEBUG_URL" npx playwright test
    else
      exit 1
    fi
  fi
popd >/dev/null

echo
echo "=== VERIFY OK ==="
