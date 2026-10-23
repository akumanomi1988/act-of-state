-- ACT OF STATE | Ten-party asynchronous multiplayer match foundation.
-- Reuses one real owner-bound government and the existing decision engine.
create table public.matches (
  id uuid primary key default gen_random_uuid(),
  government_id uuid not null unique references public.governments(id) on delete cascade,
  host_user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (length(btrim(title)) between 3 and 80),
  invite_code text not null unique default replace(gen_random_uuid()::text,'-',''),
  status text not null default 'lobby' check (status in ('lobby','active')),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  check ((status='lobby' and started_at is null)
    or (status='active' and started_at is not null))
);
create index matches_host_idx on public.matches(host_user_id);
create table public.match_players (
  match_id uuid not null references public.matches(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  seat_no smallint not null check (seat_no between 1 and 10),
  party_name text not null check (length(btrim(party_name)) between 3 and 60),
  joined_at timestamptz not null default now(),
  primary key(match_id,user_id),
  unique(match_id,seat_no)
);
create unique index match_party_name_ci_unique
  on public.match_players(match_id,lower(party_name));
create index match_players_user_idx on public.match_players(user_id,joined_at desc);
create table public.match_stances (
  match_id uuid not null,
  user_id uuid not null,
  dossier_id text not null,
  dossier_version integer not null,
  option_id text not null,
  policy_affinity smallint not null check (policy_affinity between 0 and 100),
  engine_version text not null default 'policy-affinity-v1'
    check(engine_version='policy-affinity-v1'),
  created_at timestamptz not null default now(),
  primary key(match_id,user_id,dossier_id),
  foreign key(match_id,user_id) references public.match_players(match_id,user_id)
    on delete cascade,
  foreign key(dossier_id,dossier_version,option_id)
    references public.dossier_options(dossier_id,dossier_version,id)
);
create index match_stances_feed_idx on public.match_stances(match_id,created_at desc);

-- No direct browser access: all reads and writes pass explicit membership checks.
alter table public.matches enable row level security;
alter table public.match_players enable row level security;
alter table public.match_stances enable row level security;
revoke all on public.matches,public.match_players,public.match_stances
  from public,anon,authenticated;

create function public.create_match(p_title text,p_party_name text)
returns public.matches
language plpgsql volatile security definer set search_path=''
as $$
declare
  v_user uuid:=auth.uid();
  v_government public.governments%rowtype;
  v_match public.matches%rowtype;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  if length(btrim(coalesce(p_title,''))) not between 3 and 80 or
     length(btrim(coalesce(p_party_name,''))) not between 3 and 60 then
    raise exception 'MATCH_INVALID_NAME' using errcode='P0001';
  end if;
  v_government:=public.start_government();
  insert into public.matches(government_id,host_user_id,title)
  values(v_government.id,v_user,btrim(p_title))
  on conflict(government_id) do nothing returning * into v_match;
  if found then
    insert into public.match_players(match_id,user_id,seat_no,party_name)
    values(v_match.id,v_user,1,btrim(p_party_name));
    return v_match;
  end if;
  select * into strict v_match from public.matches
  where government_id=v_government.id;
  if not exists(select 1 from public.match_players p
    where p.match_id=v_match.id and p.user_id=v_user and p.seat_no=1) then
    raise exception 'MATCH_HOST_INTEGRITY_ERROR' using errcode='P0001';
  end if;
  return v_match;
end $$;

create function public.join_match(p_invite_code text,p_party_name text)
returns public.match_players
language plpgsql volatile security definer set search_path=''
as $$
declare
  v_user uuid:=auth.uid();
  v_match public.matches%rowtype;
  v_player public.match_players%rowtype;
  v_seat smallint;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  if length(btrim(coalesce(p_party_name,''))) not between 3 and 60 then
    raise exception 'MATCH_INVALID_NAME' using errcode='P0001';
  end if;
  select * into v_match from public.matches
  where invite_code=p_invite_code for update;
  if not found then raise exception 'MATCH_INVITE_NOT_FOUND' using errcode='P0001'; end if;
  select * into v_player from public.match_players
  where match_id=v_match.id and user_id=v_user;
  if found then return v_player; end if;
  if v_match.status<>'lobby' then
    raise exception 'MATCH_ALREADY_STARTED' using errcode='P0001';
  end if;
  select seat into v_seat from generate_series(1,10) as seat
  where not exists(select 1 from public.match_players p
    where p.match_id=v_match.id and p.seat_no=seat)
  order by seat limit 1;
  if v_seat is null then raise exception 'MATCH_FULL' using errcode='P0001'; end if;
  if exists(select 1 from public.match_players p
    where p.match_id=v_match.id and lower(p.party_name)=lower(btrim(p_party_name))) then
    raise exception 'MATCH_PARTY_NAME_TAKEN' using errcode='P0001'; end if;
  insert into public.match_players(match_id,user_id,seat_no,party_name)
  values(v_match.id,v_user,v_seat,btrim(p_party_name)) returning * into v_player;
  return v_player;
end $$;

create function public.start_match(p_match_id uuid)
returns public.matches
language plpgsql volatile security definer set search_path=''
as $$
declare v_user uuid:=auth.uid(); v_match public.matches%rowtype;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  select * into v_match from public.matches where id=p_match_id for update;
  if not found or v_match.host_user_id<>v_user then
    raise exception 'MATCH_FORBIDDEN' using errcode='42501';
  end if;
  if v_match.status='active' then return v_match; end if;
  if (select count(*) from public.match_players where match_id=v_match.id)<2 then
    raise exception 'MATCH_REQUIRES_TWO_PLAYERS' using errcode='P0001';
  end if;
  update public.matches set status='active',started_at=now()
  where id=v_match.id returning * into v_match;
  return v_match;
end $$;

create function public.leave_match(p_match_id uuid)
returns boolean
language plpgsql volatile security definer set search_path=''
as $$
declare v_user uuid:=auth.uid(); v_match public.matches%rowtype;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  select * into v_match from public.matches where id=p_match_id for update;
  if not found then return false; end if;
  if v_match.host_user_id=v_user then
    raise exception 'MATCH_HOST_CANNOT_LEAVE' using errcode='P0001'; end if;
  if v_match.status<>'lobby' then
    raise exception 'MATCH_ALREADY_STARTED' using errcode='P0001'; end if;
  delete from public.match_players
  where match_id=v_match.id and user_id=v_user;
  return found;
end $$;

create function public.list_my_matches()
returns jsonb
language sql stable security definer set search_path=''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',m.id,'title',m.title,'status',m.status,
    'host_user_id',m.host_user_id,'government_id',m.government_id,
    'seat_no',p.seat_no,'party_name',p.party_name,
    'player_count',(select count(*) from public.match_players x where x.match_id=m.id),
    'created_at',m.created_at
  ) order by m.created_at desc),'[]'::jsonb)
  from public.match_players p join public.matches m on m.id=p.match_id
  where p.user_id=auth.uid()
