-- AOS-053: transparent, equal-rule fictional party campaign financing.
-- Public funding is deterministic per elapsed UTC week; only server campaign
-- executions can spend credits. No purchases, donations or real money.
create table public.match_campaign_spending (
 id uuid primary key default gen_random_uuid(),
 match_id uuid not null,
 user_id uuid not null,
 campaign_event_id uuid not null unique references public.match_campaign_events(id) on delete cascade,
 week_start date not null check(extract(isodow from week_start)=1),
 strategy text not null check(strategy in ('dialogue','field_visit','policy_forum')),
 cost_credits smallint not null check (
  (strategy='dialogue' and cost_credits=4) or
  (strategy='field_visit' and cost_credits=7) or
  (strategy='policy_forum' and cost_credits=10)),
 created_at timestamptz not null default now(),
 unique(match_id,user_id,week_start),
 foreign key(match_id,user_id) references public.match_players(match_id,user_id) on delete cascade
);
create index match_campaign_spending_party_history
  on public.match_campaign_spending(match_id,user_id,week_start desc);
alter table public.match_campaign_spending enable row level security;
revoke all on public.match_campaign_spending from public,anon,authenticated;

create function game_internal.party_campaign_entitlement(
 p_started_at timestamptz,p_as_of date
) returns integer language sql immutable strict set search_path='' as $$
  -- Match start week gets 12 credits. Another 4 credits accrue on each
  -- following Monday (UTC), without scheduler or mutable client clocks.
  select 12+4*greatest(0, (
    (p_as_of-(extract(isodow from p_as_of)::integer-1))-
    ((p_started_at at time zone 'UTC')::date-
       (extract(isodow from (p_started_at at time zone 'UTC')::date)::integer-1))
  )/7);
$$;
revoke all on function game_internal.party_campaign_entitlement(timestamptz,date)
 from public,anon,authenticated;

