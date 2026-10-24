-- AOS-033: Discoverability is opt-in; existing matches remain invitation-only.
alter table public.matches
 add column is_public boolean not null default false;
create index public_matchmaking_directory_idx
 on public.matches(created_at desc,id) where is_public and status='lobby';

-- Only the host of a *lobby* can make its existence discoverable.
create function public.set_match_visibility(
  p_match_id uuid,p_is_public boolean
) returns boolean language plpgsql volatile security definer set search_path='' as $$
declare v_user uuid:=auth.uid(); v_match public.matches%rowtype;
begin
 if v_user is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
 if p_is_public is null then
   raise exception 'MATCH_INVALID_VISIBILITY' using errcode='P0001'; end if;
 select * into v_match from public.matches where id=p_match_id for update;
 if not found or v_match.host_user_id<>v_user then
   raise exception 'MATCH_FORBIDDEN' using errcode='42501'; end if;
 if v_match.status<>'lobby' then
   raise exception 'MATCH_ALREADY_STARTED' using errcode='P0001'; end if;
 update public.matches set is_public=p_is_public where id=v_match.id;
 return p_is_public;
end $$;

-- Directory never returns invitation tokens, host identity, national state,
-- private player names or cross-match data. No anonymous game directory.
create function public.list_public_lobbies()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_user uuid:=auth.uid();
begin
 if v_user is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
 return coalesce((
  select jsonb_agg(jsonb_build_object(
   'id',s.id,'title',s.title,
   'player_count',s.player_count,'open_seats',10-s.player_count,
   'created_at',s.created_at) order by s.created_at desc,s.id)
  from (
   select m.id,m.title,m.created_at,
     count(p.user_id)::integer as player_count
   from public.matches m
   join public.match_players p on p.match_id=m.id
   where m.is_public and m.status='lobby'
     and not exists(select 1 from public.match_players me
       where me.match_id=m.id and me.user_id=v_user)
   group by m.id,m.title,m.created_at
   having count(p.user_id)<10
   order by m.created_at desc,m.id
   limit 40
  ) s
 ),'[]'::jsonb);
end $$;

-- Serialized on the same match lock used by the existing invite join path.
-- Secret invite_code is strictly server-side and is never returned to caller.
create function public.join_public_lobby(
 p_match_id uuid,p_party_name text
) returns public.match_players
language plpgsql volatile security definer set search_path='' as $$
declare
 v_user uuid:=auth.uid();
 v_match public.matches%rowtype;
 v_joined public.match_players%rowtype;
begin
 if v_user is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
 if length(btrim(coalesce(p_party_name,''))) not between 3 and 60 then
   raise exception 'MATCH_INVALID_NAME' using errcode='P0001'; end if;
 select * into v_match from public.matches where id=p_match_id for update;
 if not found or not v_match.is_public then
   raise exception 'MATCH_NOT_PUBLIC' using errcode='42501'; end if;
 if v_match.status<>'lobby' then
   raise exception 'MATCH_ALREADY_STARTED' using errcode='P0001'; end if;
 -- Idempotency for a previously joined member is delegated to join_match.
 v_joined:=public.join_match(v_match.invite_code,p_party_name);
 return v_joined;
end $$;
revoke all on function public.set_match_visibility(uuid,boolean)
 from public,anon,authenticated;
revoke all on function public.list_public_lobbies()
 from public,anon,authenticated;
revoke all on function public.join_public_lobby(uuid,text)
 from public,anon,authenticated;
grant execute on function public.set_match_visibility(uuid,boolean) to authenticated;
grant execute on function public.list_public_lobbies() to authenticated;
grant execute on function public.join_public_lobby(uuid,text) to authenticated;

-- Owner-authorized nation snapshot now includes public-lobby visibility.
create or replace function public.get_match_world(p_match_id uuid)
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
      'started_at',v_match.started_at,'is_public',v_match.is_public,'max_players',10),
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
