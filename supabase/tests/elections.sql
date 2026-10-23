-- AOS-021: real shared election from 10 authenticated party accounts. Rolled back.
begin;
insert into auth.users
  (id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at)
select ('30000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 '00000000-0000-0000-0000-000000000000','authenticated','authenticated',
 'election-'||n||'@example.invalid','',now(),now(),now()
from generate_series(1,11) n;

create temporary table election_fixture(match_id uuid,government_id uuid,invite_code text);
grant select,insert on pg_temp.election_fixture to authenticated;
set local role authenticated;
select set_config('request.jwt.claim.sub','30000000-0000-4000-8000-000000000001',true);

do $$
declare m public.matches%rowtype; state jsonb; denied boolean:=false;
begin
  m:=public.create_match('Election Lifecycle','Founding Government');
  insert into pg_temp.election_fixture values(m.id,m.government_id,m.invite_code);
  state:=public.get_election_state(m.id);
  if state->>'nextDueOn'<>'null' and state->>'nextDueOn' is not null then
    raise exception 'LOBBY_ELECTION_SCHEDULED'; end if;
  if jsonb_array_length(state->'projection'->'parties')<>1 then
    raise exception 'LOBBY_PROJECTION_INVALID'; end if;
end $$;

do $$
declare f record; p public.match_players%rowtype; n integer;
begin
 select * into f from pg_temp.election_fixture;
 perform set_config('request.jwt.claim.sub','30000000-0000-4000-8000-000000000002',true);
 p:=public.join_match(f.invite_code,'Social Alliance');
 perform public.set_party_manifesto(f.match_id,25);
 if p.seat_no<>2 then raise exception 'SECOND_PARTY_NOT_JOINED'; end if;
 perform set_config('request.jwt.claim.sub','30000000-0000-4000-8000-000000000003',true);
 p:=public.join_match(f.invite_code,'Enterprise Front');
 perform public.set_party_manifesto(f.match_id,75);
 if p.seat_no<>3 then raise exception 'THIRD_PARTY_NOT_JOINED'; end if;
 for n in 4..10 loop
   perform set_config('request.jwt.claim.sub',
     ('30000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid::text,true);
   p:=public.join_match(f.invite_code,'Regional Party '||n);
   perform public.set_party_manifesto(f.match_id,100);
   if p.seat_no<>n then raise exception 'TEN_PARTY_ELECTION_SEATING_FAILED'; end if;
 end loop;
 perform set_config('request.jwt.claim.sub','30000000-0000-4000-8000-000000000001',true);
 perform public.set_party_manifesto(f.match_id,100);
 perform public.start_match(f.match_id);
end $$;

do $$
declare f record; state jsonb; denied boolean:=false;
begin
 select * into f from pg_temp.election_fixture;
 state:=public.get_election_state(f.match_id);
 if state->>'nextDueOn'<>(now() at time zone 'UTC')::date::text and
    (state->>'nextDueOn')::date<>(now() at time zone 'UTC')::date+90 then
   raise exception 'ELECTION_SCHEDULE_WRONG'; end if;
 if state->>'canCertify'<>'false' then raise exception 'PREMATURE_CAN_CERTIFY'; end if;
 if jsonb_array_length(state->'projection'->'parties')<>10 then
   raise exception 'ELECTION_DID_NOT_INCLUDE_TEN_PARTIES'; end if;
 if (state->'projection'->'parties'->0->>'partyName')<>'Social Alliance' then
   raise exception 'ELECTORAL_MODEL_UNEXPECTED_WINNER'; end if;
 if (select sum((x->>'seats')::integer)
     from jsonb_array_elements(state->'projection'->'parties') x)<>100 then
   raise exception 'DHONDT_MANDATE_NOT_100'; end if;
 begin perform public.certify_match_election(f.match_id);
 exception when sqlstate 'P0001' then denied:=sqlerrm='ELECTION_NOT_DUE'; end;
 if not denied then raise exception 'EARLY_ELECTION_ACCEPTED'; end if;
end $$;

-- A synthetic clock shift only inside this test transaction.
reset role;
update public.matches set started_at=now()-interval '91 days'
 where id=(select match_id from pg_temp.election_fixture);
set local role authenticated;
select set_config('request.jwt.claim.sub','30000000-0000-4000-8000-000000000001',true);

do $$
declare f record; denied boolean:=false; e public.match_elections%rowtype;
  state jsonb; m public.matches%rowtype;
begin
 select * into f from pg_temp.election_fixture;
 state:=public.get_election_state(f.match_id);
 if state->>'canCertify'<>'true' then raise exception 'ELECTION_NOT_OPEN_AFTER_90_DAYS'; end if;
 begin perform public.set_party_manifesto(f.match_id,0);
 exception when sqlstate 'P0001' then denied:=sqlerrm='ELECTION_CAMPAIGN_CLOSED'; end;
 if not denied then raise exception 'FROZEN_MANIFESTO_CHANGED'; end if;
 e:=public.certify_match_election(f.match_id);
 if e.election_no<>1 or e.winner_user_id<>
    '30000000-0000-4000-8000-000000000002'::uuid or
    e.incumbent_user_id<>'30000000-0000-4000-8000-000000000001'::uuid then
   raise exception 'PEACEFUL_TRANSFER_INCORRECT'; end if;
 if (public.get_match_world(f.match_id)->'match'->>'host_user_id')::uuid<>e.winner_user_id then
   raise exception 'GOVERNMENT_NOT_TRANSFERRED'; end if;
 if (select sum((p->>'mandate_seats')::integer)
     from jsonb_array_elements(public.get_match_world(f.match_id)->'players') p)<>100 then
   raise exception 'PERSISTED_MANDATES_NOT_100'; end if;
 if jsonb_array_length(public.get_election_state(f.match_id)->'history')<>1 then
   raise exception 'ELECTION_NOT_EXACTLY_ONCE'; end if;
 denied:=false;
 begin perform public.certify_match_election(f.match_id);
 exception when sqlstate 'P0001' then denied:=sqlerrm='ELECTION_NOT_DUE'; end;
 if not denied then raise exception 'DUPLICATE_ELECTION_CERTIFIED'; end if;
end $$;

-- Former premier no longer controls legislation or cabinet decisions.
do $$
declare f record; denied boolean:=false;
begin
 select * into f from pg_temp.election_fixture;
 begin perform public.propose_parliament_bill(
   f.match_id,'energy-resilience',1,'household-support');
 exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'FORMER_PREMIER_PROPOSED_BILL'; end if;
 denied:=false;
 begin perform public.submit_decision(f.government_id,'energy-resilience',1,'household-support');
 exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'FORMER_PREMIER_EXECUTED_CABINET'; end if;
end $$;

-- The winning party can legislate and exercise the original shared engine.
select set_config('request.jwt.claim.sub','30000000-0000-4000-8000-000000000002',true);
do $$
declare f record; b public.parliament_bills%rowtype; e public.decision_events%rowtype;
  state jsonb; my_seats int;
begin
 select * into f from pg_temp.election_fixture;
 state:=public.get_election_state(f.match_id);
 if jsonb_array_length(state->'history')<>1 then
   raise exception 'ELECTION_ACT_NOT_VISIBLE'; end if;
 if (state->'history'->0->>'model_version')<>'electoral-cohorts-v1' then
   raise exception 'ELECTION_MODEL_VERSION_MISSING'; end if;
 select (p->>'mandate_seats')::integer into my_seats
   from jsonb_array_elements(public.get_match_world(f.match_id)->'players') p
   where (p->>'user_id')::uuid=auth.uid();
 if my_seats<=50 then raise exception 'TEST_WINNER_NO_MAJORITY'; end if;
 b:=public.propose_parliament_bill(
   f.match_id,'energy-resilience',1,'household-support');
 b:=public.cast_parliament_vote(b.id,'yes');
 if b.status<>'passed' then raise exception 'WEIGHTED_PARLIAMENT_MAJORITY_FAILED'; end if;
 e:=public.submit_decision(f.government_id,'energy-resilience',1,'household-support');
 if (e.state_after->>'treasury_m_eur')::integer<>10600 then
   raise exception 'ELECTED_CABINET_DECISION_FAILED'; end if;
 if (select (v->>'seat_weight')::integer
     from jsonb_array_elements(public.get_parliament_state(f.match_id)->'votes') v
     where (v->>'bill_id')::uuid=b.id and (v->>'user_id')::uuid=auth.uid())<>my_seats then
   raise exception 'PARLIAMENT_VOTE_WEIGHT_NOT_SNAPSHOTTED'; end if;
end $$;

-- Non-members never see projections or election history.
select set_config('request.jwt.claim.sub','30000000-0000-4000-8000-000000000011',true);
do $$
declare f record; denied boolean:=false;
begin
 select * into f from pg_temp.election_fixture;
 begin perform public.get_election_state(f.match_id);
 exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'ELECTION_FORECAST_LEAK'; end if;
 denied:=false;
 begin perform public.certify_match_election(f.match_id);
 exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'OUTSIDER_CERTIFIED_ELECTION'; end if;
 if has_table_privilege('authenticated','public.match_elections','SELECT') or
    has_table_privilege('authenticated','public.match_elections','INSERT') or
    has_function_privilege('authenticated',
      'public._calculate_election_projection(uuid)','EXECUTE') or
    has_function_privilege('anon','public.certify_match_election(uuid)','EXECUTE') or
    not has_function_privilege('authenticated',
      'public.certify_match_election(uuid)','EXECUTE') then
   raise exception 'ELECTION_ACCESS_CONTRACT_BROKEN'; end if;
end $$;
rollback;
