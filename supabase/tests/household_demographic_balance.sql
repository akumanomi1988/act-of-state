-- AOS-054: rollback-only authentic deterministic seed + cohort/election contracts.
-- Demographic marginals are explicitly synthetic game-design distributions,
-- never real census measurements or empirical external validation.
begin;
insert into auth.users
 (id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at)
values
 ('65000000-0000-4000-8000-000000000001',
 '00000000-0000-0000-0000-000000000000','authenticated','authenticated',
 'balance-1@example.invalid','',now(),now(),now()),
 ('65000000-0000-4000-8000-000000000002',
 '00000000-0000-0000-0000-000000000000','authenticated','authenticated',
 'balance-2@example.invalid','',now(),now(),now());
create temporary table demographic_fixture(government_id uuid,match_id uuid,invite_code text,legacy_snapshot jsonb);
grant select,insert,update on pg_temp.demographic_fixture to authenticated;
set local role authenticated;
select set_config('request.jwt.claim.sub','65000000-0000-4000-8000-000000000001',true);
do $$
declare g public.governments%rowtype; m public.matches%rowtype; profile jsonb;
begin
 g:=public.start_government();
 m:=public.create_match('Demographic Balance Verification','Civic Forum');
 insert into pg_temp.demographic_fixture values(g.id,m.id,m.invite_code);
 profile:=public.get_population_profile(g.id);
 if profile->>'modelVersion'<>'households-v2' or
    (profile->>'households')::integer<>300 or
    (profile->>'sampleResidents')::integer<>900 then
   raise exception 'DEMOGRAPHIC_V2_PROFILE_NOT_VERSIONED';end if;
end $$;
reset role;
-- The original v1 correlated age and income perfectly in several cells.
-- V2 exact marginal counts: age 90/150/60, income 90/150/60.
do $$
declare gid uuid:=(select government_id from pg_temp.demographic_fixture);
 n integer; max_deviation numeric; actual integer; expected numeric;
 a text; i text; min_coverage integer;
begin
 if (select count(*) from public.synthetic_households
      where government_id=gid and model_version='households-v2')<>300
 then raise exception 'HOUSEHOLDS_V2_INCOMPLETE';end if;
 for a in select unnest(array['young','working','senior']) loop
   for i in select unnest(array['low','middle','high']) loop
     select count(*) into actual from public.synthetic_households
      where government_id=gid and age_band=a and income_band=i;
     expected:=(case a when 'young' then 90 when 'working' then 150 else 60 end)*
        (case i when 'low' then 90 when 'middle' then 150 else 60 end)/300.0;
     if actual=0 or abs(actual-expected)>3 then
       raise exception 'HOUSEHOLD_CROSSTAB_BIAS age=% income=% actual=% expected=%',
         a,i,actual,expected;
     end if;
   end loop;
 end loop;
 for a in select unnest(array['young','working','senior']) loop
   select count(*) into n from public.synthetic_households
    where government_id=gid and age_band=a;
   if n<>(case a when 'young' then 90 when 'working' then 150 else 60 end)
     then raise exception 'HOUSEHOLD_AGE_MARGINAL_CHANGED %',a;end if;
 end loop;
 for i in select unnest(array['low','middle','high']) loop
   select count(*) into n from public.synthetic_households
    where government_id=gid and income_band=i;
   if n<>(case i when 'low' then 90 when 'middle' then 150 else 60 end)
     then raise exception 'HOUSEHOLD_INCOME_MARGINAL_CHANGED %',i;end if;
 end loop;
 select count(*) into n from public.synthetic_households
   where government_id=gid and
   (district_code is null or residents not between 1 and 5 or
    policy_preference not between 0 and 100);
 if n<>0 then raise exception 'DEMOGRAPHIC_DISTRICT_OR_SCORE_INVALID';end if;
 select min(c) into min_coverage from (
   select district_code,count(distinct age_band) as c
   from public.synthetic_households where government_id=gid
   group by district_code) d;
 if min_coverage<3 then raise exception 'HOUSEHOLD_AGE_GAP_IN_DISTRICT';end if;
 -- Political cohorts must be represented in EACH district, rather than
 -- entirely segregated by the (n-1)%100 territorial mapping as in v1.
 if exists (
   select 1 from (
     select district_code,count(*) as families,
       count(*) filter(where cohort_code='households') as households_cohort,
       count(distinct cohort_code) as distinct_cohorts
     from public.synthetic_households
     where government_id=gid group by district_code
   ) d where distinct_cohorts<>2 or
      abs(households_cohort-families*0.65)>3
 ) then raise exception 'HOUSEHOLD_COHORT_DISTRICT_STRUCTURAL_SEGREGATION';end if;
 if (select count(*) from public.synthetic_households
      where government_id=gid and cohort_code='households')<>195
 then raise exception 'HOUSEHOLD_SYNTHETIC_COHORT_MARGIN_CHANGED';end if;
 if (select sum(residents) from public.synthetic_households
      where government_id=gid)<>900
 then raise exception 'DEMOGRAPHIC_RESIDENT_MASS_DRIFT';end if;
 if has_table_privilege('authenticated','public.synthetic_households','UPDATE') or
    has_table_privilege('anon','public.synthetic_households','SELECT') or
    has_function_privilege('anon','game_internal.seed_synthetic_households(uuid)','EXECUTE')
 then raise exception 'DEMOGRAPHIC_PRIVATE_TABLE_ACCESS_LEAK';end if;
