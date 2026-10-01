#!/usr/bin/env bash
# Chạy bộ test API trên một DB PostgreSQL tạm.
#   ADMIN_DATABASE_URL=postgres://postgres@localhost:5432/postgres  (user có quyền CREATE DATABASE)
#   APP_DB_USER=app_owner  (tuỳ chọn: chạy app bằng user KHÔNG phải superuser, giống managed DB)
#   tests/api/run.sh
set -euo pipefail
cd "$(dirname "$0")/../.."

ADMIN_URL="${ADMIN_DATABASE_URL:?Cần ADMIN_DATABASE_URL}"
DB_NAME="spaflow_apitest"
PORT="${PORT:-3100}"

psql "$ADMIN_URL" -q -c "DROP DATABASE IF EXISTS $DB_NAME" -c "CREATE DATABASE $DB_NAME${APP_DB_USER:+ OWNER $APP_DB_USER}"
TEST_URL="${TEST_DATABASE_URL:-$(node -e "const u=new URL(process.argv[1]);u.pathname='/$DB_NAME';console.log(u.toString())" "$ADMIN_URL")}"
if [ -n "${APP_DB_USER:-}" ]; then
  psql "$(node -e "const u=new URL(process.argv[1]);u.pathname='/$DB_NAME';console.log(u.toString())" "$ADMIN_URL")" -q \
    -c "ALTER SCHEMA public OWNER TO $APP_DB_USER"
fi

export DATABASE_URL="$TEST_URL"
node scripts/db-migrate.mjs
psql "$DATABASE_URL" -q -v ON_ERROR_STOP=1 -f tests/api/seed.sql

export NODE_ENV=production COOKIE_INSECURE=true TRUST_PROXY=1 CRON_SECRET=test-cron-secret
npx next build > /tmp/spaflow-build.log 2>&1 || { tail -40 /tmp/spaflow-build.log; exit 1; }
setsid npx next start -p "$PORT" > /tmp/spaflow-server.log 2>&1 &
SERVER=$!
cleanup() { kill -- -"$SERVER" 2>/dev/null || kill "$SERVER" 2>/dev/null || true; }
trap cleanup EXIT
for i in $(seq 1 60); do curl -sf "http://localhost:$PORT/api/auth/session" >/dev/null && break; sleep 1; done

BASE_URL="http://localhost:$PORT" node --test --test-concurrency=1 tests/api/api.test.mjs
