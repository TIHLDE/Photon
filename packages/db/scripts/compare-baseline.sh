#!/usr/bin/env bash
#
# Proves the migrations in packages/db/drizzle build the same schema production
# has. Exits non-zero and prints the diff if they do not.
#
#   packages/db/scripts/compare-baseline.sh <production dump>
#
# Takes a plain SQL dump or a `pg_dump -Fc` file. Everything happens in a
# throwaway Postgres container; production is never touched.
set -euo pipefail

if [[ $# -ne 1 || ! -f "$1" ]]; then
    echo "Usage: $0 <production dump>" >&2
    exit 2
fi

DUMP="$1"
DB_PACKAGE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONTAINER="photon-compare-baseline-$$"
PASSWORD="compare"
WORK="$(mktemp -d)"

cleanup() {
    docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
    rm -rf "$WORK"
}
trap cleanup EXIT

in_container() {
    docker exec -i "$CONTAINER" "$@"
}

psql_on() {
    local database="$1"
    shift
    in_container psql -U postgres -d "$database" -v ON_ERROR_STOP=1 -q "$@"
}

# The dump header and the \restrict tokens differ on every run.
schema_of() {
    in_container pg_dump -U postgres --schema-only --no-owner --no-privileges \
        --exclude-schema=drizzle "$1" | grep -vE '^\\(un)?restrict '
}

echo "Starting Postgres 17"
docker run -d --rm --name "$CONTAINER" -e POSTGRES_PASSWORD="$PASSWORD" \
    -p 127.0.0.1::5432 postgres:17 >/dev/null

until in_container pg_isready -U postgres -h 127.0.0.1 >/dev/null 2>&1; do
    sleep 1
done

PORT="$(docker port "$CONTAINER" 5432/tcp | head -n 1 | sed 's/.*://')"

psql_on postgres -c "CREATE ROLE photon" -c "CREATE DATABASE prod" -c "CREATE DATABASE baseline"

echo "Restoring $DUMP into prod"
docker cp "$DUMP" "$CONTAINER:/tmp/prod.dump" >/dev/null
if [[ "$(head -c 5 "$DUMP")" == "PGDMP" ]]; then
    in_container pg_restore -U postgres -d prod --exit-on-error /tmp/prod.dump
else
    # `pg_dump -n public` creates the schema itself.
    if grep -q '^CREATE SCHEMA public;' "$DUMP"; then
        psql_on prod -c "DROP SCHEMA public"
    fi
    psql_on prod -f /tmp/prod.dump >/dev/null
fi

echo "Applying the migrations to baseline"
(
    cd "$DB_PACKAGE"
    DATABASE_URL="postgresql://postgres:$PASSWORD@127.0.0.1:$PORT/baseline" \
        bun run db:migrate
)

schema_of prod >"$WORK/prod.sql"
schema_of baseline >"$WORK/baseline.sql"

if diff -u "$WORK/prod.sql" "$WORK/baseline.sql"; then
    echo "The migrations match production."
else
    echo "The migrations do NOT match production." >&2
    exit 1
fi
