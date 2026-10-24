-- AOS-033: public matchmaking, privacy, authority and joins in one rollback.
begin;
insert into auth.users
 (id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at)
select ('36000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 '00000000-0000-0000-0000-000000000000',
 'authenticated','authenticated','matchmaking-'||n||'@example.invalid',
 '',now(),now(),now()
from generate_series(1,4) n;
create temporary table public_match_fixture(match_id uuid,invite_code text);
grant select,insert on pg_temp.public_match_fixture to authenticated;

set local role authenticated;
select set_config('request.jwt.claim.sub','36000000-0000-4000-8000-000000000001',true);
do $$
declare m public.matches%rowtype;
begin
 m:=public.create_match('Discoverable Assembly','Civic Host');
 if m.is_public then raise exception 'MATCH_PRIVACY_NOT_DEFAULT'; end if;
 insert into pg_temp.public_match_fixture values(m.id,m.invite_code);
 if public.list_public_lobbies()<>'[]'::jsonb then
   raise exception 'PRIVATE_MATCH_PUBLICLY_DISCOVERABLE'; end if;
 if (public.get_match_world(m.id)->'match'->>'is_public')::boolean then
   raise exception 'MATCH_WORLD_PRIVACY_INCORRECT'; end if;
end $$;

-- An authenticated outsider cannot join a private match by knowing its UUID.
select set_config('request.jwt.claim.sub','36000000-0000-4000-8000-000000000002',true);
do $$
declare f record; forbidden boolean:=false;
begin
 select * into f from pg_temp.public_match_fixture;
 begin perform public.join_public_lobby(f.match_id,'Guest Party');
 exception when sqlstate '42501' then
   forbidden:=sqlerrm='MATCH_NOT_PUBLIC'; end;
 if not forbidden then raise exception 'PRIVATE_MATCH_JOIN_ALLOWED'; end if;
 forbidden:=false;
 begin perform public.set_match_visibility(f.match_id,true);
 exception when sqlstate '42501' then
   forbidden:=sqlerrm='MATCH_FORBIDDEN'; end;
 if not forbidden then raise exception 'NON_HOST_MATCH_VISIBILITY_ALLOWED'; end if;
 if public.list_public_lobbies()<>'[]'::jsonb then
   raise exception 'PRIVATE_MATCH_EXPOSED_TO_OUTSIDER'; end if;
end $$;

select set_config('request.jwt.claim.sub','36000000-0000-4000-8000-000000000001',true);
do $$
declare f record; b boolean;
begin
 select * into f from pg_temp.public_match_fixture;
 b:=public.set_match_visibility(f.match_id,true);
 if not b or not (public.get_match_world(f.match_id)->'match'->>'is_public')::boolean then
   raise exception 'HOST_PUBLICATION_NOT_CONFIRMED'; end if;
end $$;
select set_config('request.jwt.claim.sub','36000000-0000-4000-8000-000000000002',true);
do $$
declare f record; d jsonb; p public.match_players%rowtype;
  repeated public.match_players%rowtype;
begin
 select * into f from pg_temp.public_match_fixture;
 d:=public.list_public_lobbies();
 if jsonb_array_length(d)<>1 or (d->0->>'player_count')::integer<>1
    or (d->0->>'open_seats')::integer<>9 then
    raise exception 'INVALID_PUBLIC_DIRECTORY: %',d; end if;
 if d->0 ? 'invite_code' or d->0 ? 'host_user_id'
    or d->0 ? 'government_id' or d->0 ? 'players' then
    raise exception 'PUBLIC_DIRECTORY_REVEALED_PRIVATE_DATA'; end if;
 p:=public.join_public_lobby(f.match_id,'Guest Party');
 repeated:=public.join_public_lobby(f.match_id,'Guest Party');
 if p.seat_no<>2 or repeated.seat_no<>p.seat_no then
   raise exception 'PUBLIC_JOIN_NOT_IDEMPOTENT'; end if;
 if public.list_public_lobbies()<>'[]'::jsonb then
   raise exception 'ALREADY_JOINED_MATCH_DISCOVERABLE'; end if;
end $$;

select set_config('request.jwt.claim.sub','36000000-0000-4000-8000-000000000001',true);
do $$
declare f record;
begin
 select * into f from pg_temp.public_match_fixture;
 if public.set_match_visibility(f.match_id,false) then
   raise exception 'HOST_PRIVATE_TOGGLE_FAILED'; end if;
end $$;
select set_config('request.jwt.claim.sub','36000000-0000-4000-8000-000000000003',true);
do $$
declare f record; forbidden boolean:=false;
begin
 select * into f from pg_temp.public_match_fixture;
 if public.list_public_lobbies()<>'[]'::jsonb then
   raise exception 'UNPUBLISHED_MATCH_STILL_PUBLIC'; end if;
 begin perform public.join_public_lobby(f.match_id,'Another Party');
 exception when sqlstate '42501' then forbidden:=true; end;
 if not forbidden then raise exception 'PRIVATE_REJOIN_ALLOWED'; end if;
end $$;

select set_config('request.jwt.claim.sub','36000000-0000-4000-8000-000000000001',true);
do $$
declare f record;
begin
 select * into f from pg_temp.public_match_fixture;
 perform public.set_match_visibility(f.match_id,true);
 perform public.start_match(f.match_id);
 if public.list_public_lobbies()<>'[]'::jsonb then
   raise exception 'STARTED_MATCH_DISCOVERABLE'; end if;
end $$;
select set_config('request.jwt.claim.sub','36000000-0000-4000-8000-000000000003',true);
do $$
declare f record; blocked boolean:=false;
begin
 select * into f from pg_temp.public_match_fixture;
 begin perform public.join_public_lobby(f.match_id,'Another Party');
 exception when sqlstate 'P0001' then
   blocked:=sqlerrm='MATCH_ALREADY_STARTED'; end;
 if not blocked then raise exception 'STARTED_PUBLIC_MATCH_JOINED'; end if;
end $$;
select set_config('request.jwt.claim.sub','36000000-0000-4000-8000-000000000001',true);
do $$
declare f record; blocked boolean:=false;
begin
 select * into f from pg_temp.public_match_fixture;
 begin perform public.set_match_visibility(f.match_id,false);
 exception when sqlstate 'P0001' then
   blocked:=sqlerrm='MATCH_ALREADY_STARTED'; end;
 if not blocked then raise exception 'ACTIVE_MATCH_VISIBILITY_MUTATED'; end if;
end $$;

-- Access contract: no anonymous listing, joining or toggling.
reset role;
do $$
begin
 if has_function_privilege('anon','public.list_public_lobbies()','EXECUTE')
    or has_function_privilege('anon','public.join_public_lobby(uuid,text)','EXECUTE')
    or has_function_privilege('anon','public.set_match_visibility(uuid,boolean)','EXECUTE')
    or has_table_privilege('authenticated','public.matches','SELECT')
    or not has_function_privilege('authenticated','public.join_public_lobby(uuid,text)','EXECUTE')
 then raise exception 'PUBLIC_MATCHMAKING_ACCESS_LEAK'; end if;
end $$;
rollback;