$$;

create function public.get_match_world(p_match_id uuid)
returns jsonb
language plpgsql stable security definer set search_path=''
as $$
declare v_user uuid:=auth.uid(); v_match public.matches%rowtype;
  v_me public.match_players%rowtype; v_day date:=(now() at time zone 'UTC')::date;
  v_world jsonb;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  select * into v_me from public.match_players
  where match_id=p_match_id and user_id=v_user;
  if not found then raise exception 'MATCH_FORBIDDEN' using errcode='42501'; end if;
  select * into strict v_match from public.matches where id=p_match_id;
  select jsonb_build_object(
    'match',jsonb_build_object(
      'id',v_match.id,'title',v_match.title,'status',v_match.status,
      'host_user_id',v_match.host_user_id,'government_id',v_match.government_id,
      'invite_code',v_match.invite_code,'created_at',v_match.created_at,
      'started_at',v_match.started_at,'max_players',10),
    'me',to_jsonb(v_me),
    'gameDay',v_day::text,
    'players',coalesce((select jsonb_agg(to_jsonb(p) order by p.seat_no)
      from public.match_players p where p.match_id=v_match.id),'[]'::jsonb),
    'government',to_jsonb(g),
    'cohorts',coalesce((select jsonb_agg(to_jsonb(c) order by c.code)
      from public.population_cohorts c where c.government_id=g.id),'[]'::jsonb),
    'dossiers',coalesce((select jsonb_agg(to_jsonb(d) order by d.id,d.version desc)
      from public.dossiers d
      where (d.release_kind='intro' or
        (d.release_kind='weekly' and exists (
          select 1 from public.weekly_releases r
          where r.week_start=d.available_from and r.state='approved')))
        and (d.available_from is null or d.available_from<=v_day)
        and (d.available_until is null or d.available_until>=v_day)
    ),'[]'::jsonb),
    'options',coalesce((select jsonb_agg(to_jsonb(o) order by o.dossier_id,o.id)
      from public.dossier_options o join public.dossiers d
        on d.id=o.dossier_id and d.version=o.dossier_version
      where (d.release_kind='intro' or
        (d.release_kind='weekly' and exists (
          select 1 from public.weekly_releases r
          where r.week_start=d.available_from and r.state='approved')))
        and (d.available_from is null or d.available_from<=v_day)
        and (d.available_until is null or d.available_until>=v_day)
    ),'[]'::jsonb),
    'events',coalesce((select jsonb_agg(to_jsonb(e) order by e.created_at desc,e.id)
      from public.decision_events e where e.government_id=g.id),'[]'::jsonb),
    'stances',coalesce((select jsonb_agg(to_jsonb(s) order by s.created_at,s.user_id)
      from public.match_stances s where s.match_id=v_match.id),'[]'::jsonb)
  ) into v_world
  from public.governments g where g.id=v_match.government_id;
  return v_world;
