#!/usr/bin/env bash
# AOS-049. Disaster recovery drill on disposable CI PostgreSQL ONLY.
# No cloud database, secret extraction, production backup or service-role HTTP.
set -euo pipefail
[[ "${CI:-}" == "true" && "${PGHOST:-}" == "localhost" &&
   "${PGPORT:-}" == "5432" && "${PGDATABASE:-}" == "aos_test" ]] ||
   { echo 'AOS_RESTORE_NOT_DISPOSABLE_CI' >&2; exit 1; }
command -v pg_dump >/dev/null
command -v pg_restore >/dev/null
command -v createdb >/dev/null
command -v dropdb >/dev/null

fixture_user="82000000-0000-4000-8000-000000000001"
outsider_user="82000000-0000-4000-8000-000000000002"
restore_db="aos_restore_drill"
work="$(mktemp -d)"
cleanup() {
  PGPASSWORD="${PGPASSWORD:-postgres}" PGDATABASE=postgres dropdb --if-exists "$restore_db" >/dev/null 2>&1 || true
  psql -X -q -v ON_ERROR_STOP=1 -d aos_test <<'SQL' >/dev/null 2>&1 || true
delete from auth.users where id in (
 '82000000-0000-4000-8000-000000000001'::uuid,
 '82000000-0000-4000-8000-000000000002'::uuid
);
SQL
  rm -rf -- "$work"
}
trap cleanup EXIT

psql -X -v ON_ERROR_STOP=1 -d aos_test <<'SQL'
insert into auth.users
(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at)
select ('82000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 '00000000-0000-0000-0000-000000000000','authenticated','authenticated',
 'aos-recovery-'||n||'@example.invalid','',now(),now(),now()
from generate_series(1,2) n;
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub',
  '82000000-0000-4000-8000-000000000001',true);
do $$
declare gov public.governments%rowtype; signed public.decision_events%rowtype;
begin
 gov:=public.start_government();
 signed:=public.submit_decision(gov.id,'energy-resilience',1,'household-support');
 if signed.state_after->>'treasury_m_eur'<>'10600' then
  raise exception 'AOS_RESTORE_FIXTURE_UNEXPECTED_TREASURY';
 end if;
end $$;
commit;
SQL

# Capture a committed public-government snapshot without copying live user data.
source_integrity="$(psql -X -Atq -v ON_ERROR_STOP=1 -d aos_test -c "
  select count(*)||':'||coalesce(sum(g.treasury_m_eur),0)||':'||
    (select count(*) from public.decision_events e join public.governments g2
      on g2.id=e.government_id
      where g2.owner_id='$fixture_user'::uuid)
  from public.governments g where g.owner_id='$fixture_user'::uuid")"
[[ "$source_integrity" == '1:10600:1' ]] ||
  { echo "AOS_RESTORE_SOURCE_SNAPSHOT_BAD" >&2; exit 1; }

# The client and server versions must permit a full PostgreSQL-17 dump.
# pg_dump refuses older clients; that is a release-recovery blocker.
pg_dump -X 2>/dev/null && { echo 'Unexpected pg_dump -X behavior' >&2; exit 1; } || true
pg_dump -Fc -d aos_test -f "$work/aos.dump"
[[ -s "$work/aos.dump" ]] || { echo 'AOS_RESTORE_EMPTY_DUMP' >&2; exit 1; }
PGDATABASE=postgres createdb "$restore_db"
pg_restore --no-owner --exit-on-error -d "$restore_db" "$work/aos.dump"

restored_integrity="$(psql -X -Atq -v ON_ERROR_STOP=1 -d "$restore_db" -c "
  select count(*)||':'||coalesce(sum(g.treasury_m_eur),0)||':'||
    (select count(*) from public.decision_events e join public.governments g2
      on g2.id=e.government_id
      where g2.owner_id='$fixture_user'::uuid)
  from public.governments g where g.owner_id='$fixture_user'::uuid")"
[[ "$restored_integrity" == "$source_integrity" ]] ||
  { echo 'AOS_RESTORE_LEDGER_MISMATCH' >&2; exit 1; }

# Auth user and exactly one immutable event must survive a new connection.
# A second account still has no right to read that government's world.
psql -X -v ON_ERROR_STOP=1 -d "$restore_db" <<'SQL'
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub',
  '82000000-0000-4000-8000-000000000001',true);
do $$
declare gov public.governments%rowtype; world jsonb;
  original uuid; retry public.decision_events%rowtype;
begin
 gov:=public.start_government();
 world:=public.get_government_world(gov.id);
 if jsonb_array_length(world->'events')<>1 or
    (world->'government'->>'treasury_m_eur')::integer<>10600 then
   raise exception 'AOS_RESTORE_WORLD_DIFFERENCE'; end if;
 original:=(world->'events'->0->>'id')::uuid;
 retry:=public.submit_decision(gov.id,'energy-resilience',1,'household-support');
 if retry.id<>original then raise exception 'AOS_RESTORE_RETRY_MUTATED_HISTORY'; end if;
end $$;
rollback;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub',
  '82000000-0000-4000-8000-000000000002',true);
do $$
declare gov uuid; denied boolean:=false;
begin
 select id into gov from public.governments where
  owner_id='82000000-0000-4000-8000-000000000001'::uuid;
 if gov is not null then raise exception 'AOS_RESTORE_OWNER_RLS_LEAK'; end if;
 if exists(select 1 from public.decision_events) then
  raise exception 'AOS_RESTORE_PRIVATE_EVENT_LEAK'; end if;
end $$;
rollback;
SQL

permissions="$(psql -X -Atq -v ON_ERROR_STOP=1 -d "$restore_db" -c "
  select has_table_privilege('authenticated','public.match_campaign_events','SELECT')||
    ':'||has_table_privilege('anon','public.decision_events','SELECT')||
    ':'||has_function_privilege('anon','public.submit_decision(uuid,text,integer,text)','EXECUTE')")"
[[ "$permissions" == 'false:false:false' ]] ||
  { echo 'AOS_RESTORE_RLS_OR_GRANTS_DIFFER' >&2; exit 1; }

echo 'AOS_DISPOSABLE_RESTORE_PASS: committed signed act, retry invariants, Auth RLS, private grants, cross-connection recovery'
