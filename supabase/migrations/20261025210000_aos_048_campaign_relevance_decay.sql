-- AOS-048: campaign relevance decay, consistently versioned across published
-- campaigns, synthetic electorate, projections and immutable daily polls.
-- Old election records and campaign acts remain unchanged historical snapshots.
-- No direct browser table privileges, realtime clock overrides or destructive DML.

-- Persuasion loses 2 points for every 7 elapsed UTC days since the last
-- campaign action on the cohort. The authoritative base value never changes
-- just because a read is made: reads have no writes and no scheduler needed.
create function game_internal.campaign_effective_influence(
 p_stored smallint,p_updated_at timestamptz,p_as_of date
) returns integer language sql immutable strict set search_path='' as $$
 select greatest(0,least(20,p_stored::integer)-
   2*greatest(0,(p_as_of-(p_updated_at at time zone 'UTC')::date)/7));
$$;
revoke all on function game_internal.campaign_effective_influence(
 smallint,timestamptz,date) from public,anon,authenticated;

-- Preserve v1 event evidence while authoring new v2 campaign snapshots.
alter table public.match_campaign_events
 drop constraint match_campaign_events_model_version_check;
alter table public.match_campaign_events
 add constraint match_campaign_events_model_version_check
 check(model_version in ('campaign-outreach-v1','campaign-decay-v2'));
alter table public.match_campaign_events
 alter column model_version set default 'campaign-decay-v2';

-- The original immutable daily poll records keep their historical model label.
alter table public.match_opinion_polls
 drop constraint match_opinion_polls_model_version_check;
alter table public.match_opinion_polls
 add constraint match_opinion_polls_model_version_check check(
 model_version in ('electoral-cohorts-v1','electoral-cohorts-v2',
 'electoral-households-v1','electoral-districts-v1','electoral-districts-v2'));

