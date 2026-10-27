-- AOS-054: remove spurious age/income structural dependence in NEW worlds.
-- Immutable existing synthetic household rows and historical election acts
-- remain exactly as they were. These are fictional people, not INE estimates.
-- Keep model lineage in every new row and the scoped aggregate profile.
alter table public.synthetic_households
  drop constraint synthetic_households_model_version_check;
alter table public.synthetic_households
  add constraint synthetic_households_model_version_check
    check(model_version in ('households-v1','households-v2'));
alter table public.synthetic_households
  alter column model_version set default 'households-v2';

-- Independent full-cycle permutations (gcd(37,300)=gcd(71,300)=1)
-- guarantee stable exact margins, while every age/income cell is populated.
-- District allocation and GLOBAL cohort weights are unchanged, but a new
-- coprime rank for cohort assignment separates political groups from geography.
-- This prevents purely structural single-cohort constituencies and preserves
-- exact 65/35 synthetic weights. Resident counts, sensitivity, campaign
-- effects and D'Hondt authority remain unchanged.
create or replace function game_internal.seed_synthetic_households(p_government uuid)
returns integer language plpgsql security definer set search_path='' as $$
declare v_rows integer;
begin
 if not exists(select 1 from public.governments g where g.id=p_government) then
   raise exception 'GOVERNMENT_NOT_FOUND' using errcode='42501'; end if;
 if (select count(*) from public.population_cohorts c where c.government_id=p_government)<2
   or (select sum(c.population_weight) from public.population_cohorts c
       where c.government_id=p_government)<>100 then
   raise exception 'HOUSEHOLD_INVALID_COHORT_WEIGHTS' using errcode='P0001'; end if;
 with cohorts as (
   select c.*,sum(c.population_weight) over(order by c.code) as ceiling
   from public.population_cohorts c where c.government_id=p_government
 ),
 generated as (
   select n as household_no,c.code as cohort_code,c.ideal_policy,c.support,c.trust,
     (1+(n*17)%5)::smallint as residents,
     case when (n*37+11)%300<90 then 'young'
       when (n*37+11)%300<240 then 'working'
       else 'senior' end as age_band,
     case when (n*71+29)%300<90 then 'low'
       when (n*71+29)%300<240 then 'middle'
       else 'high' end as income_band,
     case when n%7<5 then 'urban' else 'rural' end as settlement,
     case when (n-1)%100<25 then 'capital'
       when (n-1)%100<45 then 'industrial'
       when (n-1)%100<63 then 'coastal'
       when (n-1)%100<78 then 'agrarian'
       when (n-1)%100<90 then 'highland'
       else 'frontier' end as district_code
   from generate_series(1,300) n
   join cohorts c on ((n-1)*29+7)%100<c.ceiling
     and ((n-1)*29+7)%100>=c.ceiling-c.population_weight
 )
 insert into public.synthetic_households(
   government_id,household_no,cohort_code,residents,age_band,
   income_band,settlement,policy_preference,support,trust,district_code,model_version)
 select p_government,g.household_no,g.cohort_code,g.residents,g.age_band,
   g.income_band,g.settlement,
   greatest(0,least(100,g.ideal_policy+((g.household_no*19)%41)-20+
     case g.income_band when 'high' then 8 when 'low' then -8 else 0 end +
     case g.settlement when 'rural' then 4 else 0 end))::smallint,
   greatest(0,least(100,g.support+((g.household_no*13)%11)-5))::smallint,
   greatest(0,least(100,g.trust+((g.household_no*11)%9)-4))::smallint,
   g.district_code,'households-v2'
 from generated g
 on conflict(government_id,household_no) do nothing;
 get diagnostics v_rows=row_count;
 return v_rows;
end $$;
revoke all on function game_internal.seed_synthetic_households(uuid)
 from public,anon,authenticated;

-- Aggregate authorized geography with exactly the same household weights.

-- Historic governments keep their v1 profile; new seed is v2. Profile
-- access still requires an owner or actual match membership in SQL.
create or replace function public.get_population_profile(p_government_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_owner uuid:=auth.uid();
begin
 if v_owner is null or not exists (
   select 1 from public.governments g
   where g.id=p_government_id and (
     g.owner_id=v_owner or exists(
       select 1 from public.matches m
       join public.match_players p on p.match_id=m.id
       where m.government_id=g.id and p.user_id=v_owner)
   )) then raise exception 'GOVERNMENT_NOT_FOUND_OR_FORBIDDEN' using errcode='42501';
 end if;
 return jsonb_build_object(
   'modelVersion',coalesce(
     (select min(h.model_version) from public.synthetic_households h
      where h.government_id=p_government_id),'households-v2'),
   'households',(select count(*) from public.synthetic_households h
     where h.government_id=p_government_id),
   'sampleResidents',(select coalesce(sum(h.residents),0)
     from public.synthetic_households h where h.government_id=p_government_id),
   'districts',(select jsonb_agg(jsonb_build_object(
     'code',d.code,'label',d.label,'seats',d.seats) order by d.sort_order)
     from public.electoral_districts d),
   'segments',coalesce((
      with split as (
       select h.residents,h.support,h.trust,
         x.dimension,x.code from public.synthetic_households h
       cross join lateral (values
         ('age',h.age_band),('income',h.income_band),
         ('settlement',h.settlement),('cohort',h.cohort_code),
         ('district',h.district_code)
       ) x(dimension,code)
       where h.government_id=p_government_id
      )
      select jsonb_agg(jsonb_build_object(
        'dimension',s.dimension,'code',s.code,
        'households',s.households,'residents',s.residents,
        'support',s.support,'trust',s.trust
      ) order by s.dimension,s.code)
      from (select dimension,code,count(*)::integer as households,
        sum(residents)::integer as residents,
        round(sum(residents*support)::numeric/nullif(sum(residents),0))::integer as support,
        round(sum(residents*trust)::numeric/nullif(sum(residents),0))::integer as trust
        from split group by dimension,code) s
   ),'[]'::jsonb)
 );
end $$;
