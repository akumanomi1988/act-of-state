-- AOS-040: daily living conditions, versioned synthetic social feedback.
-- No real-world forecasts and no additional treasury/debt settlement.
alter table public.synthetic_households
 add column economic_security numeric(5,2) check(economic_security between 0 and 100),
 add column service_access numeric(5,2) check(service_access between 0 and 100),
 add column wellbeing numeric(5,2) check(wellbeing between 0 and 100);

create table public.daily_social_acts (
 government_id uuid not null references public.governments(id) on delete cascade,
 act_day date not null,
 captured_at timestamptz not null default now(),
 engine_version text not null check(engine_version='living-conditions-v1'),
 inputs jsonb not null,
 summary jsonb not null,
 segments jsonb not null check(jsonb_typeof(segments)='array'),
 primary key(government_id,act_day)
);
alter table public.daily_social_acts enable row level security;
revoke all on public.daily_social_acts from public,anon,authenticated;

create table game_internal.daily_social_failures (
 government_id uuid primary key references public.governments(id) on delete cascade,
 act_day date not null,
 last_error text not null,
 attempts integer not null default 1,
 attempted_at timestamptz not null default now()
);
revoke all on game_internal.daily_social_failures from public,anon,authenticated;

create function game_internal.guard_daily_social_act()
returns trigger language plpgsql set search_path='' as $$
begin
 -- Permit only the parent FK's cascading cleanup; never rewrite an act.
 if tg_op='DELETE' and not exists(select 1 from public.governments
   where id=old.government_id) then return old; end if;
 raise exception 'DAILY_SOCIAL_ACT_IMMUTABLE' using errcode='23514';
end $$;
create trigger daily_social_act_immutable before update or delete
 on public.daily_social_acts for each row
 execute function game_internal.guard_daily_social_act();

-- Pure numeric contract; same inputs always yield the same bounded scores.
create function game_internal.living_conditions(
 p_income text,p_age text,p_settlement text,p_gdp numeric,
 p_unemployment integer,p_inflation integer,p_health integer,
 p_education integer,p_infrastructure integer,p_security integer,p_tax integer
) returns jsonb language sql immutable set search_path='' as $$
 with scores as (
  select greatest(0,least(100,65+(p_gdp-100)*0.25-
    (p_unemployment-700)/50.0-greatest(0,p_inflation-200)/
      case p_income when 'low' then 20.0 when 'middle' then 35.0 else 60.0 end-
    (p_tax-25)*case p_income when 'high' then 0.9 when 'low' then 0.35 else 0.6 end
   )) as economic,
   greatest(0,least(100,50+
    (p_health-35)*case p_age when 'senior' then 1.2 else 0.6 end+
    (p_education-25)*case p_age when 'young' then 1.1 else 0.4 end+
    (p_infrastructure-25)*case p_settlement when 'rural' then 0.9 else 0.5 end+
    (p_security-15)*0.4)) as services
 ) select jsonb_build_object('economicSecurity',round(economic,2),
   'serviceAccess',round(services,2),'wellbeing',round(economic*0.6+services*0.4,2))
 from scores
$$;

create function game_internal.settle_daily_social_conditions(p_government_id uuid)
returns boolean language plpgsql set search_path='' as $$
declare
 v_day date:=(now() at time zone 'UTC')::date;
 v_g public.governments%rowtype;
 v_policy public.fiscal_policies%rowtype;
 v_inputs jsonb;v_summary jsonb;v_segments jsonb;
 v_approval smallint;v_trust smallint;
