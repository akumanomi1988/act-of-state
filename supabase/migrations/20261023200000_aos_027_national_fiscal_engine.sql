-- AOS-027 — server-authoritative national fiscal simulation, version national-fiscal-v1.
-- One real UTC day = one game day; fiscal acts are settled after Friday ends.
-- This is a synthetic rules model, not an econometric forecast of a real state.

alter table public.governments
  add column debt_m_eur integer not null default 0 check (debt_m_eur>=0),
  add column gdp_index numeric(7,2) not null default 100 check (gdp_index between 40 and 200),
  add column unemployment_bp integer not null default 700 check (unemployment_bp between 0 and 3000),
  add column inflation_bp integer not null default 250 check (inflation_bp between 0 and 3000);

create table public.fiscal_policies (
  government_id uuid primary key references public.governments(id) on delete cascade,
  health smallint not null default 35 check(health between 10 and 60),
  education smallint not null default 25 check(education between 10 and 60),
  infrastructure smallint not null default 25 check(infrastructure between 10 and 60),
  security smallint not null default 15 check(security between 10 and 60),
  tax_rate smallint not null default 25 check(tax_rate between 10 and 45),
  revision_week date,
  revised_this_week boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fiscal_policy_total_100 check(health+education+infrastructure+security=100)
);
alter table public.fiscal_policies enable row level security;
revoke all on public.fiscal_policies from public,anon,authenticated;

create table public.fiscal_policy_versions (
  government_id uuid not null references public.governments(id) on delete cascade,
  effective_week date not null,
  health smallint not null,
  education smallint not null,
  infrastructure smallint not null,
  security smallint not null,
  tax_rate smallint not null,
  approved_at timestamptz not null default now(),
  primary key(government_id,effective_week),
  check(extract(isodow from effective_week)=1),
  check(health+education+infrastructure+security=100)
);
alter table public.fiscal_policy_versions enable row level security;
revoke all on public.fiscal_policy_versions from public,anon,authenticated;

create table public.fiscal_weekly_acts (
  government_id uuid not null references public.governments(id) on delete cascade,
  week_start date not null,
  settled_at timestamptz not null default now(),
  engine_version text not null default 'national-fiscal-v1',
  policy_snapshot jsonb not null,
  revenue_m_eur integer not null,
  spending_m_eur integer not null,
  balance_m_eur integer not null,
  debt_issued_m_eur integer not null check(debt_issued_m_eur>=0),
  debt_repaid_m_eur integer not null check(debt_repaid_m_eur>=0),
  treasury_after_m_eur integer not null check(treasury_after_m_eur>=0),
  debt_after_m_eur integer not null check(debt_after_m_eur>=0),
  gdp_index_after numeric(7,2) not null,
  unemployment_bp_after integer not null,
  inflation_bp_after integer not null,
  primary key(government_id,week_start),
  check(extract(isodow from week_start)=1)
);
create index fiscal_acts_recent_idx on public.fiscal_weekly_acts(government_id,week_start desc);
alter table public.fiscal_weekly_acts enable row level security;
revoke all on public.fiscal_weekly_acts from public,anon,authenticated;

create table game_internal.fiscal_failures (
  government_id uuid not null,
  week_start date not null,
  attempts integer not null default 1,
  last_error text not null,
  last_attempt_at timestamptz not null default now(),
  primary key(government_id,week_start)
);
revoke all on game_internal.fiscal_failures from public,anon,authenticated;

create function game_internal.week_start(p_day date)
returns date language sql immutable set search_path='' as $$
  select p_day-(extract(isodow from p_day)::integer-1)
$$;
revoke all on function game_internal.week_start(date) from public,anon,authenticated;

create function game_internal.seed_fiscal_policy()
returns trigger language plpgsql set search_path='' as $$
declare v_week date;
begin
  v_week:=game_internal.week_start((new.created_at at time zone 'UTC')::date);
  insert into public.fiscal_policies(government_id,revision_week)
    values(new.id,v_week) on conflict(government_id) do nothing;
  insert into public.fiscal_policy_versions(
    government_id,effective_week,health,education,infrastructure,security,tax_rate
  ) values(new.id,v_week,35,25,25,15,25)
    on conflict(government_id,effective_week) do nothing;
  return new;
end $$;
revoke all on function game_internal.seed_fiscal_policy() from public,anon,authenticated;
create trigger government_fiscal_seed after insert on public.governments
  for each row execute function game_internal.seed_fiscal_policy();

