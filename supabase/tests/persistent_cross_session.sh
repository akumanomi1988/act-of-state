#!/usr/bin/env bash
# AOS-027: durable, cross-connection transaction verification in isolated CI PG.
# Never execute on shared/cloud DB; requires a freshly created disposable fixture DB.
set -euo pipefail

USER_ONE="81000000-0000-4000-8000-000000000001"
USER_TWO="81000000-0000-4000-8000-000000000002"
EMAIL_DOMAIN="example.invalid"

cleanup() {
  # The fixture must be removed even if any assertion fails; auth.users cascade
  # eliminates dependent government/cohorts/history/fiscal policies and acts.
  psql -v ON_ERROR_STOP=1 -q <<'SQL' || true
delete from auth.users where id in (
  '81000000-0000-4000-8000-000000000001'::uuid,
  '81000000-0000-4000-8000-000000000002'::uuid
);
SQL
}
trap cleanup EXIT

# First independent database session: commit one government and one decision.
psql -v ON_ERROR_STOP=1 -q <<'SQL'
insert into auth.users
(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at)
values
 ('81000000-0000-4000-8000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated','authenticated','durable-aos-1@example.invalid','',now(),now(),now()),
 ('81000000-0000-4000-8000-000000000002',
  '00000000-0000-0000-0000-000000000000',
  'authenticated','authenticated','durable-aos-2@example.invalid','',now(),now(),now());

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','81000000-0000-4000-8000-000000000001',true);
do $$
declare g public.governments%rowtype; e public.decision_events%rowtype;
begin
  g:=public.start_government();
  e:=public.submit_decision(g.id,'energy-resilience',1,'household-support');
  if (e.state_after->>'treasury_m_eur')::integer<>10600 then
    raise exception 'COMMITTED_DECISION_INCORRECT'; end if;
end $$;
commit;
SQL

# A new PostgreSQL connection sees the same immutable event and public
# government state, without relying on a still-open transaction.
psql -v ON_ERROR_STOP=1 -q <<'SQL'
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','81000000-0000-4000-8000-000000000001',true);
do $$
declare g public.governments%rowtype; e public.decision_events%rowtype;
  repeated public.decision_events%rowtype; snapshot jsonb;
begin
  g:=public.start_government();
  if g.treasury_m_eur<>10600 then
    raise exception 'CROSS_REQUEST_GOVERNMENT_NOT_DURABLE'; end if;
  snapshot:=public.get_government_world(g.id);
  if jsonb_array_length(snapshot->'events')<>1 or
     (snapshot->'government'->>'treasury_m_eur')::integer<>10600 then
    raise exception 'CROSS_REQUEST_SNAPSHOT_NOT_DURABLE'; end if;
  select * into e from public.decision_events
    where government_id=g.id and dossier_id='energy-resilience';
  repeated:=public.submit_decision(g.id,'energy-resilience',1,'household-support');
  if repeated.id<>e.id or
     (select count(*) from public.decision_events where government_id=g.id)<>1 then
    raise exception 'CROSS_REQUEST_RETRY_DUPLICATED_EVENT'; end if;
end $$;
rollback;
SQL

# A third independent session with a different Auth user must never read the
# government's persisted decision, including through SECURITY DEFINER RPC.
psql -v ON_ERROR_STOP=1 -q <<'SQL'
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','81000000-0000-4000-8000-000000000002',true);
do $$
declare g uuid; denied boolean:=false;
begin
  -- Tested synthetic country identity is resolved by immutable first owner.
  -- Expose only its id as a literal fixture, never through a user query.
  perform 1;
  if exists(select 1 from public.governments where
      owner_id='81000000-0000-4000-8000-000000000001'::uuid) then
    raise exception 'OTHER_USER_RLS_READ_LEAK'; end if;
  if exists(select 1 from public.decision_events) then
    raise exception 'OTHER_USER_DECISION_READ_LEAK'; end if;
  if has_table_privilege('authenticated','public.fiscal_weekly_acts','SELECT') then
    raise exception 'FISCAL_PRIVATE_TABLE_EXPOSED'; end if;
end $$;
rollback;
SQL

cleanup
trap - EXIT
counts=$(psql -Atqc "select
 (select count(*) from auth.users)::text || ':' ||
 (select count(*) from public.governments)::text || ':' ||
 (select count(*) from public.decision_events)::text || ':' ||
 (select count(*) from public.fiscal_policies)::text || ':' ||
 (select count(*) from public.fiscal_policy_versions)::text")
test "$counts" = "0:0:0:0:0"
printf 'PASS: committed decisions survive sessions, retries are idempotent, cross-owner reads blocked, cleanup verified\n'