end $$;

create function public.record_match_stance(
  p_match_id uuid,p_dossier_id text,p_dossier_version integer,p_option_id text
) returns public.match_stances
language plpgsql volatile security definer set search_path=''
as $$
declare
  v_user uuid:=auth.uid(); v_match public.matches%rowtype;
  v_player public.match_players%rowtype; v_government public.governments%rowtype;
  v_dossier public.dossiers%rowtype; v_option public.dossier_options%rowtype;
  v_stance public.match_stances%rowtype; v_affinity smallint;
  v_day date:=(now() at time zone 'UTC')::date;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  select * into v_match from public.matches where id=p_match_id for share;
  if not found then raise exception 'MATCH_FORBIDDEN' using errcode='42501'; end if;
  select * into v_player from public.match_players
  where match_id=p_match_id and user_id=v_user for update;
  if not found then raise exception 'MATCH_FORBIDDEN' using errcode='42501'; end if;
  if v_match.status<>'active' then
    raise exception 'MATCH_NOT_ACTIVE' using errcode='P0001'; end if;
  select * into v_stance from public.match_stances
  where match_id=p_match_id and user_id=v_user and dossier_id=p_dossier_id;
  if found then
    if v_stance.option_id<>p_option_id or v_stance.dossier_version<>p_dossier_version then
      raise exception 'MATCH_STANCE_ALREADY_RECORDED' using errcode='P0001'; end if;
    return v_stance;
  end if;
  select * into v_dossier from public.dossiers
  where id=p_dossier_id and version=p_dossier_version;
  if not found or (v_dossier.available_from is not null and
      v_dossier.available_from>v_day) or
      (v_dossier.available_until is not null and v_dossier.available_until<v_day) or
      (v_dossier.release_kind='weekly' and not exists (
        select 1 from public.weekly_releases r where r.week_start=v_dossier.available_from
        and r.state='approved')) then
    raise exception 'DOSSIER_NOT_AVAILABLE' using errcode='P0001'; end if;
  select * into v_option from public.dossier_options
  where dossier_id=p_dossier_id and dossier_version=p_dossier_version
    and id=p_option_id;
  if not found then raise exception 'INVALID_OPTION' using errcode='P0001'; end if;
  -- Same shared population defines all parties' policy-affinity score.
  -- This is NOT a simulated election or a percentage of votes.
  select * into strict v_government from public.governments
  where id=v_match.government_id for share;
  select round(sum(c.population_weight*
    greatest(0,100-abs(c.ideal_policy-v_option.policy_target)*2))::numeric/
    nullif(sum(c.population_weight),0))::smallint into v_affinity
  from public.population_cohorts c where c.government_id=v_government.id;
  if v_affinity is null then
    raise exception 'POPULATION_NOT_INITIALIZED' using errcode='P0001'; end if;
  insert into public.match_stances(
    match_id,user_id,dossier_id,dossier_version,option_id,policy_affinity
  ) values(
    p_match_id,v_user,p_dossier_id,p_dossier_version,p_option_id,v_affinity
  ) returning * into v_stance;
  return v_stance;
end $$;

revoke all on function public.create_match(text,text) from public,anon,authenticated;
revoke all on function public.join_match(text,text) from public,anon,authenticated;
revoke all on function public.start_match(uuid) from public,anon,authenticated;
revoke all on function public.leave_match(uuid) from public,anon,authenticated;
revoke all on function public.list_my_matches() from public,anon,authenticated;
revoke all on function public.get_match_world(uuid) from public,anon,authenticated;
revoke all on function public.record_match_stance(uuid,text,integer,text)
  from public,anon,authenticated;
grant execute on function public.create_match(text,text) to authenticated;
grant execute on function public.join_match(text,text) to authenticated;
grant execute on function public.start_match(uuid) to authenticated;
grant execute on function public.leave_match(uuid) to authenticated;
grant execute on function public.list_my_matches() to authenticated;
grant execute on function public.get_match_world(uuid) to authenticated;
grant execute on function public.record_match_stance(uuid,text,integer,text)
  to authenticated;