-- Preserve existing countries, if any. The seed happens once, without resetting state.
insert into public.fiscal_policies(government_id,revision_week)
select g.id,game_internal.week_start((g.created_at at time zone 'UTC')::date)
from public.governments g on conflict(government_id) do nothing;
insert into public.fiscal_policy_versions(
  government_id,effective_week,health,education,infrastructure,security,tax_rate
)
select p.government_id,p.revision_week,p.health,p.education,p.infrastructure,
  p.security,p.tax_rate from public.fiscal_policies p
on conflict(government_id,effective_week) do nothing;

create function public.set_fiscal_policy(
  p_government_id uuid,p_health integer,p_education integer,
  p_infrastructure integer,p_security integer,p_tax_rate integer
)
returns public.fiscal_policies language plpgsql security definer set search_path='' as $$
declare
  v_user uuid:=auth.uid(); v_g public.governments%rowtype;
  v_match public.matches%rowtype; v_policy public.fiscal_policies%rowtype;
  v_week date:=game_internal.week_start((now() at time zone 'UTC')::date);
begin
  if v_user is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  -- Lock order consistent with parliamentary and executive operations.
  select * into v_match from public.matches
    where government_id=p_government_id and status='active' for update;
  select * into v_g from public.governments where id=p_government_id for update;
  if not found then raise exception 'GOVERNMENT_NOT_FOUND_OR_FORBIDDEN' using errcode='42501'; end if;
  if (v_match.id is not null and v_match.host_user_id<>v_user) or
     (v_match.id is null and v_g.owner_id<>v_user) then
    raise exception 'FISCAL_NOT_GOVERNMENT' using errcode='42501'; end if;
  if p_health is null or p_education is null or p_infrastructure is null or
    p_security is null or p_tax_rate is null or
    p_health not between 10 and 60 or p_education not between 10 and 60 or
    p_infrastructure not between 10 and 60 or p_security not between 10 and 60 or
    p_tax_rate not between 10 and 45 or
    p_health+p_education+p_infrastructure+p_security<>100 then
    raise exception 'FISCAL_INVALID_ALLOCATION' using errcode='P0001'; end if;
  select * into v_policy from public.fiscal_policies
    where government_id=p_government_id for update;
  if not found then raise exception 'FISCAL_NOT_INITIALIZED' using errcode='P0001'; end if;
  if v_policy.health=p_health and v_policy.education=p_education and
    v_policy.infrastructure=p_infrastructure and v_policy.security=p_security and
    v_policy.tax_rate=p_tax_rate then return v_policy; end if;
  if v_policy.revision_week=v_week and v_policy.revised_this_week then
    raise exception 'FISCAL_WEEK_ALREADY_REVISED' using errcode='P0001'; end if;
  -- Every week's executive budget revision is bounded to mitigate instant swings.
  if abs(v_policy.health-p_health)>15 or abs(v_policy.education-p_education)>15 or
    abs(v_policy.infrastructure-p_infrastructure)>15 or
    abs(v_policy.security-p_security)>15 or abs(v_policy.tax_rate-p_tax_rate)>5 then
    raise exception 'FISCAL_CHANGE_TOO_LARGE' using errcode='P0001'; end if;
  update public.fiscal_policies set health=p_health,education=p_education,
    infrastructure=p_infrastructure,security=p_security,tax_rate=p_tax_rate,
    revision_week=v_week,revised_this_week=true,updated_at=now()
    where government_id=p_government_id returning * into v_policy;
  insert into public.fiscal_policy_versions(
    government_id,effective_week,health,education,infrastructure,security,tax_rate,approved_at)
  values(p_government_id,v_week,p_health,p_education,p_infrastructure,p_security,
    p_tax_rate,now())
  on conflict(government_id,effective_week) do update
    set health=excluded.health,education=excluded.education,
    infrastructure=excluded.infrastructure,security=excluded.security,
    tax_rate=excluded.tax_rate,approved_at=excluded.approved_at;
  return v_policy;
end $$;

