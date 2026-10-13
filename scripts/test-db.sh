#!/usr/bin/env bash
# Applies the Supabase migrations to a throwaway PostgreSQL database and runs the RLS tests.
# Usage: DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres scripts/test-db.sh
# The target database is dropped and recreated as "hohowho_test" on that server.
set -euo pipefail

: "${DATABASE_URL:?Set DATABASE_URL to an admin connection of a disposable PostgreSQL server}"
root="$(cd "$(dirname "$0")/.." && pwd)"
test_db="hohowho_test"
test_url="${DATABASE_URL%/*}/${test_db}"

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -c "drop database if exists ${test_db} with (force)" -c "create database ${test_db}"

psql "$test_url" -v ON_ERROR_STOP=1 -q -f "$root/supabase/tests/supabase_stub.sql"
for migration in "$root"/supabase/migrations/*.sql; do
  echo "Applying $(basename "$migration")"
  psql "$test_url" -v ON_ERROR_STOP=1 -q -f "$migration"
done
psql "$test_url" -v ON_ERROR_STOP=1 -q -f "$root/supabase/tests/rls_test.sql"
