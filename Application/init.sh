#!/usr/bin/env bash
# Bootstrap PizzaHUST dev environment. Idempotent.
set -euo pipefail

cd "$(dirname "$0")"

echo "=== [1/6] Checking prerequisites ==="
command -v docker >/dev/null || { echo "docker required"; exit 1; }
command -v docker compose >/dev/null 2>&1 || command -v docker-compose >/dev/null || { echo "docker compose required"; exit 1; }
command -v node >/dev/null || { echo "node 22+ required"; exit 1; }
command -v python3 >/dev/null || { echo "python 3.12 required"; exit 1; }

echo "=== [2/6] .env ==="
[[ -f .env ]] || cp .env.example .env
set -a
# shellcheck disable=SC1091
source .env
set +a

MYSQL_HOST_PORT="${MYSQL_HOST_PORT:-33306}"
LOCAL_DATABASE_URL="mysql+pymysql://pizza:pizza@127.0.0.1:${MYSQL_HOST_PORT}/pizzahust"

echo "=== [3/6] Booting MySQL + delivery-mock ==="
docker compose up -d mysql delivery-mock

echo "Waiting for MySQL..."
until docker compose exec -T mysql mysqladmin ping -h127.0.0.1 --silent >/dev/null 2>&1; do
  sleep 2
done

echo "=== [4/6] Backend deps + migrations + seed ==="
pushd backend >/dev/null
  export DATABASE_URL="${DATABASE_URL:-$LOCAL_DATABASE_URL}"
  export DATABASE_URL="${DATABASE_URL/mysql:3306/127.0.0.1:${MYSQL_HOST_PORT}}"
  python3 -m venv .venv
  # shellcheck disable=SC1091
  source .venv/bin/activate
  pip install --quiet --upgrade pip
  pip install --quiet -e ".[dev]"
  alembic upgrade head
  python -m app.seeds.run
  deactivate
popd >/dev/null

echo "=== [5/6] Frontend deps ==="
pushd frontend >/dev/null
  npm install --silent
  if grep -qi microsoft /proc/version 2>/dev/null; then
    echo "WSL detected: skip Playwright Chromium install (use Chrome debug endpoint for e2e)."
  else
    npx playwright install --with-deps chromium >/dev/null 2>&1 || npx playwright install chromium
  fi
popd >/dev/null

echo "=== [6/6] Done. Bring up backend + frontend with: ==="
echo "    docker compose up -d backend frontend"
echo "Or run them locally:"
echo "    cd backend && source .venv/bin/activate && uvicorn app.main:app --reload"
echo "    cd frontend && npm run dev"
