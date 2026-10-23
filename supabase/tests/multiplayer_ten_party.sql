-- Ten independent authenticated identities share one governed nation. Rolled back.
begin;
insert into auth.users
 (id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at)
select ('20000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 '00000000-0000-0000-0000-000000000000','authenticated','authenticated',
 'multiplayer-'||n||'@example.invalid','',now(),now(),now()
from generate_series(1,11) n;
create temporary table multiplayer_fixture(
  match_id uuid,invite_code text,government_id uuid);
grant select,insert on pg_temp.multiplayer_fixture to authenticated;
create temporary table parliament_fixture(bill_id uuid);
grant select,insert on pg_temp.parliament_fixture to authenticated;

set local role authenticated;
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000001',true);
do $$
declare m public.matches%rowtype; retry public.matches%rowtype;
  blocked boolean:=false;
begin
  m:=public.create_match('National Assembly Test','Civic Coalition');
  retry:=public.create_match('Ignored on idempotent retry','Another Party');
  if m.id<>retry.id or m.status<>'lobby' then
    raise exception 'MATCH_CREATE_NOT_IDEMPOTENT'; end if;
  if jsonb_array_length(public.get_match_world(m.id)->'players')<>1 then
    raise exception 'HOST_SEAT_NOT_PERSISTED'; end if;
  insert into pg_temp.multiplayer_fixture values(m.id,m.invite_code,m.government_id);
  begin perform public.start_match(m.id);
  exception when sqlstate 'P0001' then blocked:=sqlerrm='MATCH_REQUIRES_TWO_PLAYERS'; end;
  if not blocked then raise exception 'SOLO_MATCH_STARTED'; end if;
end $$;

-- Nine additional accounts occupy the remaining nine stable party seats.
do $$
declare m record; n integer; p public.match_players%rowtype;
  user_id uuid;
begin
  select * into m from pg_temp.multiplayer_fixture;
  for n in 2..10 loop
    user_id:=('20000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid;
    perform set_config('request.jwt.claim.sub',user_id::text,true);
    p:=public.join_match(m.invite_code,'Political Party '||n);
    if p.seat_no<>n or p.user_id<>user_id then
      raise exception 'MATCH_SEAT_ALLOCATION_FAILED_%',n; end if;
  end loop;
  if jsonb_array_length(public.get_match_world(m.match_id)->'players')<>10 then
    raise exception 'TEN_PARTIES_NOT_SEATED'; end if;
end $$;

-- Rejoining is safe; an eleventh identity is refused without mutation.
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000002',true);
do $$
declare m record; p public.match_players%rowtype;
begin
 select * into m from pg_temp.multiplayer_fixture;
 p:=public.join_match(m.invite_code,'Different request on retry');
 if p.seat_no<>2 or p.party_name<>'Political Party 2' then
   raise exception 'JOIN_RETRY_CHANGED_PARTY'; end if;
 if jsonb_array_length(public.list_my_matches())<>1 then
   raise exception 'MATCH_NOT_RESUMABLE'; end if;
end $$;
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000011',true);
do $$
declare m record; blocked boolean:=false;
begin
 select * into m from pg_temp.multiplayer_fixture;
 if jsonb_array_length(public.list_my_matches())<>0 then
   raise exception 'OUTSIDER_LIST_LEAK'; end if;
 begin perform public.join_match(m.invite_code,'Eleventh Political Party');
 exception when sqlstate 'P0001' then blocked:=sqlerrm='MATCH_FULL'; end;
 if not blocked then raise exception 'ELEVENTH_PLAYER_JOINED'; end if;
 blocked:=false;
 begin perform public.get_match_world(m.match_id);
 exception when insufficient_privilege then blocked:=true; end;
 if not blocked then raise exception 'OUTSIDER_READ_MATCH'; end if;
 blocked:=false;
 begin perform public.start_match(m.match_id);
 exception when insufficient_privilege then blocked:=true; end;
 if not blocked then raise exception 'OUTSIDER_STARTED_MATCH'; end if;
end $$;

-- Host activates the session; all ten party memberships are locked in.
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000001',true);
do $$
declare m record; started public.matches%rowtype; retry public.matches%rowtype;
begin
 select * into m from pg_temp.multiplayer_fixture;
 started:=public.start_match(m.match_id);
 if started.status<>'active' or started.started_at is null then
   raise exception 'MATCH_DID_NOT_START'; end if;
 retry:=public.start_match(m.match_id);
 if retry.started_at<>started.started_at then
   raise exception 'START_RETRY_CHANGED_TIMESTAMP'; end if;
end $$;

-- Opposition can express one policy stance, but cannot execute the cabinet decision.
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000002',true);
do $$
declare m record; first_stance public.match_stances%rowtype;
  retry public.match_stances%rowtype; blocked boolean:=false; w jsonb;
begin
 select * into m from pg_temp.multiplayer_fixture;
 first_stance:=public.record_match_stance(m.match_id,'energy-resilience',1,'household-support');
 retry:=public.record_match_stance(m.match_id,'energy-resilience',1,'household-support');
 if first_stance.policy_affinity<>65 or
    first_stance.created_at<>retry.created_at or
    first_stance.engine_version<>'policy-affinity-v1' then
  raise exception 'DETERMINISTIC_STANCE_OR_RETRY_FAILED'; end if;
 begin
   perform public.record_match_stance(m.match_id,'energy-resilience',1,'industry-investment');
 exception when sqlstate 'P0001' then
   blocked:=sqlerrm='MATCH_STANCE_ALREADY_RECORDED'; end;
 if not blocked then raise exception 'DUPLICATE_STANCE_CHANGED_OPTION'; end if;
 blocked:=false;
 begin perform public.submit_decision(m.government_id,'energy-resilience',1,'household-support');
 exception when insufficient_privilege then blocked:=true; end;
 if not blocked then raise exception 'OPPOSITION_EXECUTED_GOVERNMENT_DECISION'; end if;
 w:=public.get_match_world(m.match_id);
 if jsonb_array_length(w->'players')<>10 or
    jsonb_array_length(w->'stances')<>1 or
    (w->'government'->>'treasury_m_eur')::integer<>12000 then
  raise exception 'SHARED_WORLD_BEFORE_CABINET_DECISION_INVALID'; end if;
 if has_table_privilege('authenticated','public.matches','SELECT') or
    has_table_privilege('authenticated','public.match_players','SELECT') or
    has_table_privilege('authenticated','public.match_stances','SELECT') or
    has_table_privilege('authenticated','public.match_stances','INSERT') then
  raise exception 'MULTIPLAYER_DIRECT_DATA_API_EXPOSURE'; end if;
end $$;

-- A cabinet bypass must fail atomically, leaving treasury and cohorts unchanged.
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000001',true);
do $
declare m record; blocked boolean:=false; g public.governments%rowtype;
begin
  select * into m from pg_temp.multiplayer_fixture;
  begin perform public.submit_decision(m.government_id,'energy-resilience',1,'household-support');
  exception when sqlstate 'P0001' then blocked:=sqlerrm='PARLIAMENT_APPROVAL_REQUIRED'; end;
  if not blocked then raise exception 'CABINET_BYPASSED_PARLIAMENT'; end if;
  select * into g from public.governments where id=m.government_id;
  if g.treasury_m_eur<>12000 or exists(select 1 from public.decision_events
      where government_id=m.government_id) then
    raise exception 'REJECTED_CABINET_WRITE_NOT_ATOMIC'; end if;
end $;

-- Government introduces a bill. Identical retries cannot create a second ballot.
do $
declare m record; b public.parliament_bills%rowtype; retry public.parliament_bills%rowtype;
begin
  select * into m from pg_temp.multiplayer_fixture;
  b:=public.propose_parliament_bill(m.match_id,'energy-resilience',1,'household-support');
  retry:=public.propose_parliament_bill(m.match_id,'energy-resilience',1,'household-support');
  if b.id<>retry.id or b.status<>'open' then
    raise exception 'PARLIAMENT_PROPOSAL_NOT_IDEMPOTENT'; end if;
  insert into pg_temp.parliament_fixture values(b.id);
  if jsonb_array_length(public.get_parliament_state(m.match_id)->'bills')<>1 then
    raise exception 'PARLIAMENT_BILL_NOT_VISIBLE'; end if;
end $;

-- Eleven is forbidden; ten seats each have one immutable ballot.
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000011',true);
do $
declare b uuid; m record; denied boolean:=false;
begin
  select bill_id into b from pg_temp.parliament_fixture;
  select * into m from pg_temp.multiplayer_fixture;
  begin perform public.cast_parliament_vote(b,'yes');
  exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'OUTSIDER_VOTED'; end if;
  denied:=false;
  begin perform public.get_parliament_state(m.match_id);
  exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'OUTSIDER_READ_PARLIAMENT'; end if;
end $;
do $
declare n integer; b uuid; user_id uuid; result public.parliament_bills%rowtype;
  choice text; denied boolean;
begin
  select bill_id into b from pg_temp.parliament_fixture;
  for n in 1..10 loop
    user_id:=('20000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid;
    perform set_config('request.jwt.claim.sub',user_id::text,true);
    choice:=case when n<=5 or n=10 then 'yes' else 'no' end;
    result:=public.cast_parliament_vote(b,choice);
    if n<10 and result.status<>'open' then
      raise exception 'PARLIAMENT_CLOSED_PREMATURELY_%',n; end if;
  end loop;
  if result.status<>'passed' then raise exception 'MAJORITY_BILL_NOT_PASSED'; end if;
  perform set_config('request.jwt.claim.sub',
    '20000000-0000-4000-8000-000000000002',true);
  result:=public.cast_parliament_vote(b,'yes');
  if result.status<>'passed' then raise exception 'RETRY_LOST_PASSED_STATUS'; end if;
  denied:=false;
  begin perform public.cast_parliament_vote(b,'no');
  exception when sqlstate 'P0001' then denied:=sqlerrm='PARLIAMENT_VOTE_LOCKED'; end;
  if not denied then raise exception 'IMMUTABLE_BALLOT_CHANGED'; end if;
  if (select count(*) from public.parliament_votes where bill_id=b)<>10 then
    raise exception 'TEN_BALLOTS_NOT_PERSISTED'; end if;
end $;
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000001',true);
do $
declare m record; denied boolean:=false;
begin
  select * into m from pg_temp.multiplayer_fixture;
  begin perform public.propose_parliament_bill(
    m.match_id,'energy-resilience',1,'industry-investment');
  exception when sqlstate 'P0001' then denied:=sqlerrm='PARLIAMENT_ALREADY_APPROVED'; end;
  if not denied then raise exception 'SECOND_BILL_AFTER_PASS'; end if;
end $;

-- The government controls the shared nation's existing deterministic engine.
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000001',true);
do $$
declare m record; e public.decision_events%rowtype; retry public.decision_events%rowtype;
begin
 select * into m from pg_temp.multiplayer_fixture;
 e:=public.submit_decision(m.government_id,'energy-resilience',1,'household-support');
 retry:=public.submit_decision(m.government_id,'energy-resilience',1,'household-support');
 if e.id<>retry.id or (e.state_after->>'treasury_m_eur')::integer<>10600 then
   raise exception 'SHARED_CABINET_SIMULATION_FAILED'; end if;
end $$;

-- Another party sees the same persisted history and state, not a local copy.
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000010',true);
do $$
declare m record; w jsonb; blocked boolean:=false;
begin
 select * into m from pg_temp.multiplayer_fixture;
 w:=public.get_match_world(m.match_id);
 if (w->'government'->>'treasury_m_eur')::integer<>10600 or
    jsonb_array_length(w->'events')<>1 or
    jsonb_array_length(w->'players')<>10 then
   raise exception 'TEN_PARTY_SHARED_STATE_NOT_PERSISTED'; end if;
 begin perform public.join_match(m.invite_code,'Another Party Name');
 exception when others then blocked:=true; end;
 if blocked then raise exception 'MEMBER_RETRY_FAILED_AFTER_START'; end if;
end $$;

-- A second dossier can fail in Parliament and be proposed anew.
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000001',true);
do $
declare m record; b public.parliament_bills%rowtype;
  n integer; choice text; result public.parliament_bills%rowtype;
begin
  select * into m from pg_temp.multiplayer_fixture;
  b:=public.propose_parliament_bill(m.match_id,'water-security',1,'conserve-reserves');
  for n in 1..10 loop
    perform set_config('request.jwt.claim.sub',
      ('20000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid::text,true);
    choice:=case when n<=3 then 'yes' else 'no' end;
    result:=public.cast_parliament_vote(b.id,choice);
  end loop;
  if result.status<>'rejected' then raise exception 'REJECTED_BILL_NOT_CLOSED'; end if;
  perform set_config('request.jwt.claim.sub',
    '20000000-0000-4000-8000-000000000001',true);
  b:=public.propose_parliament_bill(m.match_id,'water-security',1,'household-efficiency');
  if b.status<>'open' then raise exception 'REPROPOSAL_NOT_ALLOWED'; end if;
  if (select count(*) from public.parliament_bills
      where match_id=m.match_id and dossier_id='water-security')<>2 then
    raise exception 'PARLIAMENT_HISTORY_NOT_DURABLE'; end if;
end $;

-- Direct Data API access stays denied; only authenticated RPCs are public.
do $
begin
  if has_table_privilege('authenticated','public.parliament_bills','SELECT') or
     has_table_privilege('authenticated','public.parliament_votes','SELECT') or
     has_table_privilege('authenticated','public.parliament_votes','INSERT') or
     has_function_privilege('anon','public.cast_parliament_vote(uuid,text)','EXECUTE') or
     not has_function_privilege('authenticated',
       'public.cast_parliament_vote(uuid,text)','EXECUTE') then
    raise exception 'PARLIAMENT_DATA_API_ACCESS_CONTRACT_BROKEN'; end if;
end $;

rollback;