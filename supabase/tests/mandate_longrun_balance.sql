-- AOS-053: isolated 12-week economic stress and honest 90-day observation.
-- All synthetic identities and dated fixtures are rolled back. No real clock
-- changes, fictional news publication, altered hosted users or persisted acts.
begin;
insert into auth.users
  (id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at)
select ('63000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
  '00000000-0000-0000-0000-000000000000','authenticated','authenticated',
  'aos53-'||n||'@example.invalid','',now(),now(),now()
from generate_series(1,2) n;
create temporary table aos53_fixture(government_id uuid);
grant select,insert on pg_temp.aos53_fixture to authenticated;
set local role authenticated;
select set_config('request.jwt.claim.sub','63000000-0000-4000-8000-000000000001',true);
do $$
declare gov public.governments%rowtype;
begin
 gov:=public.start_government();
 insert into pg_temp.aos53_fixture values(gov.id);
end $$;
reset role;
-- Initial historical policy is a fixture only: the actual server still uses
-- real UTC for decisions and public read models. Twelve completed weeks
-- constitute 84 days of discrete settlements, not 90 real elapsed days.
do $$
declare gid uuid:=(select government_id from pg_temp.aos53_fixture);
  first_week date:=game_internal.week_start((now() at time zone 'UTC')::date)-84;
  last_week date:=game_internal.week_start((now() at time zone 'UTC')::date)-7;
  closed integer:=0; repeated integer:=0; week date;
  act public.fiscal_weekly_acts%rowtype;
begin
 update public.governments set treasury_m_eur=300,
   created_at=(first_week+1)::timestamp at time zone 'UTC' where id=gid;
 update public.fiscal_policies set created_at=(first_week+1)::timestamp at time zone 'UTC'
   where government_id=gid;
 insert into public.fiscal_policy_versions(
   government_id,effective_week,health,education,infrastructure,security,tax_rate)
 values(gid,first_week,35,25,25,15,25);
 for n in 0..11 loop
   week:=first_week+n*7;
   if week>last_week then raise exception 'AOS53_UNCLOSED_FIXTURE_WEEK'; end if;
   if not game_internal.settle_fiscal_week(gid,week) then
     raise exception 'AOS53_SETTLEMENT_DID_NOT_COMMIT: %',week; end if;
   closed:=closed+1;
   if game_internal.settle_fiscal_week(gid,week) then
     raise exception 'AOS53_RETRY_DUPLICATED_WEEK: %',week; end if;
   repeated:=repeated+1;
 end loop;
 select * into act from public.fiscal_weekly_acts
   where government_id=gid order by week_start desc limit 1;
 if closed<>12 or repeated<>12 or
   (select count(*) from public.fiscal_weekly_acts where government_id=gid)<>12
   or (select count(*) from public.fiscal_weekly_acts where government_id=gid
     and balance_m_eur=-45)<>12
   or (select sum(debt_issued_m_eur) from public.fiscal_weekly_acts where government_id=gid)<>240
   or (select sum(debt_repaid_m_eur) from public.fiscal_weekly_acts where government_id=gid)<>0
   or (select debt_m_eur from public.governments where id=gid)<>240
   or (select treasury_m_eur from public.governments where id=gid)<>0
   or act.treasury_after_m_eur<>0 or act.debt_after_m_eur<>240 then
   raise exception 'AOS53_LONGRUN_CASHFLOW_OR_LEDGER_DRIFT: %',
     (select to_jsonb(g) from public.governments g where g.id=gid);
 end if;
 -- Daily welfare is purposely one real day, not auto-filled with those 84
 -- hypothetical fiscal dates. The official history has explicit gaps.
 if not game_internal.settle_daily_social_conditions(gid) then
   raise exception 'AOS53_REAL_DAY_SOCIAL_ACT_MISSING'; end if;
 if game_internal.settle_daily_social_conditions(gid) then
   raise exception 'AOS53_DAILY_RETRY_COMPOUNDED'; end if;
 if (select count(*) from public.daily_social_acts where government_id=gid)<>1
   or (select count(*) from public.fiscal_weekly_acts where government_id=gid)<>12
   or (select debt_m_eur from public.governments where id=gid)<>240 then
   raise exception 'AOS53_SOCIAL_DOUBLE_SETTLED_OR_FABRICATED_DAYS'; end if;
 raise notice 'AOS_90D_BALANCE_PASS: 12 closed fiscal weeks, 12 safe retries, 240 debt, one real UTC daily act';
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','63000000-0000-4000-8000-000000000001',true);
do $$
declare gid uuid:=(select government_id from pg_temp.aos53_fixture);
  history jsonb; fiscal jsonb; before_count integer;
begin
 fiscal:=public.get_fiscal_state(gid);
 history:=public.get_living_conditions(gid,90);
 if jsonb_array_length(fiscal->'history')<>12 or
   (fiscal->'indicators'->>'treasuryM')::integer<>0 or
   (fiscal->'indicators'->>'debtM')::integer<>240 or
   (history->>'recordedDays')::integer<>1 or
   (history->>'expectedDays')::integer<>1 then
    raise exception 'AOS53_AUTHORIZED_HISTORY_INVALID: fiscal %, social %',fiscal,history; end if;
 before_count:=jsonb_array_length(fiscal->'history');
 perform public.set_fiscal_policy(gid,30,30,25,15,27);
 fiscal:=public.get_fiscal_state(gid);
 if jsonb_array_length(fiscal->'history')<>before_count or
   (fiscal->'history'->0->>'balance_m_eur')::integer<>-45 or
   (fiscal->>'projectedRevenueM')::integer<>2565 then
   raise exception 'AOS53_PRESENT_POLICY_REWROTE_12_WEEK_PAST'; end if;
end $$;
select set_config('request.jwt.claim.sub','63000000-0000-4000-8000-000000000002',true);
do $$
declare gid uuid:=(select government_id from pg_temp.aos53_fixture);
  blocked boolean:=false;
begin
 begin perform public.get_fiscal_state(gid);
 exception when sqlstate '42501' then blocked:=true; end;
 if not blocked then raise exception 'AOS53_OUTSIDER_CAN_READ_FISCAL_HISTORY'; end if;
 blocked:=false;
 begin perform public.get_living_conditions(gid,90);
 exception when sqlstate '42501' then blocked:=true; end;
 if not blocked then raise exception 'AOS53_OUTSIDER_CAN_READ_SOCIAL_HISTORY'; end if;
end $$;
reset role;
rollback;
