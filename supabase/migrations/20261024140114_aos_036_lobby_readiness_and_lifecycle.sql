-- AOS-036: Multiplayer lobby participation and host-controlled ready checks.
-- Legacy lobbies are kept opt-out, preserving their admission semantics.
alter table public.matches
  add column readiness_required boolean not null default false;
alter table public.match_players
  add column is_ready boolean not null default false;

-- Lock the match row first, matching start_match, join_match and leave_match.
-- No session can become ready after the game has already started.
create function public.set_match_ready(p_match_id uuid,p_ready boolean)
returns boolean language plpgsql volatile security definer set search_path='' as $$
declare v_user uuid:=auth.uid();v_match public.matches%rowtype;
begin
 if v_user is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
 if p_ready is null then raise exception 'MATCH_INVALID_READY' using errcode='P0001'; end if;
 select * into v_match from public.matches where id=p_match_id for update;
 if not found then raise exception 'MATCH_FORBIDDEN' using errcode='42501'; end if;
 if not exists(select 1 from public.match_players p
   where p.match_id=p_match_id and p.user_id=v_user) then
   raise exception 'MATCH_FORBIDDEN' using errcode='42501'; end if;
 if v_match.status<>'lobby' then raise exception 'MATCH_ALREADY_STARTED' using errcode='P0001'; end if;
 update public.match_players set is_ready=p_ready
 where match_id=p_match_id and user_id=v_user;
 return p_ready;
end $$;

create function public.set_match_readiness_requirement(
 p_match_id uuid,p_required boolean
) returns boolean language plpgsql volatile security definer set search_path='' as $$
declare v_user uuid:=auth.uid();v_match public.matches%rowtype;
begin
 if v_user is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
 if p_required is null then
   raise exception 'MATCH_INVALID_READY' using errcode='P0001'; end if;
 select * into v_match from public.matches where id=p_match_id for update;
 if not found or v_match.host_user_id<>v_user then
   raise exception 'MATCH_FORBIDDEN' using errcode='42501'; end if;
 if v_match.status<>'lobby' then
   raise exception 'MATCH_ALREADY_STARTED' using errcode='P0001'; end if;
 update public.matches set readiness_required=p_required where id=p_match_id;
 return p_required;
end $$;

-- Existing games (readiness_required=false) keep their previous contract;
-- enabling readiness is opt-in, explicit and persisted on each match.
-- Start shares the same exclusive match lock as toggles and withdrawals.
create or replace function public.start_match(p_match_id uuid)
returns public.matches
language plpgsql volatile security definer set search_path=''
as $$
declare v_user uuid:=auth.uid();v_match public.matches%rowtype;
begin
 if v_user is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
 select * into v_match from public.matches where id=p_match_id for update;
 if not found or v_match.host_user_id<>v_user then
   raise exception 'MATCH_FORBIDDEN' using errcode='42501'; end if;
 if v_match.status='active' then return v_match; end if;
 if (select count(*) from public.match_players where match_id=v_match.id)<2 then
   raise exception 'MATCH_REQUIRES_TWO_PLAYERS' using errcode='P0001'; end if;
 if v_match.readiness_required and exists(
   select 1 from public.match_players p
   where p.match_id=v_match.id and not p.is_ready
 ) then raise exception 'MATCH_PARTIES_NOT_READY' using errcode='P0001'; end if;
 update public.matches set status='active',started_at=now()
 where id=v_match.id returning * into v_match;
 return v_match;
end $$;

revoke all on function public.set_match_ready(uuid,boolean),
 public.set_match_readiness_requirement(uuid,boolean)
 from public,anon,authenticated;
grant execute on function public.set_match_ready(uuid,boolean),
 public.set_match_readiness_requirement(uuid,boolean)
 to authenticated;
