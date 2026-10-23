-- AOS-025: voluntary coalition agreements and constructive confidence votes.
-- Every mutation is serialized on the match row; private tables have no Data API grants.
create table public.match_coalition_members (
  match_id uuid not null references public.matches(id) on delete cascade,
  user_id uuid not null,
  leader_id uuid not null,
  status text not null check (status in ('invited','accepted','declined','left')),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (match_id,user_id),
  foreign key (match_id,user_id) references public.match_players(match_id,user_id) on delete cascade,
  foreign key (match_id,leader_id) references public.match_players(match_id,user_id) on delete cascade,
  check (leader_id<>user_id)
);
create index match_coalition_leader_idx on public.match_coalition_members(match_id,leader_id,status);
alter table public.match_coalition_members enable row level security;
revoke all on public.match_coalition_members from public,anon,authenticated;

create table public.match_confidence_motions (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  proposer_id uuid not null,
  candidate_id uuid not null,
  incumbent_id uuid not null,
  status text not null default 'open' check (status in ('open','passed','rejected')),
  rule_version text not null default 'confidence-constructive-v1',
  created_at timestamptz not null default now(),
  closes_at timestamptz not null default (now()+interval '24 hours'),
  closed_at timestamptz,
  foreign key (match_id,proposer_id) references public.match_players(match_id,user_id),
  foreign key (match_id,candidate_id) references public.match_players(match_id,user_id),
  foreign key (match_id,incumbent_id) references public.match_players(match_id,user_id),
  unique (id,match_id),
  check (candidate_id<>incumbent_id),
  check (closes_at>created_at),
  check ((status='open' and closed_at is null) or (status<>'open' and closed_at is not null))
);
create unique index match_one_open_confidence on public.match_confidence_motions(match_id)
  where status='open';
create index match_confidence_history on public.match_confidence_motions(match_id,created_at desc);

create table public.match_confidence_votes (
  motion_id uuid not null,
  match_id uuid not null,
  user_id uuid not null,
  choice text not null check(choice in ('yes','no','abstain')),
  seat_weight smallint not null check(seat_weight between 1 and 100),
  created_at timestamptz not null default now(),
  primary key (motion_id,user_id),
  foreign key (motion_id,match_id) references public.match_confidence_motions(id,match_id)
    on delete cascade,
  foreign key (match_id,user_id) references public.match_players(match_id,user_id)
    on delete cascade
);
create index match_confidence_votes_member_idx on public.match_confidence_votes(match_id,user_id);
alter table public.match_confidence_motions enable row level security;
alter table public.match_confidence_votes enable row level security;
revoke all on public.match_confidence_motions,public.match_confidence_votes
  from public,anon,authenticated;

create function public.invite_coalition_partner(p_match_id uuid,p_partner uuid)
returns public.match_coalition_members language plpgsql security definer
set search_path='' as $$
declare
  v_user uuid:=auth.uid(); v_match public.matches%rowtype;
  v_row public.match_coalition_members%rowtype;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  select * into v_match from public.matches where id=p_match_id for update;
  if not found or v_match.host_user_id<>v_user then
    raise exception 'MATCH_FORBIDDEN' using errcode='42501'; end if;
  if v_match.status<>'active' then
    raise exception 'MATCH_NOT_ACTIVE' using errcode='P0001'; end if;
  if p_partner is null or p_partner=v_user or not exists(
    select 1 from public.match_players where match_id=p_match_id and user_id=p_partner
      and mandate_seats>0) then
    raise exception 'COALITION_INVALID_PARTNER' using errcode='P0001'; end if;
  insert into public.match_coalition_members(match_id,user_id,leader_id,status)
    values(p_match_id,p_partner,v_user,'invited')
  on conflict(match_id,user_id) do update
    set leader_id=excluded.leader_id,
        status=case when public.match_coalition_members.leader_id=excluded.leader_id
          and public.match_coalition_members.status in ('accepted','invited')
          then public.match_coalition_members.status else 'invited' end,
        updated_at=case when public.match_coalition_members.leader_id=excluded.leader_id
          and public.match_coalition_members.status in ('accepted','invited')
          then public.match_coalition_members.updated_at else now() end
  returning * into v_row;
  return v_row;
