#!/usr/bin/env bash
# MediaJira local dev helper: pull code and start Docker dependencies.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

git pull origin main

if [[ ! -f .env ]]; then
  echo "Missing .env. Run: cp env.example .env" >&2
  echo "At minimum, set POSTGRES_PASSWORD and any required secrets." >&2
  exit 1
fi

docker compose -f docker-compose.dev.yml --env-file .env up -d db redis clamav backend frontend nginx celery-worker

# Nginx can keep stale upstream IPs after frontend/backend rebuilds, causing :80 to return 502.
docker compose -f docker-compose.dev.yml --env-file .env restart nginx

echo "Started: main entry http://localhost/ | frontend direct http://localhost:3000 | API http://localhost:8000"
