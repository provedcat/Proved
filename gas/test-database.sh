#!/usr/bin/env bash
# LOCAL ISOLATED TEST ONLY. Requires Docker. No host port, no production access.
set -euo pipefail
cd "$(dirname "$0")"
container="proved-pipeline-test-$$"
trap 'docker rm -f "$container" >/dev/null 2>&1 || true' EXIT
docker run --name "$container" --rm -d -e POSTGRES_HOST_AUTH_METHOD=trust \
  postgres:17-alpine@sha256:d3244e8ce3f165ee3c93d9c4a4b1d0fe48b3a89e2287b717fdcbbde92d405065 >/dev/null
for attempt in {1..30}; do
  if docker exec "$container" pg_isready -U postgres >/dev/null 2>&1; then break; fi
  sleep 1
done
for file in test-db-base.sql schema-proposal.sql test-database.sql; do
  docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 < "$file"
done
docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 <<'SQL'
insert into public.feeds values ('00000000-0000-0000-0000-000000000003');
SQL
race_query="set role service_role; select action from public.proved_insert_coupang_reference('cat','00000000-0000-0000-0000-000000000003','1','2','3',repeat('a',64),85,6,'wet_smallest_pack','00000000-0000-0000-0000-000000000010');"
docker exec "$container" psql -U postgres -v ON_ERROR_STOP=1 -c "$race_query" &
race_one=$!
docker exec "$container" psql -U postgres -v ON_ERROR_STOP=1 -c "$race_query" &
race_two=$!
wait "$race_one"
wait "$race_two"
docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 <<'SQL'
do $$ begin
 if (select count(*) from public.food_reference_prices where feed_id='00000000-0000-0000-0000-000000000003')<>1 then
 raise exception 'concurrent insert created duplicates'; end if;
end $$;
select 'PASS: concurrent RPCs produce exactly one reference' as result;
SQL