end $$;

-- Prove new cohort/election geometry on actual authorized PostgreSQL RPCs.
set local role authenticated;
select set_config('request.jwt.claim.sub','65000000-0000-4000-8000-000000000002',true);
select public.join_match((select invite_code from pg_temp.demographic_fixture),
 'Social Counterparty');
select set_config('request.jwt.claim.sub','65000000-0000-4000-8000-000000000001',true);
select public.start_match((select match_id from pg_temp.demographic_fixture));
do $$
declare mid uuid:=(select match_id from pg_temp.demographic_fixture); p jsonb;
begin
 p:=public.get_election_state(mid)->'projection';
 if p->>'modelVersion'<>'electoral-districts-v2' or
   (p->>'householdSampleSize')::integer<>300 or
   jsonb_array_length(p->'districts')<>6 or
   (select sum((x->>'seats')::integer)
    from jsonb_array_elements(p->'parties') x)<>100 or
   (select sum((x->>'seats')::integer)
    from jsonb_array_elements(p->'districts') d
    cross join lateral jsonb_array_elements(d->'parties') x)<>100
 then raise exception 'DEMOGRAPHIC_V2_ELECTION_APPORTIONMENT_FAILED';end if;
end $$;

-- Mimic an installed v1 world: no login or retry is allowed to rewrite it.
reset role;
do $$
declare gid uuid:=(select government_id from pg_temp.demographic_fixture);
begin
 update public.synthetic_households h set
   model_version='households-v1',
   cohort_code=case when (h.household_no-1)%100<65 then 'households'
     else 'industry' end,
   age_band=case when h.household_no%10<3 then 'young'
    when h.household_no%10<8 then 'working' else 'senior' end,
   income_band=case when (h.household_no*7)%10<3 then 'low'
    when (h.household_no*7)%10<8 then 'middle' else 'high' end
 where h.government_id=gid;
 if (select count(*) from public.synthetic_households
   where government_id=gid and model_version='households-v1')<>300
 then raise exception 'LEGACY_MODEL_SIMULATION_MISSING';end if;
 -- Raw households are PRIVATE. Capture the privileged snapshot here,
 -- and do not read the table from the simulated authenticated role.
 update pg_temp.demographic_fixture set legacy_snapshot=(
   select jsonb_agg(to_jsonb(h) order by household_no)
   from public.synthetic_households h where h.government_id=gid);
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','65000000-0000-4000-8000-000000000001',true);
do $$
declare gid uuid:=(select government_id from pg_temp.demographic_fixture);
 profile jsonb;
begin
 profile:=public.get_population_profile(gid);
 if profile->>'modelVersion'<>'households-v1'
 then raise exception 'LEGACY_PROFILE_NOT_PRESERVED';end if;
 perform public.start_government();
 if public.get_population_profile(gid)<>profile
 then raise exception 'LEGACY_PROFILE_CHANGED_ON_LOGIN';end if;
end $$;
reset role;
do $$
declare gid uuid:=(select government_id from pg_temp.demographic_fixture);
 original jsonb:=(select legacy_snapshot from pg_temp.demographic_fixture);
 existing integer;
begin
 select count(*) into existing from public.synthetic_households h
   where h.government_id=gid;
 if existing<>300 or original is null or
  original<>(select jsonb_agg(to_jsonb(h) order by household_no)
    from public.synthetic_households h where h.government_id=gid)
 then raise exception 'LEGACY_HOUSEHOLD_RESEEDED';end if;
end $$;
rollback;
