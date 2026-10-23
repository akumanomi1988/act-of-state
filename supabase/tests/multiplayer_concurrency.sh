#!/usr/bin/env bash
# CI-only. Run only in disposable PostgreSQL with the CI Auth adapter.
set -euo pipefail
test_dir="$(mktemp -d)"
cleanup() {
  psql -X -v ON_ERROR_STOP=1 -q -c "delete from auth.users where id::text like '30000000-0000-4000-8000-%';" >/dev/null || true
  if [[ -d "$test_dir" ]]; then rm -r -- "$test_dir"; fi
}
trap cleanup EXIT
id_for() { printf '30000000-0000-4000-8000-%012d' "$1"; }
run_as_user() {
  local test_user_id="$1"
  local statement="$2"
  psql -X -v ON_ERROR_STOP=1 -q -c "begin;
    set local role authenticated;
    select set_config('request.jwt.claim.sub', '$test_user_id', true);
    set local statement_timeout = '30s';
    $statement
    commit;"
}
fail_with_log() {
  echo "AOS_CONCURRENCY_FAILURE: $1 client $2" >&2
  sed -n '1,35p' "$test_dir/$1-$2.log" >&2
  exit 1
}
psql -X -v ON_ERROR_STOP=1 -q -c "
  insert into auth.users
    (id,instance_id,aud,role,email,encrypted_password,
     email_confirmed_at,created_at,updated_at)
  select ('30000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,
    '00000000-0000-0000-0000-000000000000',
    'authenticated','authenticated',
    'aos-concurrency-' || n || '@example.invalid','',
    now(),now(),now()
  from generate_series(1,12) n;"
host_id="$(id_for 1)"
run_as_user "$host_id" "select (public.create_match('Concurrent Assembly','Civic Coalition')).id;" >"$test_dir/create.log" 2>&1
match_id="$(psql -X -Atq -v ON_ERROR_STOP=1 -c "select id from public.matches where host_user_id='$host_id';")"
invite_code="$(psql -X -Atq -v ON_ERROR_STOP=1 -c "select invite_code from public.matches where id='$match_id';")"
government_id="$(psql -X -Atq -v ON_ERROR_STOP=1 -c "select government_id from public.matches where id='$match_id';")"
if [[ ! "$invite_code" =~ ^[a-f0-9]{32}$ ]]; then echo "INVALID_INVITE" >&2; exit 1; fi

# Eleven simultaneous connections contend for nine remaining seats.
declare -a join_pids=()
for n in $(seq 2 12); do
  user_id="$(id_for "$n")"
  run_as_user "$user_id" "select pg_sleep(0.75);
    select seat_no from public.join_match('$invite_code','Political Party $n');" >"$test_dir/join-$n.log" 2>&1 &
  join_pids[$n]=$!
done
joined=0
full=0
for n in $(seq 2 12); do
  if wait "${join_pids[$n]}"; then
    joined=$((joined + 1))
  elif grep -q 'MATCH_FULL' "$test_dir/join-$n.log"; then
    full=$((full + 1))
  else
    fail_with_log join "$n"
  fi
done
if [[ "$joined" -ne 9 || "$full" -ne 2 ]]; then
  echo "CAPACITY_FAILED: joined=$joined full=$full" >&2; exit 1
fi
seat_counts="$(psql -X -Atq -v ON_ERROR_STOP=1 -c "select count(*) || ':' || count(distinct seat_no) || ':' ||
    count(distinct user_id) from public.match_players where match_id='$match_id';")"
if [[ "$seat_counts" != "10:10:10" ]]; then echo "SEAT_INTEGRITY_FAILED: $seat_counts" >&2; exit 1; fi
run_as_user "$host_id" "select status from public.start_match('$match_id');" >"$test_dir/start.log" 2>&1

# Ten concurrent retries of one national decision must execute once.
declare -a decision_pids=()
for n in $(seq 1 10); do
  run_as_user "$host_id" "select pg_sleep(0.5);
    select id from public.submit_decision('$government_id','energy-resilience',1,'household-support');" >"$test_dir/decision-$n.log" 2>&1 &
  decision_pids[$n]=$!
done
for n in $(seq 1 10); do
  if ! wait "${decision_pids[$n]}"; then fail_with_log decision "$n"; fi
done
outcome="$(psql -X -Atq -v ON_ERROR_STOP=1 -c "select
    (select count(*) from public.decision_events where government_id='$government_id') || ':' ||
    (select treasury_m_eur from public.governments where id='$government_id');")"
if [[ "$outcome" != "1:10600" ]]; then echo "DUPLICATE_EFFECT_FAILED: $outcome" >&2; exit 1; fi
psql -X -v ON_ERROR_STOP=1 -q -c "delete from auth.users where id::text like '30000000-0000-4000-8000-%';"
retained="$(psql -X -Atq -v ON_ERROR_STOP=1 -c "select
    (select count(*) from auth.users) || ':' ||
    (select count(*) from public.governments) || ':' ||
    (select count(*) from public.matches) || ':' ||
    (select count(*) from public.match_players) || ':' ||
    (select count(*) from public.match_stances) || ':' ||
    (select count(*) from public.decision_events);")"
if [[ "$retained" != "0:0:0:0:0:0" ]]; then echo "FIXTURE_LEAK: $retained" >&2; exit 1; fi
echo "AOS_CONCURRENCY_PASS: nine admissions, two full rejections, ten safe decision retries, zero retained rows"
