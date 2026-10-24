-- AOS-038: personalized lobby-to-legislature inbox, three real JWT identities.
-- All synthetic accounts and receipts rollback; no production seeds.
begin;
insert into auth.users
 (id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at)
select ('44000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 '00000000-0000-0000-0000-000000000000','authenticated','authenticated',
 'aos38-'||n||'@example.invalid','',now(),now(),now()
from generate_series(1,3) n;
create temporary table inbox_fixture(match_id uuid,invite_code text,bill_id uuid);
grant select,insert,update on pg_temp.inbox_fixture to authenticated;

set local role authenticated;
select set_config('request.jwt.claim.sub','44000000-0000-4000-8000-000000000001',true);
do $$
declare m public.matches%rowtype; report jsonb;
begin
 m:=public.create_match('Political Duty Center','Civic Government');
 insert into pg_temp.inbox_fixture(match_id,invite_code) values(m.id,m.invite_code);
 report:=public.get_match_action_inbox(m.id);
 if report->>'matchId'<>m.id::text or
    (select count(*) from jsonb_array_elements(report->'items') t
      where t->>'key'='ready:'||m.id::text)<>1 then
   raise exception 'HOST_LOBBY_READINESS_MISSING'; end if;
end $$;

select set_config('request.jwt.claim.sub','44000000-0000-4000-8000-000000000002',true);
select public.join_match((select invite_code from pg_temp.inbox_fixture),'Democratic Opposition');
do $$
declare f record; report jsonb; item jsonb; verified jsonb;blocked boolean:=false;
begin
 select * into f from pg_temp.inbox_fixture;
 report:=public.get_match_action_inbox(f.match_id);
 select value into item from jsonb_array_elements(report->'items') i
  where i.value->>'key'='ready:'||f.match_id::text;
 if item is null or item->>'read'<>'false' or
  (report->>'unreadCount')::integer<>1 then
  raise exception 'GUEST_PENDING_READINESS_MISSING'; end if;
 if not public.mark_match_inbox_read(f.match_id,item->>'key') then
  raise exception 'READ_RECEIPT_NOT_CONFIRMED'; end if;
 if not public.mark_match_inbox_read(f.match_id,item->>'key') then
  raise exception 'READ_RECEIPT_NOT_IDEMPOTENT'; end if;
 verified:=public.get_match_action_inbox(f.match_id);
 if verified->>'unreadCount'<>'0' or
  verified->'items'->0->>'read'<>'true' then
  raise exception 'GUEST_READ_RECEIPT_NOT_PERSISTED'; end if;
 begin perform public.mark_match_inbox_read(f.match_id,'friday:unknown');
 exception when sqlstate 'P0001' then blocked:=sqlerrm='INBOX_TASK_NOT_FOUND'; end;
 if not blocked then raise exception 'FORGED_READ_RECEIPT_ACCEPTED'; end if;
end $$;

select set_config('request.jwt.claim.sub','44000000-0000-4000-8000-000000000003',true);
do $$
declare f record; blocked boolean:=false;
begin
 select * into f from pg_temp.inbox_fixture;
 begin perform public.get_match_action_inbox(f.match_id);
 exception when sqlstate '42501' then blocked:=sqlerrm='MATCH_FORBIDDEN'; end;
 if not blocked then raise exception 'NONMEMBER_READ_INBOX'; end if;
 blocked:=false;
 begin perform public.mark_match_inbox_read(f.match_id,'ready:'||f.match_id);
 exception when sqlstate '42501' then blocked:=sqlerrm='MATCH_FORBIDDEN'; end;
 if not blocked then raise exception 'NONMEMBER_WROTE_RECEIPT'; end if;
end $$;

select set_config('request.jwt.claim.sub','44000000-0000-4000-8000-000000000001',true);
do $$
declare f record; report jsonb;
begin
 select * into f from pg_temp.inbox_fixture;
 report:=public.get_match_action_inbox(f.match_id);
 if (select count(*) from jsonb_array_elements(report->'items') i
  where i.value->>'read'='false')<>1 then
  raise exception 'GUEST_RECEIPT_LEAKED_TO_HOST'; end if;
 perform public.set_match_ready(f.match_id,true);
end $$;
select set_config('request.jwt.claim.sub','44000000-0000-4000-8000-000000000002',true);
select public.set_match_ready((select match_id from pg_temp.inbox_fixture),true);

select set_config('request.jwt.claim.sub','44000000-0000-4000-8000-000000000001',true);
do $$
declare f record; report jsonb; b public.parliament_bills%rowtype;
begin
 select * into f from pg_temp.inbox_fixture;
 report:=public.get_match_action_inbox(f.match_id);
 if (select count(*) from jsonb_array_elements(report->'items') i
  where i.value->>'section'='lobby' and i.value->>'title'='La legislatura puede comenzar')<>1 then
  raise exception 'HOST_START_TASK_MISSING'; end if;
 perform public.start_match(f.match_id);
 report:=public.get_match_action_inbox(f.match_id);
 if (select count(*) from jsonb_array_elements(report->'items') i
   where i.value->>'section'='lobby')<>0 or
   (select count(*) from jsonb_array_elements(report->'items') i
   where i.value->>'section'='campaign')<>1 then
  raise exception 'ACTIVE_MATCH_PENDING_TASKS_INCORRECT'; end if;
 b:=public.propose_parliament_bill(f.match_id,'energy-resilience',1,'household-support');
 update pg_temp.inbox_fixture set bill_id=b.id;
end $$;

select set_config('request.jwt.claim.sub','44000000-0000-4000-8000-000000000002',true);
do $$
declare f record; report jsonb; item jsonb; next jsonb;
begin
 select * into f from pg_temp.inbox_fixture;
 report:=public.get_match_action_inbox(f.match_id);
 select value into item from jsonb_array_elements(report->'items') n
   where n.value->>'key'='parliament:'||f.bill_id::text;
 if item is null or item->>'section'<>'parliament' or
    item->>'dossierId'<>'energy-resilience' or item->>'read'<>'false' then
  raise exception 'PARLIAMENT_MEMBER_TASK_MISSING'; end if;
 perform public.mark_match_inbox_read(f.match_id,item->>'key');
 next:=public.get_match_action_inbox(f.match_id);
 if (select count(*) from jsonb_array_elements(next->'items') n
  where n.value->>'key'='parliament:'||f.bill_id::text
    and n.value->>'read'='true')<>1 then
  raise exception 'PARLIAMENT_READ_RECEIPT_MISSING'; end if;
 perform public.cast_parliament_vote(f.bill_id,'yes');
 next:=public.get_match_action_inbox(f.match_id);
 if exists(select 1 from jsonb_array_elements(next->'items') n
  where n.value->>'key'='parliament:'||f.bill_id::text) then
  raise exception 'VOTED_MOTION_STILL_PENDING'; end if;
end $$;
reset role;
do $$
begin
 if has_table_privilege('authenticated','public.match_inbox_reads','SELECT')
 or has_table_privilege('authenticated','public.match_inbox_reads','INSERT')
 or has_function_privilege('anon','public.get_match_action_inbox(uuid)','EXECUTE')
 or has_function_privilege('anon','public.mark_match_inbox_read(uuid,text)','EXECUTE')
 then raise exception 'INBOX_PRIVILEGE_ESCAPE'; end if;
end $$;
rollback;
