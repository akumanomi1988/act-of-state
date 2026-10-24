-- AOS-031: synthetic Auth fixtures; all writes are transactionally rolled back.
begin;
insert into auth.users
 (id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at)
select ('35000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 '00000000-0000-0000-0000-000000000000',
 'authenticated','authenticated','households-'||n||'@example.invalid',
 '',now(),now(),now()
from generate_series(1,3) n;

create temporary table household_fixture(
 government_id uuid,match_id uuid,invite_code text,initial_profile jsonb
);
grant select,insert,update on pg_temp.household_fixture to authenticated;
set local role authenticated;
select set_config('request.jwt.claim.sub','35000000-0000-4000-8000-000000000001',true);

do $$
declare
  g public.governments%rowtype;
  profile jsonb; reread jsonb;
begin
 g:=public.start_government();
 profile:=public.get_population_profile(g.id);
 if profile->>'modelVersion'<>'households-v1'
    or (profile->>'households')::integer<>300
    or (profile->>'sampleResidents')::integer<300 then
   raise exception 'HOUSEHOLDS_NOT_SEEDED: %',profile; end if;
 if (select count(*) from jsonb_array_elements(profile->'segments') s
      where s->>'dimension'='age')<>3 then
   raise exception 'HOUSEHOLD_AGES_NOT_REPRESENTED'; end if;
 if (select sum((s->>'residents')::integer) from
   jsonb_array_elements(profile->'segments') s where s->>'dimension'='income')
   <>(profile->>'sampleResidents')::integer then
   raise exception 'HOUSEHOLD_MASS_NOT_CONSERVED'; end if;
 insert into pg_temp.household_fixture(government_id,initial_profile)
 values(g.id,profile);
 perform public.start_government();
 reread:=public.get_population_profile(g.id);
 if reread<>profile then
   raise exception 'HOUSEHOLDS_NOT_STABLE_ON_RELOGIN'; end if;
 if (select count(distinct (x->>'support')::integer)
     from jsonb_array_elements(profile->'segments') x)<2 then
   raise exception 'HOUSEHOLDS_NOT_HETEROGENEOUS'; end if;
 if has_table_privilege('authenticated','public.synthetic_households','SELECT')
    or has_table_privilege('authenticated','public.synthetic_households','UPDATE')
    or has_function_privilege('anon','public.get_population_profile(uuid)','EXECUTE') then
   raise exception 'HOUSEHOLDS_ACCESS_LEAK'; end if;
end $$;

-- Real server-side policy decision must change household microstates exactly once.
do $$
declare
 f record; original jsonb; changed jsonb;
 d public.decision_events%rowtype; repeated public.decision_events%rowtype;
 previous integer; actual integer;
begin
 select * into f from pg_temp.household_fixture;
 original:=public.get_population_profile(f.government_id);
 d:=public.submit_decision(f.government_id,'energy-resilience',1,'household-support');
 changed:=public.get_population_profile(f.government_id);
 if changed=original then raise exception 'HOUSEHOLDS_DID_NOT_REACT_TO_DECISION'; end if;
 repeated:=public.submit_decision(f.government_id,'energy-resilience',1,'household-support');
 if repeated.id<>d.id then raise exception 'HOUSEHOLD_DECISION_RETRY_INVALID'; end if;
 if public.get_population_profile(f.government_id)<>changed then
   raise exception 'HOUSEHOLD_DECISION_RETRY_DOUBLE_APPLIED'; end if;
 if (public.get_population_profile(f.government_id)->>'households')::integer<>300 then
   raise exception 'HOUSEHOLD_POPULATION_SIZE_CHANGED'; end if;
end $$;

-- A nonmember government owner must not inspect another match's microstates.
select set_config('request.jwt.claim.sub','35000000-0000-4000-8000-000000000003',true);
do $$
declare f record; denied boolean:=false;
begin
 select * into f from pg_temp.household_fixture;
 perform public.start_government();
 begin perform public.get_population_profile(f.government_id);
 exception when sqlstate '42501' then denied:=true; end;
 if not denied then raise exception 'HOUSEHOLD_CROSS_GOVERNMENT_LEAK'; end if;
end $$;
select set_config('request.jwt.claim.sub','35000000-0000-4000-8000-000000000001',true);
do $$
declare f record; m public.matches%rowtype;
begin
 select * into f from pg_temp.household_fixture;
 m:=public.create_match('Household Voting Match','Civic Coalition');
 update pg_temp.household_fixture set match_id=m.id,invite_code=m.invite_code;
 if m.government_id<>f.government_id then
   raise exception 'HOUSEHOLD_MATCH_GOVERNMENT_MISMATCH'; end if;
end $$;
select set_config('request.jwt.claim.sub','35000000-0000-4000-8000-000000000002',true);
do $$
declare f record; profile jsonb;
begin
 select * into f from pg_temp.household_fixture;
 perform public.join_match(f.invite_code,'Reform Party');
 profile:=public.get_population_profile(f.government_id);
 if (profile->>'households')::integer<>300 then
   raise exception 'HOUSEHOLD_MEMBER_READ_FAILED'; end if;
end $$;
select set_config('request.jwt.claim.sub','35000000-0000-4000-8000-000000000001',true);
do $$
declare f record; projection jsonb; elections public.match_elections%rowtype;
begin
 select * into f from pg_temp.household_fixture;
 perform public.start_match(f.match_id);
 projection:=public.get_election_state(f.match_id)->'projection';
 if projection->>'modelVersion'<>'electoral-households-v1'
    or (projection->>'householdSampleSize')::integer<>300
    or (select sum((x->>'seats')::integer)
       from jsonb_array_elements(projection->'parties') x)<>100
    or (select sum((x->>'voteSharePct')::numeric)
       from jsonb_array_elements(projection->'parties') x) not between 99.9 and 100.1
 then raise exception 'HOUSEHOLD_ELECTORAL_PROJECTION_INVALID: %',projection; end if;
end $$;

-- Trigger must also process autonomous fiscal effects, without making an
-- authenticated actor responsible for editing private table data.
reset role;
do $$
declare f record; old_json jsonb; next_json jsonb;
begin
 select * into f from pg_temp.household_fixture;
 select public.get_population_profile(f.government_id) into old_json;
 -- Auth is absent here by design: the scheduler is a privileged worker.
 update public.population_cohorts set trust=least(100,trust+3)
 where government_id=f.government_id and code='households';
 select public.get_population_profile(f.government_id) into next_json;
 -- Privileged direct DB assertion: generated family trust state moved atomically.
 if not exists(select 1 from public.synthetic_households
   where government_id=f.government_id and cohort_code='households' and trust>50)
 then raise exception 'HOUSEHOLD_AUTONOMOUS_POLICY_NOT_APPLIED'; end if;
end $$;
rollback;
