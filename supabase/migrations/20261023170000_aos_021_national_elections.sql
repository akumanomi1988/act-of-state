-- AOS-021: deterministic national elections, 100-seat mandates and peaceful transfers of office.
-- The server is the only electoral authority. No client-provided vote totals.
alter table public.match_players
  add column manifesto_policy smallint not null default 50
    check (manifesto_policy between 0 and 100),
  add column mandate_seats smallint not null default 10
    check (mandate_seats between 0 and 100);

alter table public.parliament_votes
  add column seat_weight smallint not null default 10
    check (seat_weight between 1 and 100);

create table public.match_elections (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  election_no integer not null check(election_no>0),
  scheduled_on date not null,
  certified_on date not null,
  incumbent_user_id uuid not null,
  winner_user_id uuid not null,
  model_version text not null default 'electoral-cohorts-v1',
  population_snapshot jsonb not null,
  parties_snapshot jsonb not null,
  created_at timestamptz not null default now(),
  unique(match_id,election_no),
  foreign key(match_id,incumbent_user_id) references public.match_players(match_id,user_id),
  foreign key(match_id,winner_user_id) references public.match_players(match_id,user_id)
);
create index match_elections_timeline on public.match_elections(match_id,election_no desc);
alter table public.match_elections enable row level security;
revoke all on public.match_elections from public,anon,authenticated;

-- Private shared calculation: each synthetic cohort distributes its weight
-- between the declared policies of all active parties. The incumbent has a
-- bounded performance adjustment; the 100 mandates use D'Hondt quotients.
create function public._calculate_election_projection(p_match_id uuid)
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
          else 0 end)::numeric as score
    from public.match_players p
    cross join public.population_cohorts c
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
    'modelVersion','electoral-cohorts-v1','parties',v_parties,'cohorts',v_cohorts);
end $$;

create function public._next_election_date(p_match_id uuid)
returns date language sql stable security definer set search_path to '' as $$
  select case when m.status<>'active' or m.started_at is null then null
    else coalesce(
      (select e.certified_on+90 from public.match_elections e
       where e.match_id=m.id order by e.election_no desc limit 1),
      (m.started_at at time zone 'UTC')::date+90)
    end
  from public.matches m where m.id=p_match_id
$$;

create function public.get_election_state(p_match_id uuid)
returns jsonb language plpgsql stable security definer set search_path to '' as $$
declare
  v_user uuid:=auth.uid(); v_due date; v_result jsonb;
begin
  if v_user is null or not exists(
    select 1 from public.match_players
    where match_id=p_match_id and user_id=v_user) then
    raise exception 'MATCH_FORBIDDEN' using errcode='42501'; end if;
  v_due:=public._next_election_date(p_match_id);
  select jsonb_build_object(
    'projection',public._calculate_election_projection(p_match_id),
    'nextDueOn',v_due,
    'campaignClosesOn',v_due-7,
    'canCertify',v_due is not null and (now() at time zone 'UTC')::date>=v_due,
    'serverDay',(now() at time zone 'UTC')::date,
    'history',coalesce((select jsonb_agg(to_jsonb(e) order by e.election_no desc)
      from public.match_elections e where e.match_id=p_match_id),'[]'::jsonb)
  ) into v_result;
  return v_result;
end $$;

create function public.set_party_manifesto(p_match_id uuid,p_policy smallint)
returns public.match_players language plpgsql security definer set search_path to '' as $$
declare
  v_user uuid:=auth.uid(); v_due date;
  v_match public.matches%rowtype; v_player public.match_players%rowtype;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  if p_policy is null or p_policy<0 or p_policy>100 then
    raise exception 'ELECTION_INVALID_POLICY' using errcode='P0001'; end if;
  select * into v_match from public.matches where id=p_match_id for update;
  if not found then raise exception 'MATCH_FORBIDDEN' using errcode='42501'; end if;
  select * into v_player from public.match_players
    where match_id=p_match_id and user_id=v_user for update;
  if not found then raise exception 'MATCH_FORBIDDEN' using errcode='42501'; end if;
  v_due:=public._next_election_date(p_match_id);
  if v_due is not null and (now() at time zone 'UTC')::date>v_due-7 then
    raise exception 'ELECTION_CAMPAIGN_CLOSED' using errcode='P0001'; end if;
  update public.match_players set manifesto_policy=p_policy
    where match_id=p_match_id and user_id=v_user returning * into v_player;
  return v_player;
