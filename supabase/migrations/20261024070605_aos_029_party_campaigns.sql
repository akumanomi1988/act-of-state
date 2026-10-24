-- AOS-029: meaningful weekly political campaigning.
-- All values and dates are server-authoritative; no direct Data API table grants.
create table public.match_campaign_influence (
  match_id uuid not null,
  user_id uuid not null,
  cohort_code text not null,
  influence smallint not null check(influence between 0 and 20),
  updated_at timestamptz not null default now(),
  primary key (match_id,user_id,cohort_code),
  foreign key(match_id,user_id) references public.match_players(match_id,user_id) on delete cascade
);
create table public.match_campaign_events (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null,
  user_id uuid not null,
  week_start date not null check(extract(isodow from week_start)=1),
  cohort_code text not null,
  strategy text not null check(strategy in ('dialogue','field_visit','policy_forum')),
  policy_snapshot smallint not null check(policy_snapshot between 0 and 100),
  cohort_ideal_snapshot smallint not null check(cohort_ideal_snapshot between 0 and 100),
  influence_delta smallint not null check(influence_delta between 0 and 5),
  influence_after smallint not null check(influence_after between 0 and 20),
  model_version text not null default 'campaign-outreach-v1'
    check(model_version='campaign-outreach-v1'),
  created_at timestamptz not null default now(),
  unique (match_id,user_id,week_start),
  foreign key(match_id,user_id) references public.match_players(match_id,user_id) on delete cascade
);
create index match_campaign_events_history_idx
  on public.match_campaign_events(match_id,created_at desc,id);
alter table public.match_campaign_influence enable row level security;
alter table public.match_campaign_events enable row level security;
revoke all on public.match_campaign_influence,public.match_campaign_events
  from public,anon,authenticated;

create function public.get_campaign_state(p_match_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
  v_user uuid:=auth.uid(); v_match public.matches%rowtype;
  v_day date:=(now() at time zone 'UTC')::date;
  v_week date:=v_day-(extract(isodow from v_day)::integer-1);
  v_due date; v_used boolean;
begin
  if v_user is null or not exists(select 1 from public.match_players p
      where p.match_id=p_match_id and p.user_id=v_user) then
    raise exception 'MATCH_FORBIDDEN' using errcode='42501'; end if;
  select * into v_match from public.matches where id=p_match_id;
  if not found then raise exception 'MATCH_FORBIDDEN' using errcode='42501'; end if;
  v_due:=public._next_election_date(p_match_id);
  select exists(select 1 from public.match_campaign_events e
      where e.match_id=p_match_id and e.user_id=v_user and e.week_start=v_week)
    into v_used;
  return jsonb_build_object(
    'serverDay',v_day::text,'weekStart',v_week::text,
    'campaignClosesOn',case when v_due is null then null else (v_due-7)::text end,
    'available',v_match.status='active' and not v_used
      and v_due is not null and v_day<=v_due-7,
    'usedThisWeek',v_used,
    'cohorts',coalesce((select jsonb_agg(jsonb_build_object(
      'code',c.code,'label',c.label,'weight',c.population_weight,
      'idealPolicy',c.ideal_policy,
      'myInfluence',coalesce(i.influence,0)) order by c.code)
      from public.population_cohorts c
      left join public.match_campaign_influence i
        on i.match_id=p_match_id and i.user_id=v_user and i.cohort_code=c.code
      where c.government_id=v_match.government_id),'[]'::jsonb),
    'recentActs',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc,x.id desc)
      from (select e.id,e.user_id,e.week_start,e.cohort_code,e.strategy,
            e.influence_delta,e.influence_after,e.model_version,e.created_at,
            p.party_name
            from public.match_campaign_events e
            join public.match_players p on p.match_id=e.match_id and p.user_id=e.user_id
            where e.match_id=p_match_id
            order by e.created_at desc,e.id desc limit 30) x),'[]'::jsonb)
  );
end $$;