create or replace function public.get_campaign_state(p_match_id uuid)
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
    'influenceModel','campaign-decay-v2',
    'cohorts',coalesce((select jsonb_agg(jsonb_build_object(
      'code',c.code,'label',c.label,'weight',c.population_weight,
      'idealPolicy',c.ideal_policy,
      'myInfluence',case when i.influence is null then 0 else
        game_internal.campaign_effective_influence(i.influence,i.updated_at,v_day) end,
      'nextDecayOn',case when i.influence is null or
        game_internal.campaign_effective_influence(i.influence,i.updated_at,v_day)=0 then null
        else ((i.updated_at at time zone 'UTC')::date+
          ((greatest(0,(v_day-(i.updated_at at time zone 'UTC')::date)/7)+1)*7))::text end) order by c.code)
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

create or replace function public._calculate_election_projection(p_match_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_match public.matches%rowtype;
 v_parties jsonb; v_cohorts jsonb; v_districts jsonb;
begin
 select * into v_match from public.matches where id=p_match_id;
 if not found then raise exception 'MATCH_FORBIDDEN' using errcode='42501'; end if;
 if not exists(select 1 from public.population_cohorts
     where government_id=v_match.government_id) then
   raise exception 'POPULATION_NOT_INITIALIZED' using errcode='P0001'; end if;
 if (select count(*) from public.synthetic_households
     where government_id=v_match.government_id)<>300 or
    (select count(distinct district_code) from public.synthetic_households
     where government_id=v_match.government_id)<>6 then
   raise exception 'DISTRICT_POPULATION_NOT_INITIALIZED' using errcode='P0001'; end if;
 if (select sum(seats) from public.electoral_districts)<>100 then
   raise exception 'DISTRICT_SEATS_INVALID' using errcode='P0001'; end if;
 with family_scores as (
   select p.user_id,p.seat_no,p.party_name,p.manifesto_policy,
     h.household_no,h.residents,h.district_code,
     greatest(1,100-2*abs(h.policy_preference-p.manifesto_policy)
       + case when p.user_id=v_match.host_user_id
         then round((h.support-50)*0.30+(h.trust-50)*0.20)::integer
         else 0 end + case when ci.influence is null then 0 else
         game_internal.campaign_effective_influence(ci.influence,ci.updated_at,
           (now() at time zone 'UTC')::date) end)::numeric as score
   from public.match_players p cross join public.synthetic_households h
   left join public.match_campaign_influence ci
     on ci.match_id=p.match_id and ci.user_id=p.user_id
     and ci.cohort_code=h.cohort_code
   where p.match_id=p_match_id and h.government_id=v_match.government_id
 ), apportioned as (
   select *,score/sum(score) over(partition by household_no) as family_share
   from family_scores
 ), national_popular as (
   select user_id,seat_no,party_name,manifesto_policy,
     sum(residents*family_share)/sum(residents) as vote_share
   from apportioned
   group by user_id,seat_no,party_name,manifesto_policy
 ), district_popular as (
   select user_id,seat_no,party_name,district_code,
     sum(residents*family_share)/sum(residents) as vote_share
   from apportioned
   group by user_id,seat_no,party_name,district_code
 ), quotients as (
   select dp.user_id,dp.district_code,
     row_number() over(partition by dp.district_code
       order by dp.vote_share/divisor.d desc, dp.seat_no asc) as rank
   from district_popular dp
   join public.electoral_districts d on d.code=dp.district_code
   cross join lateral generate_series(1,d.seats) divisor(d)
 ), district_seats as (
   select q.user_id,q.district_code,count(*)::integer as seats
   from quotients q join public.electoral_districts d on d.code=q.district_code
   where q.rank<=d.seats group by q.user_id,q.district_code
 ), totals as (
   select user_id,sum(seats)::integer as seats
   from district_seats group by user_id
 ), district_population as (
   select h.district_code,count(*)::integer as households,
     sum(h.residents)::integer as residents
   from public.synthetic_households h
   where h.government_id=v_match.government_id group by h.district_code
 ), district_display as (
   select d.code,d.label,d.seats,d.sort_order,
     pop.households,pop.residents,
     (select jsonb_agg(jsonb_build_object(
       'userId',dp.user_id,'partyName',dp.party_name,
       'voteSharePct',round(dp.vote_share*100,2),
       'seats',coalesce(ds.seats,0)
     ) order by coalesce(ds.seats,0) desc,dp.vote_share desc,dp.seat_no)
     from district_popular dp
     left join district_seats ds on ds.district_code=dp.district_code
       and ds.user_id=dp.user_id
     where dp.district_code=d.code) as parties
   from public.electoral_districts d
   join district_population pop on pop.district_code=d.code
 )
 select
   (select jsonb_agg(jsonb_build_object(
     'userId',p.user_id,'seatNo',p.seat_no,'partyName',p.party_name,
     'manifestoPolicy',p.manifesto_policy,
     'campaignInfluenceTotal',coalesce((select sum(game_internal.campaign_effective_influence(i.influence,i.updated_at,
         (now() at time zone 'UTC')::date))
       from public.match_campaign_influence i
       where i.match_id=p_match_id and i.user_id=p.user_id),0),
     'voteSharePct',round(p.vote_share*100,2),
     'seats',coalesce(t.seats,0)
    ) order by coalesce(t.seats,0) desc,p.vote_share desc,p.seat_no)
    from national_popular p left join totals t on t.user_id=p.user_id),
   (select jsonb_agg(jsonb_build_object(
     'code',d.code,'label',d.label,'seats',d.seats,
     'households',d.households,'residents',d.residents,'parties',d.parties)
     order by d.sort_order) from district_display d)
 into v_parties,v_districts;
 select jsonb_agg(jsonb_build_object(
   'code',c.code,'weight',c.population_weight,'idealPolicy',c.ideal_policy,
   'support',c.support,'trust',c.trust) order by c.code) into v_cohorts
 from public.population_cohorts c where c.government_id=v_match.government_id;
 if v_parties is null then
   raise exception 'MATCH_REQUIRES_TWO_PLAYERS' using errcode='P0001'; end if;
 if (select coalesce(sum((p->>'seats')::integer),0)
   from jsonb_array_elements(v_parties) p)<>100 or
   (select count(*) from jsonb_array_elements(v_districts))<>6 then
   raise exception 'ELECTION_DISTRICT_APPORTIONMENT_FAILED' using errcode='P0001';
 end if;
 return jsonb_build_object('modelVersion','electoral-districts-v2',
   'householdSampleSize',300,'parties',v_parties,'cohorts',v_cohorts,
   'districts',v_districts);
end $$;

-- Only newly calculated projections and certificates use v2; previous
-- published election records are never recalculated or overwritten.
alter table public.match_elections
 alter column model_version set default 'electoral-districts-v2';

-- Existing role-checked RPCs retain exact signatures and execute grants.
-- "capture_match_opinion_poll" calls _calculate_election_projection at capture,
-- so this one authoritative function is the source of both polls and elections.
