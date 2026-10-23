-- AOS-023: autonomous close -> election -> Friday settlement; all fixtures roll back.
begin;
insert into auth.users
 (id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at)
select ('40000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 '00000000-0000-0000-0000-000000000000','authenticated','authenticated',
 'calendar-'||n||'@example.invalid','',now(),now(),now()
from generate_series(1,3) n;

create temporary table calendar_fixture(match_id uuid,government_id uuid,invite_code text,bill_id uuid);
grant select,insert,update on pg_temp.calendar_fixture to authenticated;
set local role authenticated;
select set_config('request.jwt.claim.sub','40000000-0000-4000-8000-000000000001',true);
do $$
declare m public.matches%rowtype;
begin
 m:=public.create_match('Autonomous Calendar','Civic Front');
 insert into pg_temp.calendar_fixture(match_id,government_id,invite_code)
 values(m.id,m.government_id,m.invite_code);
end $$;
select set_config('request.jwt.claim.sub','40000000-0000-4000-8000-000000000002',true);
do $$
declare f record;
begin
 select * into f from pg_temp.calendar_fixture;
 perform public.join_match(f.invite_code,'Reform Alliance');
end $$;
select set_config('request.jwt.claim.sub','40000000-0000-4000-8000-000000000001',true);
do $$
declare f record; b public.parliament_bills%rowtype;
begin
 select * into f from pg_temp.calendar_fixture;
 perform public.start_match(f.match_id);
 b:=public.propose_parliament_bill(
   f.match_id,'energy-resilience',1,'household-support');
 update pg_temp.calendar_fixture set bill_id=b.id;
 if b.status<>'open' then raise exception 'CALENDAR_FIXTURE_BILL_NOT_OPEN'; end if;
end $$;

-- Only the administrative clock can settle due events.
reset role;
update public.matches set started_at=now()-interval '91 days'
 where id=(select match_id from pg_temp.calendar_fixture);
update public.parliament_bills set closes_at=now()-interval '1 minute'
 where id=(select bill_id from pg_temp.calendar_fixture);

do $$
declare f record; a jsonb; again jsonb; due_friday date;
  v_closures integer; v_elections integer;
begin
 select * into f from pg_temp.calendar_fixture;
 a:=game_internal.process_calendar();
 if (a->>'closedBills')::integer<>1 or
    (a->>'certifiedElections')::integer<>1 or
    (a->>'fridayClosures')::integer<1 or
    (a->>'errors')::integer<>0 then
   raise exception 'AUTONOMOUS_CALENDAR_FIRST_RUN_FAILED %',a; end if;
 if (select status from public.parliament_bills where id=f.bill_id)<>'rejected' then
   raise exception 'EXPIRED_BALLOT_NOT_REJECTED'; end if;
 if (select count(*) from public.match_elections where match_id=f.match_id)<>1 then
   raise exception 'ELECTION_NOT_CERTIFIED_ONCE'; end if;
 if (select sum(mandate_seats) from public.match_players
     where match_id=f.match_id)<>100 then
   raise exception 'AUTOMATIC_MANDATE_ALLOCATION_INVALID'; end if;
 select count(*) into v_closures from public.match_weekly_closures where match_id=f.match_id;
 if v_closures<12 then raise exception 'FRIDAY_CATCHUP_MISSING'; end if;
 due_friday:=(now() at time zone 'UTC')::date;
 due_friday:=due_friday-(extract(isodow from due_friday)::integer-1);
 if extract(isodow from (now() at time zone 'UTC')::date)<6 then
   due_friday:=due_friday-7; end if;
 if not exists(select 1 from public.match_weekly_closures
   where match_id=f.match_id and week_start=due_friday) then
   raise exception 'LATEST_FRIDAY_NOT_SETTLED'; end if;
 if game_internal.close_match_friday(f.match_id,due_friday) then
   raise exception 'FRIDAY_SETTLEMENT_NOT_IDEMPOTENT'; end if;
 again:=game_internal.process_calendar();
 if (again->>'closedBills')::integer<>0 or
    (again->>'certifiedElections')::integer<>0 or
    (again->>'fridayClosures')::integer<>0 or
    (again->>'errors')::integer<>0 then
   raise exception 'AUTONOMOUS_CALENDAR_RETRY_NOT_IDEMPOTENT %',again; end if;
 if (select count(*) from public.match_weekly_closures where match_id=f.match_id)
    <>v_closures then raise exception 'FRIDAY_DUPLICATED'; end if;
 if (select count(*) from game_internal.calendar_failures)<>0 then
   raise exception 'UNEXPECTED_CALENDAR_ERRORS'; end if;
end $$;

-- Calendar read model is available to both parties and hidden from outsiders.
set local role authenticated;
select set_config('request.jwt.claim.sub','40000000-0000-4000-8000-000000000001',true);
do $$
declare f record; state jsonb; blocked boolean:=false;
begin
 select * into f from pg_temp.calendar_fixture;
 state:=public.get_match_calendar(f.match_id);
 if state->>'gameDay'<>(now() at time zone 'UTC')::date::text or
    state->>'weeklyPublished'<>'false' or
    state->'latestFriday' is null or state->'latestFriday'='null'::jsonb then
   raise exception 'CALENDAR_READ_MODEL_INVALID %',state; end if;
 if has_schema_privilege('authenticated','game_internal','USAGE') or
    has_function_privilege('authenticated','game_internal.process_calendar()','EXECUTE') or
    has_table_privilege('authenticated','public.match_weekly_closures','SELECT') then
   raise exception 'CALENDAR_PRIVATE_SURFACE_EXPOSED'; end if;
 begin perform game_internal.process_calendar();
 exception when insufficient_privilege then blocked:=true; end;
 if not blocked then raise exception 'MEMBER_INVOKED_INTERNAL_CALENDAR'; end if;
end $$;
select set_config('request.jwt.claim.sub','40000000-0000-4000-8000-000000000002',true);
do $$
declare f record; state jsonb;
begin
 select * into f from pg_temp.calendar_fixture;
 state:=public.get_match_calendar(f.match_id);
 if state->>'monday' is null then raise exception 'SECOND_PARTY_CANNOT_READ_CALENDAR'; end if;
end $$;
select set_config('request.jwt.claim.sub','40000000-0000-4000-8000-000000000003',true);
do $$
declare f record; blocked boolean:=false;
begin
 select * into f from pg_temp.calendar_fixture;
 begin perform public.get_match_calendar(f.match_id);
 exception when insufficient_privilege then blocked:=true; end;
 if not blocked then raise exception 'OUTSIDER_READ_CALENDAR'; end if;
end $$;
rollback;
