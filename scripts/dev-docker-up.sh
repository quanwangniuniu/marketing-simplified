#!/usr/bin/env bash
# MediaJira 本地开发：拉代码 + 起 Docker 依赖（含容器内 Postgres，无需本机 PostgreSQL）。
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

git pull origin main

if [[ ! -f .env ]]; then
  echo "缺少 .env，请先执行: cp env.example .env" >&2
  echo "至少需要设置 POSTGRES_PASSWORD（以及与其它密钥相关的项）。" >&2
  exit 1
fi

docker compose -f docker-compose.dev.yml --env-file .env up -d db redis clamav backend frontend nginx celery-worker

# Nginx 会缓存 upstream 的旧 IP；frontend/backend 重建后若不重启 nginx 会出现 :80 返回 502。
docker compose -f docker-compose.dev.yml --env-file .env restart nginx

echo "已启动：无端口入口 http://localhost/ | 前端直连 http://localhost:3000 | API http://localhost:8000"