end $$;

create function public.respond_coalition_invite(p_match_id uuid,p_accept boolean)
returns public.match_coalition_members language plpgsql security definer
set search_path='' as $$
declare
  v_user uuid:=auth.uid(); v_match public.matches%rowtype;
  v_row public.match_coalition_members%rowtype; v_next text;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  if p_accept is null then raise exception 'COALITION_INVALID_RESPONSE' using errcode='P0001'; end if;
  select * into v_match from public.matches where id=p_match_id for update;
  if not found or v_match.status<>'active' or not exists(
    select 1 from public.match_players where match_id=p_match_id and user_id=v_user) then
    raise exception 'MATCH_FORBIDDEN' using errcode='42501'; end if;
  select * into v_row from public.match_coalition_members
    where match_id=p_match_id and user_id=v_user and leader_id=v_match.host_user_id
    for update;
  if not found then raise exception 'COALITION_NOT_INVITED' using errcode='P0001'; end if;
  if p_accept then
    if v_row.status='accepted' then return v_row; end if;
    if v_row.status<>'invited' then
      raise exception 'COALITION_INVITE_CLOSED' using errcode='P0001'; end if;
    v_next:='accepted';
  else
    if v_row.status in ('declined','left') then return v_row; end if;
    v_next:=case when v_row.status='accepted' then 'left' else 'declined' end;
  end if;
  update public.match_coalition_members set status=v_next,updated_at=now()
    where match_id=p_match_id and user_id=v_user returning * into v_row;
  return v_row;
end $$;

-- This helper is intentionally inaccessible outside game_internal.
-- Both player-triggered finalization and scheduled finalization use it.
create function game_internal.finalize_confidence_motion(p_motion_id uuid)
returns public.match_confidence_motions language plpgsql set search_path='' as $$
declare
  v_match public.matches%rowtype; v_motion public.match_confidence_motions%rowtype;
  v_match_id uuid; v_total integer; v_yes integer; v_eligible integer; v_voted integer;
  v_pass boolean;
begin
  select match_id into v_match_id from public.match_confidence_motions where id=p_motion_id;
  if v_match_id is null then raise exception 'CONFIDENCE_NOT_FOUND' using errcode='P0001'; end if;
  select * into v_match from public.matches where id=v_match_id for update;
  select * into v_motion from public.match_confidence_motions where id=p_motion_id for update;
  if v_motion.status<>'open' then return v_motion; end if;
  select coalesce(sum(mandate_seats),0),count(*) filter(where mandate_seats>0)
    into v_total,v_eligible from public.match_players where match_id=v_match_id;
  select coalesce(sum(seat_weight) filter(where choice='yes'),0),count(*)
    into v_yes,v_voted from public.match_confidence_votes where motion_id=p_motion_id;
  v_pass:=v_yes>v_total/2;
  if not v_pass and v_voted<v_eligible and now()<v_motion.closes_at
      and v_match.host_user_id=v_motion.incumbent_id then
    return v_motion;
  end if;
  update public.match_confidence_motions
    set status=case when v_pass and v_match.host_user_id=v_motion.incumbent_id
      then 'passed' else 'rejected' end,closed_at=now()
    where id=p_motion_id returning * into v_motion;
  if v_motion.status='passed' then
    update public.matches set host_user_id=v_motion.candidate_id
      where id=v_motion.match_id and host_user_id=v_motion.incumbent_id;
  end if;
  return v_motion;
end $$;

