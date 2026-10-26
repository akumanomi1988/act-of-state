-- AOS-027: fiscal policy/forecast, backend authentication, rollover, debt and clean rollback.
begin;
insert into auth.users
  (id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at)
select ('70000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
  '00000000-0000-0000-0000-000000000000',
  'authenticated','authenticated','fiscal-'||n||'@example.invalid','',
  now(),now(),now()
from generate_series(1,3) n;
create temporary table fiscal_fixture (gov_id uuid, other_id uuid);
grant select,insert,update on pg_temp.fiscal_fixture to authenticated;
set local role authenticated;
select set_config('request.jwt.claim.sub','70000000-0000-4000-8000-000000000001',true);
do $$
declare g public.governments%rowtype; other public.governments%rowtype;
  state jsonb; p public.fiscal_policies%rowtype; denied boolean;
begin
  g:=public.start_government();
  state:=public.get_fiscal_state(g.id);
  if (state->'policy'->>'health')::integer<>35 or
     (state->'policy'->>'education')::integer<>25 or
     (state->'policy'->>'infrastructure')::integer<>25 or
     (state->'policy'->>'security')::integer<>15 or
     (state->'policy'->>'tax_rate')::integer<>25 or
     (state->>'projectedRevenueM')::integer<>2375 or
     (state->>'projectedSpendingM')::integer<>2420 or
     (state->>'canEdit')::boolean is not true then
    raise exception 'FISCAL_DEFAULTS_INVALID: %',state; end if;
  denied:=false;
  begin perform public.set_fiscal_policy(g.id,35,25,25,25,25);
  exception when sqlstate 'P0001' then denied:=sqlerrm='FISCAL_INVALID_ALLOCATION'; end;
  if not denied then raise exception 'FISCAL_INVALID_TOTAL_ACCEPTED'; end if;
  denied:=false;
  begin perform public.set_fiscal_policy(g.id,10,50,25,15,27);
  exception when sqlstate 'P0001' then denied:=sqlerrm='FISCAL_CHANGE_TOO_LARGE'; end;
  if not denied then raise exception 'FISCAL_EXCESSIVE_CHANGE_ACCEPTED'; end if;
  p:=public.set_fiscal_policy(g.id,30,30,25,15,27);
  if p.tax_rate<>27 or not p.revised_this_week then
    raise exception 'FISCAL_REVISION_FAILED'; end if;
  if (public.set_fiscal_policy(g.id,30,30,25,15,27)).tax_rate<>27 then
    raise exception 'FISCAL_IDENTICAL_RETRY_FAILED'; end if;
  denied:=false;
  begin perform public.set_fiscal_policy(g.id,35,25,25,15,27);
  exception when sqlstate 'P0001' then denied:=sqlerrm='FISCAL_WEEK_ALREADY_REVISED'; end;
  if not denied then raise exception 'FISCAL_TWO_REVISIONS_ACCEPTED'; end if;
  state:=public.get_fiscal_state(g.id);
  if (state->>'canRevise')::boolean is not false or
     (state->>'projectedRevenueM')::integer<>2565 or
     (state->>'projectedSpendingM')::integer<>2400 or
     (state->'indicators'->>'debtM')::integer<>0 then
    raise exception 'FISCAL_FORECAST_INVALID'; end if;
  insert into pg_temp.fiscal_fixture values(g.id,null);
end $$;
-- New identity with its own government must not read/modify others' fiscal policy.
select set_config('request.jwt.claim.sub','70000000-0000-4000-8000-000000000002',true);
do $$
declare f record; denied boolean; g public.governments%rowtype;
begin
  select * into f from pg_temp.fiscal_fixture;
  denied:=false;
  begin perform public.get_fiscal_state(f.gov_id);
  exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'FISCAL_READ_ISOLATION_BROKEN'; end if;
  denied:=false;
  begin perform public.set_fiscal_policy(f.gov_id,35,25,25,15,25);
  exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'FISCAL_WRITE_ISOLATION_BROKEN'; end if;
  g:=public.start_government();
  update pg_temp.fiscal_fixture set other_id=g.id;
end $$;
-- Isolated UTC fixture: choose the Wednesday of the immediately previous\n-- closed fiscal week regardless of today's ISO weekday (the old -10 days\n-- shifted the start to an earlier week every Monday).
reset role;
update public.governments set created_at=((game_internal.week_start((now() at time zone 'UTC')::date)+case when extract(isodow from (now() at time zone 'UTC')::date)>=6 then 2 else -5 end)::timestamp at time zone 'UTC')
where id in (select gov_id from pg_temp.fiscal_fixture union
             select other_id from pg_temp.fiscal_fixture);
update public.fiscal_policies set created_at=((game_internal.week_start((now() at time zone 'UTC')::date)+case when extract(isodow from (now() at time zone 'UTC')::date)>=6 then 2 else -5 end)::timestamp at time zone 'UTC')
where government_id in (select gov_id from pg_temp.fiscal_fixture union
                        select other_id from pg_temp.fiscal_fixture);
insert into public.fiscal_policy_versions(
  government_id,effective_week,health,education,infrastructure,security,tax_rate
)
select government_id,
  game_internal.week_start((now() at time zone 'UTC')::date)-7,35,25,25,15,25
from public.fiscal_policies
where government_id in (select gov_id from pg_temp.fiscal_fixture union
                        select other_id from pg_temp.fiscal_fixture)
on conflict(government_id,effective_week) do nothing;
-- Debt issuance test: one country has no treasury for a deficit.
update public.governments set treasury_m_eur=0
where id=(select other_id from pg_temp.fiscal_fixture);
do $$
declare r jsonb; f record; a public.fiscal_weekly_acts%rowtype;
  v_last date; v_extra integer;
begin
  select * into f from pg_temp.fiscal_fixture;
  v_last:=game_internal.week_start((now() at time zone 'UTC')::date)-7;
  -- On Saturday/Sunday the current Friday is also closed: settle both countries.
  v_extra:=case when extract(isodow from (now() at time zone 'UTC')::date)>=6 then 2 else 0 end;
  if game_internal.settle_fiscal_week(f.gov_id,v_last) is not true then
    raise exception 'FISCAL_SETTLEMENT_NOT_CREATED'; end if;
  if game_internal.settle_fiscal_week(f.gov_id,v_last) is not false then
    raise exception 'FISCAL_SETTLEMENT_NOT_IDEMPOTENT'; end if;
  select * into a from public.fiscal_weekly_acts
   where government_id=f.gov_id and week_start=v_last;
  if a.revenue_m_eur<>2375 or a.spending_m_eur<>2420 or
    a.balance_m_eur<>-45 or a.treasury_after_m_eur<>11955 or
    a.debt_issued_m_eur<>0 or (a.policy_snapshot->>'tax_rate')::integer<>25 then
    raise exception 'FISCAL_SNAPSHOT_NOT_HISTORICAL: %',to_jsonb(a); end if;
  r:=game_internal.process_calendar();
  if (r->>'fiscalClosures')::integer<>1+v_extra or
     (r->>'fiscalErrors')::integer<>0 then
    raise exception 'FISCAL_CRON_BACKFILL_FAILED: %',r; end if;
  select * into a from public.fiscal_weekly_acts
    where government_id=f.other_id and week_start=v_last;
  if a.debt_issued_m_eur<>45 or a.debt_after_m_eur<>45 or
     a.treasury_after_m_eur<>0 then
    raise exception 'FISCAL_DEBT_ISSUANCE_INVALID'; end if;
  r:=game_internal.process_calendar();
  if (r->>'fiscalClosures')::integer<>0 or
     (select count(*) from public.fiscal_weekly_acts
       where government_id in (f.gov_id,f.other_id))<>2+v_extra then
    raise exception 'FISCAL_CRON_REPLAY_MUTATED_LEDGER'; end if;
  if (select count(*) from game_internal.fiscal_failures)<>0 then
    raise exception 'FISCAL_FAILURE_RECORD_LEFT_BEHIND'; end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','70000000-0000-4000-8000-000000000001',true);
do $$
declare f record; state jsonb;
begin
  select * into f from pg_temp.fiscal_fixture;
  state:=public.get_fiscal_state(f.gov_id);
  if jsonb_array_length(state->'history')<>
       (case when extract(isodow from (now() at time zone 'UTC')::date)>=6 then 2 else 1 end) or
     not exists(select 1 from jsonb_array_elements(state->'history') entry
       where (entry->>'balance_m_eur')::integer=-45) or
     (state->'indicators'->>'treasuryM')::integer<>
       (state->'history'->0->>'treasury_after_m_eur')::integer or
     (state->'policy'->>'tax_rate')::integer<>27 or
     has_table_privilege('authenticated','public.fiscal_policies','SELECT') or
     has_table_privilege('authenticated','public.fiscal_weekly_acts','INSERT') or
     has_schema_privilege('authenticated','game_internal','USAGE') or
     has_function_privilege('anon','public.get_fiscal_state(uuid)','EXECUTE') then
    raise exception 'FISCAL_SECURITY_OR_HISTORY_INVALID: %',state; end if;
end $$;
rollback;