begin
 -- Match before government: identical lock order to executive/fiscal writes.
 perform 1 from public.matches where government_id=p_government_id for update;
 select * into v_g from public.governments where id=p_government_id for update;
 if not found then raise exception 'GOVERNMENT_NOT_FOUND' using errcode='42501'; end if;
 if exists(select 1 from public.matches where government_id=p_government_id and status<>'active') then
  return false; end if;
 if exists(select 1 from public.daily_social_acts
   where government_id=p_government_id and act_day=v_day) then return false; end if;
 if (select count(*) from public.synthetic_households
   where government_id=p_government_id)<>300 then
  raise exception 'HOUSEHOLDS_NOT_INITIALIZED' using errcode='P0001'; end if;
 select * into strict v_policy from public.fiscal_policies
  where government_id=p_government_id;
 v_inputs:=jsonb_build_object('gdpIndex',v_g.gdp_index,
   'unemploymentBp',v_g.unemployment_bp,'inflationBp',v_g.inflation_bp,
   'policy',to_jsonb(v_policy)-'government_id'-'created_at'-'updated_at',
   'cohortsBefore',(select jsonb_agg(jsonb_build_object('code',code,
     'support',support,'trust',trust) order by code) from public.population_cohorts
     where government_id=p_government_id));
 with scores as (
  select h.household_no,game_internal.living_conditions(
   h.income_band,h.age_band,h.settlement,v_g.gdp_index,v_g.unemployment_bp,
   v_g.inflation_bp,v_policy.health,v_policy.education,v_policy.infrastructure,
   v_policy.security,v_policy.tax_rate) as value
  from public.synthetic_households h where h.government_id=p_government_id
 ) update public.synthetic_households h set
  economic_security=(s.value->>'economicSecurity')::numeric,
  service_access=(s.value->>'serviceAccess')::numeric,
  wellbeing=(s.value->>'wellbeing')::numeric
 from scores s where h.government_id=p_government_id and h.household_no=s.household_no;
 -- Social inertia: at most one support/trust point per cohort per real day.
 -- Reuse cohort propagation so household effects are never applied twice.
 with targets as (
  select cohort_code,sum(residents*wellbeing)/sum(residents) as wellbeing
  from public.synthetic_households where government_id=p_government_id
  group by cohort_code
 ) update public.population_cohorts c set
  support=greatest(0,least(100,c.support+case
   when t.wellbeing>=c.support+8 then 1
   when t.wellbeing<=c.support-8 then -1 else 0 end)),
  trust=greatest(0,least(100,c.trust+case
   when t.wellbeing<30 then -1 when t.wellbeing>70 then 1 else 0 end))
 from targets t where c.government_id=p_government_id and c.code=t.cohort_code;
 select round(sum(population_weight*support)::numeric/sum(population_weight))::smallint,
  round(sum(population_weight*trust)::numeric/sum(population_weight))::smallint
 into v_approval,v_trust from public.population_cohorts where government_id=p_government_id;
 update public.governments set approval=v_approval,trust=v_trust,updated_at=now()
  where id=p_government_id;
 select jsonb_build_object('households',count(*),'residents',sum(residents),
  'economicSecurity',round(sum(residents*economic_security)/sum(residents),2),
  'serviceAccess',round(sum(residents*service_access)/sum(residents),2),
  'wellbeing',round(sum(residents*wellbeing)/sum(residents),2),
  'approvalBefore',v_g.approval,'approvalAfter',v_approval,
  'trustBefore',v_g.trust,'trustAfter',v_trust,
  'cohortsAfter',(select jsonb_agg(jsonb_build_object('code',code,
    'support',support,'trust',trust) order by code) from public.population_cohorts
    where government_id=p_government_id)) into v_summary
 from public.synthetic_households where government_id=p_government_id;
 with split as (
  select h.*,s.dimension,s.code from public.synthetic_households h
   cross join lateral(values('income',h.income_band),('district',h.district_code)) s(dimension,code)
   where government_id=p_government_id
 ), aggregates as (
  select dimension,code,count(*) as households,sum(residents) as residents,
   round(sum(residents*economic_security)/sum(residents),2) as economic,
   round(sum(residents*service_access)/sum(residents),2) as services,
   round(sum(residents*wellbeing)/sum(residents),2) as wellbeing,
   round(sum(residents*support)::numeric/sum(residents),2) as support
  from split group by dimension,code
 ) select jsonb_agg(jsonb_build_object('dimension',dimension,'code',code,
   'households',households,'residents',residents,'economicSecurity',economic,
   'serviceAccess',services,'wellbeing',wellbeing,'support',support)
   order by dimension,code) into v_segments from aggregates;
 insert into public.daily_social_acts(government_id,act_day,engine_version,inputs,summary,segments)
 values(p_government_id,v_day,'living-conditions-v1',v_inputs,v_summary,v_segments);
 return true;
end $$;

-- Settle social consequences before Parliament/elections/polls sample state.
-- Deliberately capture only today's actual inputs; missing days remain gaps.
create function game_internal.process_daily_social_conditions()
returns jsonb language plpgsql set search_path='' as $$
declare
 v_day date:=(now() at time zone 'UTC')::date;
 v_g record;v_count integer:=0;v_errors integer:=0;