create function public.get_party_finances(p_match_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
 v_user uuid:=auth.uid();
 v_match public.matches%rowtype;
 v_day date:=(now() at time zone 'UTC')::date;
 v_week date:=v_day-(extract(isodow from v_day)::integer-1);
 v_earned integer;
 v_spent integer;
begin
 if v_user is null or not exists (
   select 1 from public.match_players p where p.match_id=p_match_id and p.user_id=v_user
 ) then raise exception 'MATCH_FORBIDDEN' using errcode='42501'; end if;
 select * into v_match from public.matches where id=p_match_id;
 if not found then raise exception 'MATCH_FORBIDDEN' using errcode='42501'; end if;
 v_earned:=case when v_match.started_at is null then 0
   else game_internal.party_campaign_entitlement(v_match.started_at,v_day) end;
 select coalesce(sum(s.cost_credits),0)::integer into v_spent
  from public.match_campaign_spending s
  where s.match_id=p_match_id and s.user_id=v_user;
 return jsonb_build_object(
  'matchId',p_match_id,'serverDay',v_day::text,'weekStart',v_week::text,
  'financeModel','equal-public-weekly-v1',
  'active',v_match.status='active',
  'earnedCredits',v_earned,'spentCredits',v_spent,
  'availableCredits',greatest(0,v_earned-v_spent),
  'costs',jsonb_build_object('dialogue',4,'field_visit',7,'policy_forum',10),
  'recentSpending',coalesce((
    select jsonb_agg(jsonb_build_object(
      'id',r.id,'weekStart',r.week_start::text,'strategy',r.strategy,
      'costCredits',r.cost_credits,'cohortCode',e.cohort_code,
      'campaignEventId',r.campaign_event_id) order by r.week_start desc,r.id desc)
    from (select * from public.match_campaign_spending s
       where s.match_id=p_match_id and s.user_id=v_user
       order by s.week_start desc,s.id desc limit 20) r
    join public.match_campaign_events e on e.id=r.campaign_event_id
   ),'[]'::jsonb));
end $$;
revoke all on function public.get_party_finances(uuid) from public,anon;
grant execute on function public.get_party_finances(uuid) to authenticated;


create or replace function public.launch_campaign(
  p_match_id uuid,p_cohort text,p_strategy text
) returns public.match_campaign_events
language plpgsql security definer set search_path='' as $$
declare
  v_user uuid:=auth.uid(); v_match public.matches%rowtype;
  v_player public.match_players%rowtype;
  v_cohort public.population_cohorts%rowtype;
  v_event public.match_campaign_events%rowtype;
  v_day date:=(now() at time zone 'UTC')::date;
  v_week date:=v_day-(extract(isodow from v_day)::integer-1);
  v_due date; v_base integer; v_previous integer;
  v_gain integer; v_after integer;
  v_cost integer; v_earned integer; v_spent integer;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  -- The match row serializes the entire campaign and election certification.
  select * into v_match from public.matches where id=p_match_id for update;
  if not found then raise exception 'MATCH_FORBIDDEN' using errcode='42501'; end if;
  select * into v_player from public.match_players
    where match_id=p_match_id and user_id=v_user;
  if not found then raise exception 'MATCH_FORBIDDEN' using errcode='42501'; end if;
  select * into v_event from public.match_campaign_events
    where match_id=p_match_id and user_id=v_user and week_start=v_week;
  if found then
    if v_event.cohort_code=p_cohort and v_event.strategy=p_strategy then return v_event; end if;
    raise exception 'CAMPAIGN_WEEK_ALREADY_USED' using errcode='P0001';
  end if;
  if v_match.status<>'active' then
    raise exception 'CAMPAIGN_NOT_ACTIVE' using errcode='P0001'; end if;
  v_due:=public._next_election_date(p_match_id);
  if v_due is null or v_day>v_due-7 then
    raise exception 'CAMPAIGN_CLOSED' using errcode='P0001'; end if;
  if p_cohort is null or length(p_cohort)>80 then
    raise exception 'CAMPAIGN_INVALID_COHORT' using errcode='P0001'; end if;
  select * into v_cohort from public.population_cohorts
    where government_id=v_match.government_id and code=p_cohort;
  if not found then raise exception 'CAMPAIGN_INVALID_COHORT' using errcode='P0001'; end if;
  v_base:=case p_strategy when 'dialogue' then 3 when 'field_visit' then 4
    when 'policy_forum' then 5 else null end;
  if v_base is null then raise exception 'CAMPAIGN_INVALID_STRATEGY' using errcode='P0001'; end if;
  -- Strong ideological mismatches yield lower persuasion. Cumulative cap prevents
  -- repetitive lobbying from overwhelming the deterministic voting model.
  v_gain:=greatest(1,v_base-(abs(v_player.manifesto_policy-v_cohort.ideal_policy)/25));
  select game_internal.campaign_effective_influence(i.influence,i.updated_at,v_day)
    into v_previous from public.match_campaign_influence i
    where i.match_id=p_match_id and i.user_id=v_user
      and i.cohort_code=p_cohort;
  v_previous:=coalesce(v_previous,0);
  v_after:=least(20,v_previous+v_gain);
  -- Match FOR UPDATE serializes exact retries and spend authorization.
  v_cost:=case p_strategy when 'dialogue' then 4
    when 'field_visit' then 7 when 'policy_forum' then 10 end;
  v_earned:=game_internal.party_campaign_entitlement(v_match.started_at,v_day);
  select coalesce(sum(s.cost_credits),0)::integer into v_spent
    from public.match_campaign_spending s
    where s.match_id=p_match_id and s.user_id=v_user;
  if v_earned-v_spent<v_cost then
    raise exception 'CAMPAIGN_INSUFFICIENT_CREDITS' using errcode='P0001';
  end if;
  insert into public.match_campaign_influence(match_id,user_id,cohort_code,influence)
    values(p_match_id,v_user,p_cohort,v_after)
    on conflict(match_id,user_id,cohort_code) do update
      set influence=excluded.influence,updated_at=now();
  insert into public.match_campaign_events(match_id,user_id,week_start,cohort_code,
    strategy,policy_snapshot,cohort_ideal_snapshot,influence_delta,influence_after)
  values(p_match_id,v_user,v_week,p_cohort,p_strategy,v_player.manifesto_policy,
    v_cohort.ideal_policy,v_after-v_previous,v_after)
  returning * into v_event;
  insert into public.match_campaign_spending(
    match_id,user_id,campaign_event_id,week_start,strategy,cost_credits)
    values(p_match_id,v_user,v_event.id,v_week,p_strategy,v_cost);
  return v_event;
end $$;