end $$;

create function public.certify_match_election(p_match_id uuid)
returns public.match_elections language plpgsql security definer
set search_path to '' as $$
declare
  v_user uuid:=auth.uid(); v_match public.matches%rowtype;
  v_due date; v_projection jsonb; v_winner uuid;
  v_election public.match_elections%rowtype; v_party jsonb;
  v_no integer; v_day date:=(now() at time zone 'UTC')::date;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  select * into v_match from public.matches where id=p_match_id for update;
  if not found or not exists(select 1 from public.match_players
      where match_id=p_match_id and user_id=v_user) then
    raise exception 'MATCH_FORBIDDEN' using errcode='42501'; end if;
  if v_match.status<>'active' then
    raise exception 'MATCH_NOT_ACTIVE' using errcode='P0001'; end if;
  v_due:=public._next_election_date(p_match_id);
  if v_day<v_due then raise exception 'ELECTION_NOT_DUE' using errcode='P0001'; end if;
  if exists(select 1 from public.parliament_bills
      where match_id=p_match_id and status='open') then
    raise exception 'ELECTION_PARLIAMENT_OPEN' using errcode='P0001'; end if;
  select coalesce(max(election_no),0)+1 into v_no
    from public.match_elections where match_id=p_match_id;
  v_projection:=public._calculate_election_projection(p_match_id);
  v_winner:=(v_projection->'parties'->0->>'userId')::uuid;
  if (select sum((x->>'seats')::integer)
      from jsonb_array_elements(v_projection->'parties') x)<>100 then
    raise exception 'ELECTION_SEAT_ALLOCATION_INVALID' using errcode='P0001'; end if;
  insert into public.match_elections(
    match_id,election_no,scheduled_on,certified_on,incumbent_user_id,
    winner_user_id,population_snapshot,parties_snapshot)
  values(p_match_id,v_no,v_due,v_day,v_match.host_user_id,v_winner,
    v_projection->'cohorts',v_projection->'parties')
  returning * into v_election;
  for v_party in select value from jsonb_array_elements(v_projection->'parties') loop
    update public.match_players
      set mandate_seats=(v_party->>'seats')::smallint
      where match_id=p_match_id and user_id=(v_party->>'userId')::uuid;
  end loop;
  update public.matches set host_user_id=v_winner where id=p_match_id;
  return v_election;
end $$;

revoke all on function public._calculate_election_projection(uuid),
  public._next_election_date(uuid),public.get_election_state(uuid),
  public.set_party_manifesto(uuid,smallint),public.certify_match_election(uuid)
  from public,anon,authenticated;
grant execute on function public.get_election_state(uuid),
  public.set_party_manifesto(uuid,smallint),
  public.certify_match_election(uuid) to authenticated;

