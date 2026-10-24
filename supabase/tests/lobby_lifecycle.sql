-- AOS-036: ten identities, ready gates, seat recycling and activation races.
-- All changes and test users are rolled back.
begin;
insert into auth.users
 (id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at)
select ('41000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 '00000000-0000-0000-0000-000000000000','authenticated','authenticated',
 'lobby-'||n||'@example.invalid','',now(),now(),now()
from generate_series(1,11) n;
create temporary table lobby_fixture(match_id uuid,government_id uuid,invite_code text);
grant select,insert on pg_temp.lobby_fixture to authenticated;

set local role authenticated;
select set_config('request.jwt.claim.sub','41000000-0000-4000-8000-000000000001',true);
do $$
declare m public.matches%rowtype; denied boolean:=false;
begin
 m:=public.create_match('Lobby Readiness Assembly','Founding Party');
 if m.readiness_required or
    (public.get_match_world(m.id)->'me'->>'is_ready')::boolean then
   raise exception 'LOBBY_DEFAULT_CHANGED_UNEXPECTEDLY'; end if;
 insert into pg_temp.lobby_fixture values(m.id,m.government_id,m.invite_code);
 if not public.set_match_readiness_requirement(m.id,true) then
   raise exception 'READINESS_REQUIREMENT_DID_NOT_ENABLE'; end if;
 if not public.set_match_ready(m.id,true) then
   raise exception 'HOST_READINESS_NOT_PERSISTED'; end if;
 begin perform public.start_match(m.id);
 exception when sqlstate 'P0001' then denied:=sqlerrm='MATCH_REQUIRES_TWO_PLAYERS'; end;
 if not denied then raise exception 'SOLO_LOBBY_STARTED'; end if;
end $$;

-- Nine independently authenticated players claim all remaining seats.
do $$
declare f record; n integer; seat public.match_players%rowtype;
begin
 select * into f from pg_temp.lobby_fixture;
 for n in 2..10 loop
  perform set_config('request.jwt.claim.sub',
    '41000000-0000-4000-8000-'||lpad(n::text,12,'0'),true);
  seat:=public.join_match(f.invite_code,'Party '||n);
  if seat.seat_no<>n or seat.is_ready then
    raise exception 'LOBBY_STABLE_UNREADY_SEAT_FAILED: %',n; end if;
  if n<>4 then
    perform public.set_match_ready(f.match_id,true);
  end if;
 end loop;
end $$;

-- An unrelated player cannot modify another participant's readiness.
select set_config('request.jwt.claim.sub','41000000-0000-4000-8000-000000000011',true);
do $$
declare f record; denied boolean:=false;
begin
 select * into f from pg_temp.lobby_fixture;
 begin perform public.set_match_ready(f.match_id,true);
 exception when sqlstate '42501' then denied:=true; end;
 if not denied then raise exception 'FOREIGN_ACTOR_MUTATED_READY'; end if;
 denied:=false;
 begin perform public.set_match_readiness_requirement(f.match_id,false);
 exception when sqlstate '42501' then denied:=true; end;
 if not denied then raise exception 'NON_HOST_MUTATED_RULE'; end if;
end $$;

select set_config('request.jwt.claim.sub','41000000-0000-4000-8000-000000000001',true);
do $$
declare f record; denied boolean:=false; snapshot jsonb;
begin
 select * into f from pg_temp.lobby_fixture;
 snapshot:=public.get_match_world(f.match_id);
 if snapshot->'match'->>'readiness_required'<>'true'
    or jsonb_array_length(snapshot->'players')<>10
    or (select count(*) from jsonb_array_elements(snapshot->'players') p
        where p->>'is_ready'='true')<>9 then
   raise exception 'LOBBY_STATUS_SNAPSHOT_NOT_CONSISTENT'; end if;
 begin perform public.start_match(f.match_id);
 exception when sqlstate 'P0001' then denied:=sqlerrm='MATCH_PARTIES_NOT_READY'; end;
 if not denied then raise exception 'HOST_BYPASSED_READINESS_GATE'; end if;
end $$;

-- Joining and unjoining are idempotent until activation and reset readiness.
select set_config('request.jwt.claim.sub','41000000-0000-4000-8000-000000000004',true);
do $$
declare f record; seat public.match_players%rowtype;
begin
 select * into f from pg_temp.lobby_fixture;
 if not public.set_match_ready(f.match_id,true) then
  raise exception 'FOURTH_PARTY_COULD_NOT_PREPARE'; end if;
 if not public.leave_match(f.match_id) then
  raise exception 'FOURTH_PARTY_CANNOT_WITHDRAW'; end if;
 if public.leave_match(f.match_id) then
  raise exception 'LOBBY_LEAVE_NOT_IDEMPOTENT'; end if;
 seat:=public.join_match(f.invite_code,'Rejoined Party');
 if seat.seat_no<>4 or seat.is_ready then
  raise exception 'LOBBY_RECYCLED_SEAT_RETAINED_READY_STATE'; end if;
 perform public.set_match_ready(f.match_id,true);
end $$;

select set_config('request.jwt.claim.sub','41000000-0000-4000-8000-000000000001',true);
do $$
declare f record; m public.matches%rowtype; again public.matches%rowtype;
begin
 select * into f from pg_temp.lobby_fixture;
 if (select count(*) from jsonb_array_elements(
      public.get_match_world(f.match_id)->'players') p
    where p->>'is_ready'='false')<>0 then
   raise exception 'LOBBY_NOT_FULLY_READY'; end if;
 m:=public.start_match(f.match_id);
 again:=public.start_match(f.match_id);
 if m.status<>'active' or m.started_at is null or again.started_at<>m.started_at then
   raise exception 'LOBBY_START_NOT_IDEMPOTENT'; end if;
 if jsonb_array_length(public.get_match_world(f.match_id)->'players')<>10 then
   raise exception 'LOBBY_ACTIVATION_LOST_PLAYER'; end if;
end $$;

select set_config('request.jwt.claim.sub','41000000-0000-4000-8000-000000000004',true);
do $$
declare f record; denied boolean:=false;
begin
 select * into f from pg_temp.lobby_fixture;
 begin perform public.set_match_ready(f.match_id,false);
 exception when sqlstate 'P0001' then denied:=sqlerrm='MATCH_ALREADY_STARTED'; end;
 if not denied then raise exception 'ACTIVE_MATCH_READY_MUTABLE'; end if;
 denied:=false;
 begin perform public.leave_match(f.match_id);
 exception when sqlstate 'P0001' then denied:=sqlerrm='MATCH_ALREADY_STARTED'; end;
 if not denied then raise exception 'ACTIVE_MATCH_LEAVE_PERMITTED'; end if;
end $$;

select set_config('request.jwt.claim.sub','41000000-0000-4000-8000-000000000001',true);
do $$
declare f record; denied boolean:=false;
begin
 select * into f from pg_temp.lobby_fixture;
 begin perform public.set_match_readiness_requirement(f.match_id,false);
 exception when sqlstate 'P0001' then denied:=sqlerrm='MATCH_ALREADY_STARTED'; end;
 if not denied then raise exception 'ACTIVE_MATCH_RULE_MUTABLE'; end if;
end $$;

reset role;
do $$
begin
 if has_table_privilege('authenticated','public.match_players','UPDATE')
 or has_function_privilege('anon','public.set_match_ready(uuid,boolean)','EXECUTE')
 or has_function_privilege('anon','public.set_match_readiness_requirement(uuid,boolean)','EXECUTE')
 then raise exception 'LOBBY_PRIVILEGE_ESCALATION'; end if;
end $$;
rollback;
