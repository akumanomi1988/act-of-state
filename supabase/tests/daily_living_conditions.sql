-- AOS-040: real PostgreSQL transactions, synthetic users, no email delivery.
begin;
insert into auth.users
 (id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at)
select ('46000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 '00000000-0000-0000-0000-000000000000','authenticated','authenticated',
 'aos40-'||n||'@example.invalid','',now(),now(),now()
from generate_series(1,3) n;
create temporary table social_fixture(government_id uuid,match_id uuid,invite_code text);
grant select,insert on pg_temp.social_fixture to authenticated;
set local role authenticated;
select set_config('request.jwt.claim.sub','46000000-0000-4000-8000-000000000001',true);
do $$
declare m public.matches%rowtype;
begin
 m:=public.create_match('Daily Social Nation','Social Cabinet');
 insert into pg_temp.social_fixture values(m.government_id,m.id,m.invite_code);
end $$;
select set_config('request.jwt.claim.sub','46000000-0000-4000-8000-000000000002',true);
select public.join_match((select invite_code from pg_temp.social_fixture),'Social Opposition');
select set_config('request.jwt.claim.sub','46000000-0000-4000-8000-000000000001',true);
select public.start_match((select match_id from pg_temp.social_fixture));
reset role;

create temporary table social_households_before as
 select h.household_no,h.cohort_code,h.support,h.trust from public.synthetic_households h
 where government_id=(select government_id from pg_temp.social_fixture);

do $$
declare low jsonb;high jsonb;baseline jsonb;stressed jsonb;
begin
 baseline:=game_internal.living_conditions('low','working','urban',100,700,250,35,25,25,15,25);
 if baseline<>jsonb_build_object('economicSecurity',62.50,'serviceAccess',50.00,'wellbeing',57.50) then
  raise exception 'SOCIAL_GOLDEN_FIXTURE_INCORRECT: %',baseline; end if;
 low:=game_internal.living_conditions('low','working','urban',100,700,1000,35,25,25,15,25);
 high:=game_internal.living_conditions('high','working','urban',100,700,1000,35,25,25,15,25);
 if (low->>'economicSecurity')::numeric>=(high->>'economicSecurity')::numeric then
  raise exception 'INFLATION_NOT_INCOME_SENSITIVE'; end if;
 stressed:=game_internal.living_conditions('low','senior','rural',40,3000,3000,10,10,10,10,45);
 if (stressed->>'wellbeing')::numeric<0 or (stressed->>'economicSecurity')::numeric<>0 then
  raise exception 'SOCIAL_BOUNDS_INCORRECT'; end if;
 if game_internal.living_conditions('low','senior','rural',100,700,250,45,25,25,15,25)->>'serviceAccess'
  = game_internal.living_conditions('low','working','urban',100,700,250,45,25,25,15,25)->>'serviceAccess' then
  raise exception 'PUBLIC_SERVICES_NOT_AGE_SENSITIVE'; end if;
end $$;

do $$
declare gid uuid:=(select government_id from pg_temp.social_fixture);
 g public.governments%rowtype;a public.daily_social_acts%rowtype;
 blocked boolean:=false;old_households jsonb;new_households jsonb;
begin
 select * into g from public.governments where id=gid;
 if not game_internal.settle_daily_social_conditions(gid) then raise exception 'FIRST_SOCIAL_ACT_MISSING'; end if;
 select * into a from public.daily_social_acts where government_id=gid;
 if a.engine_version<>'living-conditions-v1' or a.summary->>'households'<>'300'
  or jsonb_array_length(a.segments)<>9 or a.act_day<>(now() at time zone 'UTC')::date then
  raise exception 'SOCIAL_ACT_INCOMPLETE'; end if;
 if exists(select 1 from public.governments where id=gid and
  (treasury_m_eur<>g.treasury_m_eur or debt_m_eur<>g.debt_m_eur or
   gdp_index<>g.gdp_index or inflation_bp<>g.inflation_bp or unemployment_bp<>g.unemployment_bp)) then
  raise exception 'SOCIAL_ACT_DOUBLE_SETTLES_FISCAL_STATE'; end if;
 if exists(select 1 from public.synthetic_households where government_id=gid and
  (economic_security is null or service_access is null or wellbeing is null)) then
  raise exception 'HOUSEHOLD_LIVING_STATE_MISSING'; end if;
 if exists(select 1 from public.population_cohorts c,
  jsonb_array_elements(a.inputs->'cohortsBefore') b
  where c.government_id=gid and c.code=b->>'code' and
  (abs(c.support-(b->>'support')::integer)>1 or abs(c.trust-(b->>'trust')::integer)>1)) then
  raise exception 'DAILY_SOCIAL_INERTIA_BROKEN'; end if;
 if exists(select 1 from public.synthetic_households h
  join pg_temp.social_households_before b using(household_no,cohort_code)
  join public.population_cohorts c on c.government_id=h.government_id and c.code=h.cohort_code
  cross join jsonb_array_elements(a.inputs->'cohortsBefore') previous
  where h.government_id=gid and previous->>'code'=c.code and
   h.support<>greatest(0,least(100,b.support+round((c.support-(previous->>'support')::integer)*
      (75+(h.household_no%6)*10)/100.0)::integer))) then
  raise exception 'HOUSEHOLD_SOCIAL_RESPONSE_APPLIED_TWICE'; end if;
 select jsonb_agg(to_jsonb(h) order by h.household_no) into old_households
  from public.synthetic_households h where government_id=gid;
 update public.governments set inflation_bp=1500 where id=gid;
 if game_internal.settle_daily_social_conditions(gid) then raise exception 'DAILY_SOCIAL_DUPLICATED'; end if;
 select jsonb_agg(to_jsonb(h) order by h.household_no) into new_households
  from public.synthetic_households h where government_id=gid;
 if new_households<>old_households or
  (select inputs from public.daily_social_acts where government_id=gid)<>a.inputs then
  raise exception 'REPLAY_REWRITES_CAPTURED_CONDITIONS'; end if;
 begin update public.daily_social_acts set summary='{}' where government_id=gid;
 exception when sqlstate '23514' then blocked:=sqlerrm='DAILY_SOCIAL_ACT_IMMUTABLE'; end;
 if not blocked then raise exception 'SOCIAL_ACT_MUTABLE'; end if;
 blocked:=false;
 begin delete from public.daily_social_acts where government_id=gid;
 exception when sqlstate '23514' then blocked:=sqlerrm='DAILY_SOCIAL_ACT_IMMUTABLE'; end;
 if not blocked then raise exception 'SOCIAL_ACT_DELETABLE'; end if;
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub','46000000-0000-4000-8000-000000000002',true);
do $$
declare h jsonb;blocked boolean:=false;gid uuid:=(select government_id from pg_temp.social_fixture);
begin
 h:=public.get_living_conditions(gid,30);
 if h->>'recordedDays'<>'1' or h->>'expectedDays'<>'1'
  or h->'latest'->>'modelVersion'<>'living-conditions-v1' then
  raise exception 'MEMBER_SOCIAL_READ_FAILED'; end if;
 begin perform public.get_living_conditions(gid,10000);
 exception when sqlstate 'P0001' then blocked:=sqlerrm='LIVING_CONDITIONS_INVALID_WINDOW'; end;
 if not blocked then raise exception 'UNBOUNDED_SOCIAL_HISTORY'; end if;
end $$;
select set_config('request.jwt.claim.sub','46000000-0000-4000-8000-000000000003',true);
do $$
declare blocked boolean:=false;g public.governments%rowtype;h jsonb;
begin
 begin perform public.get_living_conditions((select government_id from pg_temp.social_fixture),30);
 exception when sqlstate '42501' then blocked:=true; end;
 if not blocked then raise exception 'OUTSIDER_SOCIAL_READ'; end if;
 g:=public.start_government();
 h:=public.get_living_conditions(g.id,7);
 if h->'latest'<>'null'::jsonb or h->>'expectedDays'<>'0'
  or h->>'recordedDays'<>'0' then raise exception 'EMPTY_HISTORY_INVENTED'; end if;
end $$;
reset role;

do $$
declare gid uuid;result jsonb;
begin
 -- Corrupt only the synthetic solo fixture to exercise isolated worker failure.
 select id into gid from public.governments
  where owner_id='46000000-0000-4000-8000-000000000003';
 delete from public.synthetic_households where government_id=gid and household_no=300;
 result:=game_internal.process_calendar();
 if not (result ? 'dailySocialActs') or (result->>'dailySocialErrors')::integer<1
  or not exists(select 1 from game_internal.daily_social_failures where government_id=gid)
  or exists(select 1 from public.daily_social_acts where government_id=gid) then
  raise exception 'SOCIAL_FAILURE_NOT_ISOLATED'; end if;
 perform game_internal.seed_synthetic_households(gid);
 update game_internal.daily_social_failures set attempted_at=now()-interval '16 minutes' where government_id=gid;
 perform game_internal.process_calendar();
 if not exists(select 1 from public.daily_social_acts where government_id=gid)
  or exists(select 1 from game_internal.daily_social_failures where government_id=gid) then
  raise exception 'SOCIAL_RETRY_DID_NOT_RECOVER'; end if;
 -- Owner deletion must still cascade through the new immutable ledger.
 delete from public.governments where id=gid;
 if exists(select 1 from public.daily_social_acts where government_id=gid) then
  raise exception 'SOCIAL_CASCADE_LEFT_ORPHANS'; end if;
end $$;

do $$
begin
 if has_table_privilege('authenticated','public.daily_social_acts','SELECT')
  or has_table_privilege('anon','public.daily_social_acts','SELECT')
  or has_function_privilege('authenticated','game_internal.settle_daily_social_conditions(uuid)','EXECUTE')
  or has_function_privilege('anon','public.get_living_conditions(uuid,integer)','EXECUTE')
  or not has_function_privilege('authenticated','public.get_living_conditions(uuid,integer)','EXECUTE') then
  raise exception 'SOCIAL_ACCESS_CONTRACT_FAILED'; end if;
end $$;
rollback;