create function public.propose_confidence_motion(p_match_id uuid,p_candidate uuid)
returns public.match_confidence_motions language plpgsql security definer
set search_path='' as $$
declare
  v_user uuid:=auth.uid(); v_match public.matches%rowtype;
  v_motion public.match_confidence_motions%rowtype; v_due date;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  select * into v_match from public.matches where id=p_match_id for update;
  if not found or not exists(select 1 from public.match_players
    where match_id=p_match_id and user_id=v_user and mandate_seats>0) then
    raise exception 'MATCH_FORBIDDEN' using errcode='42501'; end if;
  if v_match.status<>'active' then raise exception 'MATCH_NOT_ACTIVE' using errcode='P0001'; end if;
  if p_candidate is null or p_candidate=v_match.host_user_id or not exists(
    select 1 from public.match_players
    where match_id=p_match_id and user_id=p_candidate and mandate_seats>0) then
    raise exception 'CONFIDENCE_INVALID_CANDIDATE' using errcode='P0001'; end if;
  v_due:=public._next_election_date(p_match_id);
  if v_due is not null and (now() at time zone 'UTC')::date>=v_due-1 then
    raise exception 'CONFIDENCE_ELECTION_WINDOW' using errcode='P0001'; end if;
  select * into v_motion from public.match_confidence_motions
    where match_id=p_match_id and status='open' for update;
  if found then
    if v_motion.proposer_id=v_user and v_motion.candidate_id=p_candidate
      and v_motion.incumbent_id=v_match.host_user_id then
      return v_motion; end if;
    raise exception 'CONFIDENCE_ALREADY_OPEN' using errcode='P0001';
  end if;
  insert into public.match_confidence_motions(
    match_id,proposer_id,candidate_id,incumbent_id)
  values(p_match_id,v_user,p_candidate,v_match.host_user_id)
  returning * into v_motion;
  return v_motion;
end $$;

create function public.cast_confidence_vote(p_motion_id uuid,p_choice text)
returns public.match_confidence_motions language plpgsql security definer
set search_path='' as $$
declare
  v_user uuid:=auth.uid(); v_match_id uuid;
  v_motion public.match_confidence_motions%rowtype;
  v_weight smallint; v_existing text;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  if p_choice is null or p_choice not in ('yes','no','abstain') then
    raise exception 'CONFIDENCE_INVALID_VOTE' using errcode='P0001'; end if;
  select match_id into v_match_id from public.match_confidence_motions where id=p_motion_id;
  if v_match_id is null then raise exception 'CONFIDENCE_NOT_FOUND' using errcode='P0001'; end if;
  -- Uniform lock ordering with elections, legislation and coalition operations.
  perform 1 from public.matches where id=v_match_id for update;
  select * into v_motion from public.match_confidence_motions where id=p_motion_id for update;
  select mandate_seats into v_weight from public.match_players
    where match_id=v_match_id and user_id=v_user;
  if not found or v_weight=0 then
    raise exception 'MATCH_FORBIDDEN' using errcode='42501'; end if;
  select choice into v_existing from public.match_confidence_votes
    where motion_id=p_motion_id and user_id=v_user;
  if found then
    if v_existing=p_choice then return v_motion; end if;
    raise exception 'CONFIDENCE_VOTE_LOCKED' using errcode='P0001';
  end if;
  if v_motion.status<>'open' or now()>=v_motion.closes_at then
    raise exception 'CONFIDENCE_VOTE_CLOSED' using errcode='P0001'; end if;
  insert into public.match_confidence_votes(motion_id,match_id,user_id,choice,seat_weight)
  values(p_motion_id,v_match_id,v_user,p_choice,v_weight);
  return game_internal.finalize_confidence_motion(p_motion_id);
end $$;

create function public.finalize_confidence_motion(p_motion_id uuid)
returns public.match_confidence_motions language plpgsql security definer
set search_path='' as $$
declare v_user uuid:=auth.uid(); v_match_id uuid;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  select match_id into v_match_id from public.match_confidence_motions where id=p_motion_id;
  if not exists(select 1 from public.match_players
    where match_id=v_match_id and user_id=v_user) then
    raise exception 'MATCH_FORBIDDEN' using errcode='42501'; end if;
  return game_internal.finalize_confidence_motion(p_motion_id);
end $$;