create function public.get_fiscal_state(p_government_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
 v_user uuid:=auth.uid(); v_g public.governments%rowtype;
 v_p public.fiscal_policies%rowtype; v_match public.matches%rowtype;
 v_week date:=game_internal.week_start((now() at time zone 'UTC')::date);
begin
  if v_user is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  select * into v_g from public.governments where id=p_government_id;
  if not found then raise exception 'GOVERNMENT_NOT_FOUND_OR_FORBIDDEN' using errcode='42501'; end if;
  select * into v_match from public.matches
     where government_id=p_government_id and status='active';
  if v_g.owner_id<>v_user and not exists(
      select 1 from public.match_players p where p.match_id=v_match.id and p.user_id=v_user) then
    raise exception 'FISCAL_FORBIDDEN' using errcode='42501'; end if;
  select * into v_p from public.fiscal_policies where government_id=p_government_id;
  if not found then raise exception 'FISCAL_NOT_INITIALIZED' using errcode='P0001'; end if;
  return jsonb_build_object(
    'governmentId',p_government_id,'serverDay',(now() at time zone 'UTC')::date,
    'currentWeek',v_week,'canRevise',not (v_p.revision_week=v_week and v_p.revised_this_week),
    'canEdit',case when v_match.id is not null then v_match.host_user_id=v_user else v_g.owner_id=v_user end,
    'policy',to_jsonb(v_p),
    'projectedRevenueM',v_p.tax_rate*95,
    'projectedSpendingM',v_p.health*24+v_p.education*20+
      v_p.infrastructure*30+v_p.security*22,
    'indicators',jsonb_build_object(
      'treasuryM',v_g.treasury_m_eur,'debtM',v_g.debt_m_eur,
      'gdpIndex',v_g.gdp_index,'unemploymentBp',v_g.unemployment_bp,
      'inflationBp',v_g.inflation_bp,
      'approval',v_g.approval,'trust',v_g.trust),
    'history',coalesce((select jsonb_agg(to_jsonb(a) order by a.week_start desc)
       from (select * from public.fiscal_weekly_acts
         where government_id=p_government_id
         order by week_start desc limit 12) a),'[]'::jsonb)
  );
end $$;

create function game_internal.settle_fiscal_week(p_government_id uuid,p_week date)
returns boolean language plpgsql set search_path='' as $$
declare
  v_g public.governments%rowtype; v_policy public.fiscal_policy_versions%rowtype;
  v_revenue integer; v_spending integer; v_balance integer;
  v_repay integer; v_new_debt integer; v_new_treasury integer; v_issue integer;
  v_gdp numeric(7,2); v_unemployment integer; v_inflation integer;
  v_support smallint; v_trust smallint;
begin
  if p_week is null or extract(isodow from p_week)<>1 or
     p_week+5>(now() at time zone 'UTC')::date then
    raise exception 'FISCAL_WEEK_NOT_CLOSED' using errcode='P0001'; end if;
  select * into v_g from public.governments where id=p_government_id for update;
  if not found then raise exception 'GOVERNMENT_NOT_FOUND_OR_FORBIDDEN' using errcode='42501'; end if;
  if (v_g.created_at at time zone 'UTC')::date>p_week+4 then
    raise exception 'FISCAL_GOVERNMENT_NOT_YET_CREATED' using errcode='P0001'; end if;
  if exists(select 1 from public.fiscal_weekly_acts
      where government_id=p_government_id and week_start=p_week) then
    return false; end if;
  select * into v_policy from public.fiscal_policy_versions
    where government_id=p_government_id and effective_week<=p_week
    order by effective_week desc limit 1;
  if not found then raise exception 'FISCAL_POLICY_HISTORY_MISSING' using errcode='P0001'; end if;
  v_revenue:=v_policy.tax_rate*95;
  v_spending:=v_policy.health*24+v_policy.education*20+
    v_policy.infrastructure*30+v_policy.security*22;
  v_balance:=v_revenue-v_spending;
  v_repay:=least(v_g.debt_m_eur,greatest(0,v_balance));
  v_issue:=greatest(0,-(v_g.treasury_m_eur+v_balance-v_repay));
  v_new_treasury:=greatest(0,v_g.treasury_m_eur+v_balance-v_repay);
  v_new_debt:=v_g.debt_m_eur+v_issue-v_repay;
  v_gdp:=greatest(40,least(200,v_g.gdp_index+
      (v_policy.infrastructure-25)*0.08+(v_policy.education-25)*0.03-
      (v_policy.tax_rate-25)*0.04));
  v_unemployment:=greatest(0,least(3000,v_g.unemployment_bp+
      (25-v_policy.infrastructure)*3+(v_policy.tax_rate-25)*2));
  v_inflation:=greatest(0,least(3000,v_g.inflation_bp+
      round((v_spending-v_revenue)/50.0)::integer+(v_policy.tax_rate-25)*2));
  -- Distinct support vectors for households/services and productive sectors.
  update public.population_cohorts c set
    support=greatest(0,least(100,c.support+greatest(-3,least(3,
       case when c.ideal_policy<50 then
         round((v_policy.health+v_policy.education-60)/15.0-
             (v_policy.tax_rate-25)/15.0)::integer
       else
         round((v_policy.infrastructure+v_policy.security-40)/15.0-
             (v_policy.tax_rate-25)/15.0)::integer end)))),
    trust=greatest(0,least(100,c.trust+
       case when v_issue>0 then -1 when v_balance>=0 then 1 else 0 end))
    where c.government_id=p_government_id;
  select round(sum(population_weight*support)::numeric/nullif(sum(population_weight),0))::smallint,
    round(sum(population_weight*trust)::numeric/nullif(sum(population_weight),0))::smallint
    into v_support,v_trust from public.population_cohorts
      where government_id=p_government_id;
  update public.governments set treasury_m_eur=v_new_treasury,
    debt_m_eur=v_new_debt,gdp_index=v_gdp,
    unemployment_bp=v_unemployment,inflation_bp=v_inflation,
    approval=coalesce(v_support,approval),trust=coalesce(v_trust,trust),
    updated_at=now()
    where id=p_government_id;
  insert into public.fiscal_weekly_acts(
    government_id,week_start,policy_snapshot,revenue_m_eur,spending_m_eur,
    balance_m_eur,debt_issued_m_eur,debt_repaid_m_eur,treasury_after_m_eur,
    debt_after_m_eur,gdp_index_after,unemployment_bp_after,inflation_bp_after
  ) values(
    p_government_id,p_week,to_jsonb(v_policy)-'government_id'-'approved_at',
    v_revenue,v_spending,v_balance,v_issue,v_repay,v_new_treasury,
    v_new_debt,v_gdp,v_unemployment,v_inflation);
  return true;
end $$;

-- Preserve the former calendar's battle-tested Parliament, election,
-- confidence and Friday closure work in the existing Cron entrypoint.
alter function game_internal.process_calendar() rename to process_calendar_pre_fiscal;
create function game_internal.process_calendar()
returns jsonb language plpgsql set search_path='' as $$
declare
  v_base jsonb; v_policy record; v_week date; v_last date;
  v_count integer:=0; v_errors integer:=0; v_limit integer:=150;
  v_start date;
begin
  v_base:=game_internal.process_calendar_pre_fiscal();
  v_last:=game_internal.week_start((now() at time zone 'UTC')::date);
  if extract(isodow from (now() at time zone 'UTC')::date)<6 then
    v_last:=v_last-7; end if;
  for v_policy in select p.government_id,p.created_at
    from public.fiscal_policies p
    where (p.created_at at time zone 'UTC')::date<=v_last+4
    order by p.created_at,p.government_id limit 300
  loop
    v_start:=game_internal.week_start((v_policy.created_at at time zone 'UTC')::date);
    v_week:=v_start;
    while v_week<=v_last and v_count<v_limit loop
      if not exists(select 1 from public.fiscal_weekly_acts a
        where a.government_id=v_policy.government_id and a.week_start=v_week) and
        not exists(select 1 from game_internal.fiscal_failures f
          where f.government_id=v_policy.government_id and f.week_start=v_week
            and f.last_attempt_at>now()-interval '1 hour') then
        begin
          if game_internal.settle_fiscal_week(v_policy.government_id,v_week) then
            v_count:=v_count+1; end if;
          delete from game_internal.fiscal_failures
            where government_id=v_policy.government_id and week_start=v_week;
        exception when others then
          v_errors:=v_errors+1;
          insert into game_internal.fiscal_failures(government_id,week_start,last_error)
          values(v_policy.government_id,v_week,sqlerrm)
          on conflict(government_id,week_start) do update
            set attempts=game_internal.fiscal_failures.attempts+1,
                last_error=excluded.last_error,last_attempt_at=now();
          exit;
        end;
      end if;
      v_week:=v_week+7;
    end loop;
    exit when v_count>=v_limit;
  end loop;
  return v_base||jsonb_build_object(
    'fiscalClosures',v_count,'fiscalErrors',v_errors);
end $$;

revoke all on function public.set_fiscal_policy(uuid,integer,integer,integer,integer,integer),
  public.get_fiscal_state(uuid) from public,anon,authenticated;
grant execute on function public.set_fiscal_policy(uuid,integer,integer,integer,integer,integer),
  public.get_fiscal_state(uuid) to authenticated;
revoke all on function game_internal.settle_fiscal_week(uuid,date),
  game_internal.process_calendar_pre_fiscal(),game_internal.process_calendar()
  from public,anon,authenticated;