-- Legislative votes are weighted by the current elected mandate. No election
-- can occur while a bill is open, so a bill's mandate cannot change mid-vote.
create or replace function public.finalize_parliament_bill(p_bill_id uuid)
returns public.parliament_bills language plpgsql security definer
set search_path to '' as $$
declare
  v_user uuid:=auth.uid();
  v_bill public.parliament_bills%rowtype;
  v_total integer; v_count integer; v_yes integer; v_no integer;
  v_pass boolean;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  select * into v_bill from public.parliament_bills where id=p_bill_id for update;
  if not found or not exists(select 1 from public.match_players
      where match_id=v_bill.match_id and user_id=v_user) then
    raise exception 'MATCH_FORBIDDEN' using errcode='42501'; end if;
  if v_bill.status<>'open' then return v_bill; end if;
  select coalesce(sum(mandate_seats),0) into v_total from public.match_players where match_id=v_bill.match_id;
  select coalesce(sum(seat_weight),0),
         coalesce(sum(seat_weight) filter(where choice='yes'),0),
         coalesce(sum(seat_weight) filter(where choice='no'),0)
    into v_count,v_yes,v_no from public.parliament_votes where bill_id=p_bill_id;
  -- An absolute majority can approve immediately. Otherwise, wait for every
  -- ballot or the 24-hour deadline, then require quorum and more yes than no.
  if v_yes>v_total/2 then
    v_pass:=true;
  elsif v_count=v_total or now()>=v_bill.closes_at then
    v_pass:=v_count>=(v_total+1)/2 and v_yes>v_no;
  else
    return v_bill;
  end if;
  update public.parliament_bills
    set status=case when v_pass then 'passed' else 'rejected' end,
        closed_at=now()
    where id=p_bill_id returning * into v_bill;
  return v_bill;
end $$;

create or replace function public.cast_parliament_vote(p_bill_id uuid,p_choice text)
returns public.parliament_bills language plpgsql security definer
set search_path to '' as $$
declare
  v_user uuid:=auth.uid();
  v_bill public.parliament_bills%rowtype;
  v_existing text; v_weight smallint;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  if p_choice not in ('yes','no','abstain') or p_choice is null then
    raise exception 'PARLIAMENT_INVALID_VOTE' using errcode='P0001'; end if;
  select * into v_bill from public.parliament_bills where id=p_bill_id for update;
  if not found or not exists(select 1 from public.match_players
      where match_id=v_bill.match_id and user_id=v_user) then
    raise exception 'MATCH_FORBIDDEN' using errcode='42501'; end if;
  select mandate_seats into v_weight from public.match_players
    where match_id=v_bill.match_id and user_id=v_user;
  if v_weight=0 then raise exception 'ELECTION_NO_MANDATE' using errcode='42501'; end if;
  select choice into v_existing from public.parliament_votes
    where bill_id=p_bill_id and user_id=v_user;
  if found then
    if v_existing=p_choice then return v_bill; end if;
    raise exception 'PARLIAMENT_VOTE_LOCKED' using errcode='P0001';
  end if;
  if v_bill.status<>'open' or now()>=v_bill.closes_at then
    raise exception 'PARLIAMENT_VOTE_CLOSED' using errcode='P0001'; end if;
  insert into public.parliament_votes(bill_id,match_id,user_id,choice,seat_weight)
  values(p_bill_id,v_bill.match_id,v_user,p_choice,v_weight);
  return public.finalize_parliament_bill(p_bill_id);
end $$;


-- The elected leader, not the original match creator, now exercises cabinet power.
create or replace function public.submit_decision(
 p_government_id uuid,p_dossier_id text,p_dossier_version integer,p_option_id text
) returns public.decision_events
language plpgsql volatile security definer set search_path=''
as $$
declare
 v_owner uuid:=auth.uid();
 v_g public.governments%rowtype;
 v_d public.dossiers%rowtype;
 v_o public.dossier_options%rowtype;
 v_c public.population_cohorts%rowtype;
 v_event public.decision_events%rowtype;
 v_before jsonb; v_after jsonb; v_effects jsonb:='[]'::jsonb;
 v_new_support smallint; v_new_trust smallint;
 v_approval smallint; v_trust smallint;
 v_day date:=(now() at time zone 'UTC')::date;
