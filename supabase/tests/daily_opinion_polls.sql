-- AOS-039: authenticated match polling, immutable daily record and privacy.
-- All synthetic identities, matches, projections and fiscal side effects rollback.
begin;
insert into auth.users
(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at)
select ('45000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 '00000000-0000-0000-0000-000000000000','authenticated','authenticated',
 'aos39-'||n||'@example.invalid','',now(),now(),now()
from generate_series(1,3) n;
create temporary table poll_fixture(match_id uuid,invite_code text);
grant select,insert on pg_temp.poll_fixture to authenticated;

set local role authenticated;
select set_config('request.jwt.claim.sub','45000000-0000-4000-8000-000000000001',true);
do $$
declare m public.matches%rowtype;
begin
 m:=public.create_match('Daily Opinion Archive','Reform Cabinet');
 insert into pg_temp.poll_fixture(match_id,invite_code) values(m.id,m.invite_code);
end $$;
select set_config('request.jwt.claim.sub','45000000-0000-4000-8000-000000000002',true);
select public.join_match((select invite_code from pg_temp.poll_fixture),'Civic Opposition');
select set_config('request.jwt.claim.sub','45000000-0000-4000-8000-000000000001',true);
select public.start_match((select match_id from pg_temp.poll_fixture));
reset role;

do $$
declare mid uuid:=(select match_id from pg_temp.poll_fixture);
 p public.match_opinion_polls%rowtype;
 blocked boolean:=false;
begin
 if not game_internal.capture_match_opinion_poll(mid) then
  raise exception 'DAILY_POLL_NOT_CAPTURED'; end if;
 if game_internal.capture_match_opinion_poll(mid) then
  raise exception 'SAME_DAY_DUPLICATE_CAPTURE'; end if;
 select * into p from public.match_opinion_polls
  where match_id=mid and poll_day=(now() at time zone 'UTC')::date;
 if p.model_version<>'electoral-districts-v2'
 or jsonb_array_length(p.projection->'parties')<>2
 or jsonb_array_length(p.projection->'districts')<>6 then
  raise exception 'POLL_NOT_USING_CERTIFICATION_MODEL'; end if;
 begin
  update public.match_opinion_polls set projection='{}'::jsonb
   where match_id=mid and poll_day=p.poll_day;
 exception when sqlstate '23514' then blocked:=sqlerrm='OPINION_POLL_IMMUTABLE'; end;
 if not blocked then raise exception 'POLL_CAN_BE_REWRITTEN'; end if;
 blocked:=false;
 begin
  delete from public.match_opinion_polls where match_id=mid;
 exception when sqlstate '23514' then blocked:=sqlerrm='OPINION_POLL_IMMUTABLE'; end;
 if not blocked then raise exception 'POLL_CAN_BE_DELETED'; end if;
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub','45000000-0000-4000-8000-000000000002',true);
do $$
declare mid uuid:=(select match_id from pg_temp.poll_fixture);
 h jsonb;
begin
 h:=public.get_match_opinion_history(mid,30);
 if h->>'matchId'<>mid::text or h->>'recordedDays'<>'1'
  or h->'polls'->0->>'modelVersion'<>'electoral-districts-v2'
  or jsonb_array_length(h->'polls'->0->'districts')<>6 then
  raise exception 'MEMBER_HISTORY_INCORRECT'; end if;
end $$;
do $$
declare blocked boolean:=false;mid uuid:=(select match_id from pg_temp.poll_fixture);
begin
 begin perform public.get_match_opinion_history(mid,91);
 exception when sqlstate 'P0001' then blocked:=sqlerrm='OPINION_HISTORY_INVALID_WINDOW'; end;
 if not blocked then raise exception 'UNBOUNDED_HISTORY_ALLOWED'; end if;
end $$;
select set_config('request.jwt.claim.sub','45000000-0000-4000-8000-000000000003',true);
do $$
declare blocked boolean:=false;mid uuid:=(select match_id from pg_temp.poll_fixture);
begin
 begin perform public.get_match_opinion_history(mid,30);
 exception when sqlstate '42501' then blocked:=sqlerrm='MATCH_FORBIDDEN'; end;
 if not blocked then raise exception 'FOREIGN_MATCH_POLL_READ'; end if;
end $$;
reset role;

do $$
declare mid uuid:=(select match_id from pg_temp.poll_fixture);r jsonb;
begin
 r:=game_internal.process_calendar();
 if not (r ? 'opinionPollsCaptured') then
  raise exception 'SCHEDULER_NOT_EXTENDED'; end if;
 if (select count(*) from public.match_opinion_polls where match_id=mid)<>1 then
  raise exception 'SCHEDULER_DUPLICATED_CURRENT_POLL'; end if;
 if has_function_privilege('anon','public.get_match_opinion_history(uuid,integer)','EXECUTE')
 or has_table_privilege('authenticated','public.match_opinion_polls','SELECT')
 or has_table_privilege('authenticated','public.match_opinion_polls','INSERT')
 or has_function_privilege('authenticated','game_internal.capture_match_opinion_poll(uuid)','EXECUTE')
 then raise exception 'POLL_PERMISSION_ESCAPE'; end if;
end $$;
rollback;
