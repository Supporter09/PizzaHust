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

echo "=== [3/6] Booting MySQL + delivery-mock ==="
docker compose up -d mysql delivery-mock

echo "Waiting for MySQL..."
until docker compose exec -T mysql mysqladmin ping -h127.0.0.1 --silent >/dev/null 2>&1; do
  sleep 2
done

echo "=== [4/6] Backend deps + migrations + seed ==="
pushd backend >/dev/null
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
  npx playwright install --with-deps chromium >/dev/null 2>&1 || npx playwright install chromium
popd >/dev/null

echo "=== [6/6] Done. Bring up backend + frontend with: ==="
echo "    docker compose up -d backend frontend"
echo "Or run them locally:"
echo "    cd backend && source .venv/bin/activate && uvicorn app.main:app --reload"
echo "    cd frontend && npm run dev"