create function public.get_governance_state(p_match_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_user uuid:=auth.uid(); v_host uuid; v_seats integer; v_coalition_seats integer;
begin
  if v_user is null or not exists(select 1 from public.match_players
    where match_id=p_match_id and user_id=v_user) then
    raise exception 'MATCH_FORBIDDEN' using errcode='42501'; end if;
  select host_user_id into v_host from public.matches where id=p_match_id;
  select coalesce(sum(p.mandate_seats),0) into v_seats
    from public.match_players p where p.match_id=p_match_id;
  select coalesce(sum(p.mandate_seats),0) into v_coalition_seats
    from public.match_players p where p.match_id=p_match_id and
      (p.user_id=v_host or exists (
        select 1 from public.match_coalition_members c
        where c.match_id=p_match_id and c.user_id=p.user_id
          and c.leader_id=v_host and c.status='accepted'));
  return jsonb_build_object(
    'hostUserId',v_host,'totalSeats',v_seats,'coalitionSeats',v_coalition_seats,
    'coalition',coalesce((select jsonb_agg(to_jsonb(c) order by c.user_id)
      from public.match_coalition_members c where c.match_id=p_match_id
        and c.leader_id=v_host),'[]'::jsonb),
    'motions',coalesce((select jsonb_agg(to_jsonb(m) order by m.created_at desc,m.id)
      from public.match_confidence_motions m where m.match_id=p_match_id),'[]'::jsonb),
    'votes',coalesce((select jsonb_agg(to_jsonb(v) order by v.created_at,v.user_id)
      from public.match_confidence_votes v where v.match_id=p_match_id),'[]'::jsonb),
    'serverNow',now());
end $$;

-- Elections cannot override an unresolved transfer of government.
-- The trigger also applies to direct privileged election writes.
create function game_internal.guard_confidence_election()
returns trigger language plpgsql set search_path='' as $$
begin
  if exists(select 1 from public.match_confidence_motions
    where match_id=new.match_id and status='open') then
    raise exception 'CONFIDENCE_MOTION_OPEN' using errcode='P0001';
  end if;
  return new;
end $$;
create trigger election_requires_no_open_confidence
  before insert on public.match_elections
  for each row execute function game_internal.guard_confidence_election();

-- Cron already executes game_internal.process_calendar() every 15 minutes.
-- Retain that public-facing job command while invoking the confidence closer first.
alter function game_internal.process_calendar() rename to process_calendar_core;
create function game_internal.process_calendar()
returns jsonb language plpgsql set search_path='' as $$
declare
  v_motion record; v_result jsonb; v_closed integer:=0; v_errors integer:=0;
  v_final public.match_confidence_motions%rowtype;
begin
  for v_motion in select id from public.match_confidence_motions
    where status='open' and closes_at<=now()
    order by closes_at,id limit 100
  loop
    begin
      v_final:=game_internal.finalize_confidence_motion(v_motion.id);
      if v_final.status<>'open' then v_closed:=v_closed+1; end if;
    exception when others then
      v_errors:=v_errors+1;
      raise warning 'AOS confidence calendar retry failed for %: %',v_motion.id,sqlerrm;
    end;
  end loop;
  v_result:=game_internal.process_calendar_core();
  return v_result||jsonb_build_object('confidenceClosures',v_closed,
    'confidenceErrors',v_errors);
end $$;

revoke all on function public.invite_coalition_partner(uuid,uuid),
  public.respond_coalition_invite(uuid,boolean),
  public.propose_confidence_motion(uuid,uuid),
  public.cast_confidence_vote(uuid,text),
  public.finalize_confidence_motion(uuid),
  public.get_governance_state(uuid)
  from public,anon,authenticated;
grant execute on function public.invite_coalition_partner(uuid,uuid),
  public.respond_coalition_invite(uuid,boolean),
  public.propose_confidence_motion(uuid,uuid),
  public.cast_confidence_vote(uuid,text),
  public.finalize_confidence_motion(uuid),
  public.get_governance_state(uuid) to authenticated;
revoke all on function game_internal.finalize_confidence_motion(uuid),
  game_internal.guard_confidence_election(),
  game_internal.process_calendar_core(),game_internal.process_calendar()
  from public,anon,authenticated;
