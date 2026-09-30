#!/usr/bin/env bash
# Thử script chuyển dữ liệu: dựng 1 DB giả lập Supabase (schema auth của GoTrue + 9 migration cũ + dữ liệu mẫu),
# rồi chuyển sang 1 DB Postgres thuần mới và đối chiếu checksum.
#   ADMIN_DATABASE_URL=postgres://postgres@localhost:5432/postgres tests/import/run.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
ADMIN_URL="${ADMIN_DATABASE_URL:?Cần ADMIN_DATABASE_URL (superuser, để tạo DB và role giả lập Supabase)}"
url_for() { node -e "const u=new URL(process.argv[1]);u.pathname='/'+process.argv[2];console.log(u.toString())" "$ADMIN_URL" "$1"; }

psql "$ADMIN_URL" -q -c "DROP DATABASE IF EXISTS spaflow_import_src" -c "DROP DATABASE IF EXISTS spaflow_import_dst" \
  -c "CREATE DATABASE spaflow_import_src" -c "CREATE DATABASE spaflow_import_dst"
psql "$ADMIN_URL" -q -c "DO \$\$ BEGIN CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END \$\$"

SRC="$(url_for spaflow_import_src)"
psql "$SRC" -q -v ON_ERROR_STOP=1 -v dst_variant=0 -f tests/import/supabase_base.sql
for f in db/legacy-supabase/migrations/*.sql; do psql "$SRC" -q -v ON_ERROR_STOP=1 -f "$f" >/dev/null 2>&1; done
psql "$SRC" -q -v ON_ERROR_STOP=1 -f tests/import/seed_source.sql >/dev/null 2>&1

export DATABASE_URL="$(url_for spaflow_import_dst)" SUPABASE_DB_URL="$SRC"
node scripts/db-migrate.mjs
node scripts/import-from-supabase.mjs