begin
 if v_owner is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
 -- Serialize decisions within the same government.
 select * into v_g from public.governments
 where id=p_government_id for update;
 if not found then
  raise exception 'GOVERNMENT_NOT_FOUND_OR_FORBIDDEN' using errcode='42501';
 end if;
 if not (
   (v_g.owner_id=v_owner and not exists(select 1 from public.matches
      where government_id=v_g.id and status='active'))
   or exists(select 1 from public.matches
      where government_id=v_g.id and status='active' and host_user_id=v_owner)
 ) then
   raise exception 'GOVERNMENT_NOT_FOUND_OR_FORBIDDEN' using errcode='42501';
 end if;
 -- Retried identical requests return the same persisted event.
 select * into v_event from public.decision_events
 where government_id=v_g.id and dossier_id=p_dossier_id;
 if found then
  if v_event.option_id<>p_option_id or v_event.dossier_version<>p_dossier_version then
   raise exception 'DOSSIER_ALREADY_DECIDED' using errcode='P0001';
  end if;
  return v_event;
 end if;
 select * into v_d from public.dossiers
 where id=p_dossier_id and version=p_dossier_version;
 if not found or (v_d.release_kind='weekly' and v_d.available_from is null)
 or (v_d.available_from is not null and v_day<v_d.available_from)
 or (v_d.available_until is not null and v_day>v_d.available_until) then
  raise exception 'DOSSIER_NOT_AVAILABLE' using errcode='P0001';
 end if;
 select * into v_o from public.dossier_options
 where dossier_id=p_dossier_id and dossier_version=p_dossier_version and id=p_option_id;
 if not found then raise exception 'INVALID_OPTION' using errcode='P0001'; end if;
 if v_g.treasury_m_eur+v_o.treasury_delta_m_eur<0 then
  raise exception 'INSUFFICIENT_TREASURY' using errcode='P0001';
 end if;
 v_before:=jsonb_build_object('treasury_m_eur',v_g.treasury_m_eur,
  'approval',v_g.approval,'trust',v_g.trust);
 -- Deterministic weighted cohort response. Version: weighted-cohorts-v1.
 for v_c in select * from public.population_cohorts
   where government_id=v_g.id order by code for update
 loop
  v_new_support:=greatest(0,least(100,v_c.support+
   round((50-abs(v_c.ideal_policy-v_o.policy_target))*v_o.response_intensity/100.0)::int));
  v_new_trust:=greatest(0,least(100,v_c.trust+
   round((50-abs(v_c.ideal_policy-v_o.policy_target))*v_o.response_intensity/200.0)::int+
   v_o.trust_base_delta));
  update public.population_cohorts
   set support=v_new_support,trust=v_new_trust where id=v_c.id;
  v_effects:=v_effects||jsonb_build_array(jsonb_build_object(
   'code',v_c.code,'label',v_c.label,'population_weight',v_c.population_weight,
   'support_before',v_c.support,'support_after',v_new_support,
   'trust_before',v_c.trust,'trust_after',v_new_trust));
 end loop;
 select round(sum(population_weight*support)::numeric/
   nullif(sum(population_weight),0))::smallint,
  round(sum(population_weight*trust)::numeric/
   nullif(sum(population_weight),0))::smallint
 into v_approval,v_trust from public.population_cohorts where government_id=v_g.id;
 if v_approval is null or v_trust is null then
  raise exception 'POPULATION_NOT_INITIALIZED' using errcode='P0001';
 end if;
 update public.governments
 set treasury_m_eur=treasury_m_eur+v_o.treasury_delta_m_eur,
 approval=v_approval,trust=v_trust,updated_at=now()
 where id=v_g.id returning * into v_g;
 v_after:=jsonb_build_object('treasury_m_eur',v_g.treasury_m_eur,
  'approval',v_g.approval,'trust',v_g.trust);
 insert into public.decision_events(government_id,dossier_id,dossier_version,
  option_id,decided_on,state_before,state_after,cohort_effects,engine_version,parameters_snapshot)
 values(v_g.id,p_dossier_id,p_dossier_version,p_option_id,v_day,v_before,
  v_after,v_effects,'weighted-cohorts-v1',jsonb_build_object(
   'treasury_delta_m_eur',v_o.treasury_delta_m_eur,
   'policy_target',v_o.policy_target,
   'response_intensity',v_o.response_intensity,
   'trust_base_delta',v_o.trust_base_delta)) returning * into v_event;
 return v_event;
end $$;