begin
 for v_g in select g.id from public.governments g
  where not exists(select 1 from public.daily_social_acts a
   where a.government_id=g.id and a.act_day=v_day)
   and not exists(select 1 from public.matches m
    where m.government_id=g.id and m.status<>'active')
   and exists(select 1 from public.synthetic_households h where h.government_id=g.id)
   and not exists(select 1 from game_internal.daily_social_failures f
    where f.government_id=g.id and f.act_day=v_day
     and f.attempted_at>now()-interval '15 minutes')
  order by g.created_at,g.id limit 200
 loop
  begin
   if game_internal.settle_daily_social_conditions(v_g.id) then v_count:=v_count+1; end if;
   delete from game_internal.daily_social_failures where government_id=v_g.id;
  exception when others then
   v_errors:=v_errors+1;
   insert into game_internal.daily_social_failures(government_id,act_day,last_error)
    values(v_g.id,v_day,left(sqlerrm,1000))
    on conflict(government_id) do update set act_day=excluded.act_day,
     last_error=excluded.last_error,attempted_at=now(),
     attempts=game_internal.daily_social_failures.attempts+1;
  end;
 end loop;
 return jsonb_build_object('dailySocialActs',v_count,'dailySocialErrors',v_errors);
end $$;

alter function game_internal.process_calendar() rename to process_calendar_before_daily_social;
create function game_internal.process_calendar()
returns jsonb language plpgsql set search_path='' as $$
declare v_social jsonb;
begin
 v_social:=game_internal.process_daily_social_conditions();
 return game_internal.process_calendar_before_daily_social()||v_social;
end $$;

-- Drain bounded batches independently of the slower parliamentary calendar.
-- 200 governments/minute is a throughput budget, not a load-test claim.
do $schedule$
begin
 if exists(select 1 from pg_extension where extname='pg_cron') then
  perform cron.schedule('aos-daily-social-v1','* * * * *',
   'select game_internal.process_daily_social_conditions()');
 end if;
end $schedule$;

create function public.get_living_conditions(p_government_id uuid,p_days integer default 30)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_user uuid:=auth.uid();v_day date:=(now() at time zone 'UTC')::date;
 v_from date;v_started date;v_history jsonb;v_latest jsonb;v_count integer;
begin
 if v_user is null or not exists(select 1 from public.governments g
  where g.id=p_government_id and (g.owner_id=v_user or exists(
   select 1 from public.matches m join public.match_players p on p.match_id=m.id
    where m.government_id=g.id and p.user_id=v_user))) then
  raise exception 'GOVERNMENT_NOT_FOUND_OR_FORBIDDEN' using errcode='42501'; end if;
 if p_days is null or p_days not in (7,30,90) then
  raise exception 'LIVING_CONDITIONS_INVALID_WINDOW' using errcode='P0001'; end if;
 select min(act_day) into v_started from public.daily_social_acts where government_id=p_government_id;
 v_from:=greatest(v_day-(p_days-1),coalesce(v_started,v_day));
 select coalesce(jsonb_agg(jsonb_build_object('day',a.act_day,
  'capturedAt',a.captured_at,'modelVersion',a.engine_version,
  'summary',a.summary) order by a.act_day),'[]'::jsonb),count(*)
 into v_history,v_count from public.daily_social_acts a
  where government_id=p_government_id and act_day between v_from and v_day;
 select jsonb_build_object('day',a.act_day,'capturedAt',a.captured_at,
  'modelVersion',a.engine_version,'summary',a.summary,'segments',a.segments,
  'inputs',a.inputs) into v_latest from public.daily_social_acts a
  where government_id=p_government_id order by act_day desc limit 1;
 return jsonb_build_object('governmentId',p_government_id,'serverDay',v_day,
  'fromDay',v_from,'days',p_days,'recordedDays',v_count,
  'expectedDays',case when v_started is null then 0 else v_day-v_from+1 end,
  'latest',v_latest,'history',v_history);
end $$;

revoke all on function game_internal.guard_daily_social_act(),
 game_internal.living_conditions(text,text,text,numeric,integer,integer,integer,integer,integer,integer,integer),
 game_internal.settle_daily_social_conditions(uuid),game_internal.process_calendar(),
 game_internal.process_daily_social_conditions(),
 game_internal.process_calendar_before_daily_social() from public,anon,authenticated;
revoke all on function public.get_living_conditions(uuid,integer) from public,anon,authenticated;
grant execute on function public.get_living_conditions(uuid,integer) to authenticated;
