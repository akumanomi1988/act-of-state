-- AOS-057. Empirically anchored new-game household archetypes.
-- Sources and domain-transfer limits: docs/POPULATION_CALIBRATION_REVIEW.md.
-- No existing v1/v2 household or certified political act is rewritten.
alter table public.synthetic_households
 drop constraint synthetic_households_model_version_check;
alter table public.synthetic_households
 add constraint synthetic_households_model_version_check
 check(model_version in ('households-v1','households-v2','households-v3'));
alter table public.synthetic_households
 alter column model_version set default 'households-v3';
-- 300 agents, 747 resident weights, 2.49 people/household (INE 2026).
-- Size mix: 85 one, 87 two, 60 three, 32 four, 36 five.
-- Age adult resident proxy: 62 20-34,161 35-64,77 65+ (INE 2025).
-- Municipality-size proxy: 241 >=10k,59 <10k (INE 2025).
-- Income ranking: bottom 20%,middle 60%,top 20% (relative tiers).
-- Cohort politics and government welfare response remain fictional.
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
     (case when (n*127+5)%300<85 then 1 when (n*127+5)%300<172 then 2 when (n*127+5)%300<232 then 3 when (n*127+5)%300<264 then 4 else 5 end)::smallint as residents,
     case when (n*37+11)%300<62 then 'young'
       when (n*37+11)%300<223 then 'working'
       else 'senior' end as age_band,
     case when (n*71+29)%300<60 then 'low'
       when (n*71+29)%300<240 then 'middle'
       else 'high' end as income_band,
     case when (n*83+23)%300<241 then 'urban' else 'rural' end as settlement,
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
   g.district_code,'households-v3'
 from generated g
 on conflict(government_id,household_no) do nothing;
 get diagnostics v_rows=row_count;
 return v_rows;
end $$;