create function public.launch_campaign(
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
  select i.influence into v_previous from public.match_campaign_influence i
    where i.match_id=p_match_id and i.user_id=v_user
      and i.cohort_code=p_cohort;
  v_previous:=coalesce(v_previous,0);
  v_after:=least(20,v_previous+v_gain);
  insert into public.match_campaign_influence(match_id,user_id,cohort_code,influence)
    values(p_match_id,v_user,p_cohort,v_after)
    on conflict(match_id,user_id,cohort_code) do update
      set influence=excluded.influence,updated_at=now();
  insert into public.match_campaign_events(match_id,user_id,week_start,cohort_code,
    strategy,policy_snapshot,cohort_ideal_snapshot,influence_delta,influence_after)
  values(p_match_id,v_user,v_week,p_cohort,p_strategy,v_player.manifesto_policy,
    v_cohort.ideal_policy,v_after-v_previous,v_after)
  returning * into v_event;
  return v_event;
end $$;

revoke all on function public.get_campaign_state(uuid) from public,anon;
revoke all on function public.launch_campaign(uuid,text,text) from public,anon;
grant execute on function public.get_campaign_state(uuid) to authenticated;
grant execute on function public.launch_campaign(uuid,text,text) to authenticated;

-- Election scoring v2 makes campaign influence an actual, bounded vote driver;
-- version and accumulated influence are included in immutable election snapshots.
create or replace function public._calculate_election_projection(p_match_id uuid)
returns jsonb language plpgsql stable security definer set search_path to '' as $$
declare
  v_match public.matches%rowtype;
  v_parties jsonb;
  v_cohorts jsonb;
begin
  select * into v_match from public.matches where id=p_match_id;
  if not found then raise exception 'MATCH_FORBIDDEN' using errcode='42501'; end if;
  if not exists(select 1 from public.population_cohorts
      where government_id=v_match.government_id) then
    raise exception 'POPULATION_NOT_INITIALIZED' using errcode='P0001'; end if;
  with
  cohort_scores as (
    select p.user_id,p.seat_no,p.party_name,p.manifesto_policy,
      c.code,c.population_weight,
      greatest(1,100-2*abs(c.ideal_policy-p.manifesto_policy)
        + case when p.user_id=v_match.host_user_id
          then round((c.support-50)*0.30+(c.trust-50)*0.20)::integer
          else 0 end + coalesce(ci.influence,0))::numeric as score
    from public.match_players p
    cross join public.population_cohorts c
    left join public.match_campaign_influence ci
      on ci.match_id=p.match_id and ci.user_id=p.user_id and ci.cohort_code=c.code
    where p.match_id=p_match_id and c.government_id=v_match.government_id
  ),
  apportioned as (
    select *,score/sum(score) over(partition by code) as cohort_share
    from cohort_scores
  ),
  popular as (
    select user_id,seat_no,party_name,manifesto_policy,
      sum(population_weight*cohort_share)/nullif(sum(population_weight),0) as vote_share
    from apportioned
    group by user_id,seat_no,party_name,manifesto_policy
  ),
  ranked_quotients as (
    select p.user_id,
      row_number() over(order by p.vote_share/d.divisor desc,p.seat_no asc) as rank
    from popular p cross join lateral generate_series(1,100) as d(divisor)
  ),
  seats as (
    select user_id,count(*)::integer as seats
    from ranked_quotients where rank<=100 group by user_id
  )
  select jsonb_agg(jsonb_build_object(
    'userId',p.user_id,'seatNo',p.seat_no,'partyName',p.party_name,
    'manifestoPolicy',p.manifesto_policy,
    'campaignInfluenceTotal',coalesce((select sum(i.influence) from public.match_campaign_influence i
      where i.match_id=p_match_id and i.user_id=p.user_id),0),
    'voteSharePct',round(p.vote_share*100,2),
    'seats',coalesce(s.seats,0)
  ) order by coalesce(s.seats,0) desc,p.vote_share desc,p.seat_no asc)
  into v_parties from popular p left join seats s on s.user_id=p.user_id;
  select jsonb_agg(jsonb_build_object(
    'code',c.code,'weight',c.population_weight,'idealPolicy',c.ideal_policy,
    'support',c.support,'trust',c.trust
  ) order by c.code) into v_cohorts
  from public.population_cohorts c where c.government_id=v_match.government_id;
  if v_parties is null then
    raise exception 'MATCH_REQUIRES_TWO_PLAYERS' using errcode='P0001'; end if;
  return jsonb_build_object(
    'modelVersion','electoral-cohorts-v2','parties',v_parties,'cohorts',v_cohorts);
end $$;

alter table public.match_elections
  alter column model_version set default 'electoral-cohorts-v2';
