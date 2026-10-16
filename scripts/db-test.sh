#!/usr/bin/env bash
# Test migrations on a throwaway LOCAL Postgres (never the real Supabase project).
# Usage: PGPORT=54329 scripts/db-test.sh 0003_league_ops
# Needs a local Postgres (brew install postgresql@17) running on 127.0.0.1:$PGPORT, user postgres.
set -euo pipefail
cd "$(dirname "$0")/.."

NAME="${1:?usage: scripts/db-test.sh <migration name, e.g. 0003_league_ops>}"
PSQL="${PSQL:-/opt/homebrew/opt/postgresql@17/bin/psql}"
PORT="${PGPORT:-54329}"
DB="mcl_test_$$"
run() { "$PSQL" -h 127.0.0.1 -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -q "$@"; }

run -d postgres -c "create database $DB"
trap 'run -d postgres -c "drop database if exists $DB" >/dev/null' EXIT

run -d "$DB" -f supabase/tests/supabase-shim.sql
for m in supabase/migrations/*.sql; do
  # Apply every migration up to (but not including) the one under test, then its seed, then it.
  [[ "$(basename "$m" .sql)" == "$NAME" ]] && break
  run -d "$DB" -f "$m"
done
[[ -f "supabase/tests/$NAME.seed.sql" ]] && run -d "$DB" -f "supabase/tests/$NAME.seed.sql"
run -d "$DB" -f "supabase/migrations/$NAME.sql"
run -d "$DB" -f supabase/tests/runner.sql >/dev/null
run -d "$DB" -f "supabase/tests/$NAME.test.sql" >/dev/null

run -d "$DB" -P pager=off -c "
  select n, area, persona, test, expected, got, case when pass then 'PASS' else 'FAIL' end as result
  from t.results order by n"
run -d "$DB" -At -c "select count(*) filter (where pass) || ' passed, ' || count(*) filter (where not pass) || ' failed' from t.results"
test "$(run -d "$DB" -At -c "select count(*) from t.results where not pass")" = "0"
