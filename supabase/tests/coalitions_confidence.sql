-- AOS-025 integration acceptance: one shared 4-party nation and real DB locks.
-- The fixture is synthetic and is rolled back; no production accounts remain.
begin;
insert into auth.users
(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at)
select ('50000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
  '00000000-0000-0000-0000-000000000000',
  'authenticated','authenticated','confidence-'||n||'@example.invalid',
  '',now(),now(),now()
from generate_series(1,5) n;
create temporary table governance_fixture (match_id uuid, government_id uuid, invite_code text);
grant select,insert on pg_temp.governance_fixture to authenticated;
set local role authenticated;
select set_config('request.jwt.claim.sub','50000000-0000-4000-8000-000000000001',true);
do $$
declare m public.matches%rowtype;
begin
  m:=public.create_match('Confidence & Coalition Test','Institutional Founders');
  insert into pg_temp.governance_fixture values(m.id,m.government_id,m.invite_code);
end $$;
do $$
declare f record; n integer;
begin
  select * into f from pg_temp.governance_fixture;
  for n in 2..4 loop
    perform set_config('request.jwt.claim.sub',
      ('50000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid::text,true);
    perform public.join_match(f.invite_code,'Party No '||n);
  end loop;
  perform set_config('request.jwt.claim.sub','50000000-0000-4000-8000-000000000001',true);
  perform public.start_match(f.match_id);
end $$;

-- Coalition: invitation restricted to cabinet, acceptance restricted to invited.
do $$
declare f record; row1 public.match_coalition_members%rowtype;
  denied boolean; state jsonb;
begin
  select * into f from pg_temp.governance_fixture;
  row1:=public.invite_coalition_partner(f.match_id,
    '50000000-0000-4000-8000-000000000002');
  if row1.status<>'invited' then raise exception 'COALITION_INVITATION_FAILED'; end if;
  if (public.invite_coalition_partner(f.match_id,
    '50000000-0000-4000-8000-000000000002')).status<>'invited' then
    raise exception 'COALITION_DUPLICATE_CHANGED_STATE'; end if;
  denied:=false;
  begin perform public.invite_coalition_partner(f.match_id,
    '50000000-0000-4000-8000-000000000001');
  exception when sqlstate 'P0001' then denied:=sqlerrm='COALITION_INVALID_PARTNER'; end;
  if not denied then raise exception 'SELF_COALITION_ACCEPTED'; end if;
  perform set_config('request.jwt.claim.sub','50000000-0000-4000-8000-000000000003',true);
  denied:=false;
  begin perform public.respond_coalition_invite(f.match_id,true);
  exception when sqlstate 'P0001' then denied:=sqlerrm='COALITION_NOT_INVITED'; end;
  if not denied then raise exception 'UNINVITED_JOIN_ACCEPTED'; end if;
  denied:=false;
  begin perform public.invite_coalition_partner(f.match_id,
    '50000000-0000-4000-8000-000000000004');
  exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'OPPOSITION_INVITED_WITHOUT_AUTHORITY'; end if;
  perform set_config('request.jwt.claim.sub','50000000-0000-4000-8000-000000000002',true);
  row1:=public.respond_coalition_invite(f.match_id,true);
  if row1.status<>'accepted' or (public.respond_coalition_invite(f.match_id,true)).status<>'accepted' then
    raise exception 'COALITION_ACCEPT_RETRY_FAILED'; end if;
  state:=public.get_governance_state(f.match_id);
  if (state->>'coalitionSeats')::integer<>20 or
    jsonb_array_length(state->'coalition')<>1 then
    raise exception 'COALITION_SEATS_WRONG'; end if;
end $$;

-- Constructive motion: irrevocable weighted ballots, strict 50%+ majority.
do $$
declare f record; m public.match_confidence_motions%rowtype;
  denied boolean; old government uuid;
begin
  select * into f from pg_temp.governance_fixture;
  perform set_config('request.jwt.claim.sub','50000000-0000-4000-8000-000000000003',true);
  m:=public.propose_confidence_motion(f.match_id,'50000000-0000-4000-8000-000000000002');
  if (public.propose_confidence_motion(f.match_id,
    '50000000-0000-4000-8000-000000000002')).id<>m.id then
    raise exception 'CONFIDENCE_RETRY_NEW_MOTION'; end if;
  denied:=false;
  begin perform public.propose_confidence_motion(f.match_id,
    '50000000-0000-4000-8000-000000000004');
  exception when sqlstate 'P0001' then denied:=sqlerrm='CONFIDENCE_ALREADY_OPEN'; end;
  if not denied then raise exception 'OVERLAPPING_CONFIDENCE_ALLOWED'; end if;
  perform set_config('request.jwt.claim.sub','50000000-0000-4000-8000-000000000001',true);
  if (public.cast_confidence_vote(m.id,'no')).status<>'open' then
    raise exception 'PREMATURE_CONFIDENCE_CLOSED'; end if;
  perform set_config('request.jwt.claim.sub','50000000-0000-4000-8000-000000000003',true);
  perform public.cast_confidence_vote(m.id,'yes');
  if (public.cast_confidence_vote(m.id,'yes')).status<>'open' then
    raise exception 'CONFIDENCE_RETRY_CHANGED_RESULT'; end if;
  denied:=false;
  begin perform public.cast_confidence_vote(m.id,'no');
  exception when sqlstate 'P0001' then denied:=sqlerrm='CONFIDENCE_VOTE_LOCKED'; end;
  if not denied then raise exception 'CONFIDENCE_BALLOT_CHANGED'; end if;
  perform set_config('request.jwt.claim.sub','50000000-0000-4000-8000-000000000004',true);
  perform public.cast_confidence_vote(m.id,'yes');
  perform set_config('request.jwt.claim.sub','50000000-0000-4000-8000-000000000002',true);
  if (public.cast_confidence_vote(m.id,'yes')).status<>'passed' then
    raise exception 'CONSTRUCTIVE_CONFIDENCE_NOT_PASSED'; end if;
  if (select host_user_id from public.matches where id=f.match_id)<>
     '50000000-0000-4000-8000-000000000002'::uuid then
    raise exception 'CONFIDENCE_DID_NOT_TRANSFER_CABINET'; end if;
  if (select count(*) from public.match_confidence_votes
    where motion_id=m.id)<>4 then
    raise exception 'CONFIDENCE_BALLOT_DUPLICATED'; end if;
  if (public.get_governance_state(f.match_id)->>'coalitionSeats')::integer<>10 then
    raise exception 'PREVIOUS_CABINET_COALITION_STILL_ACTIVE'; end if;
  denied:=false;
  begin perform public.cast_confidence_vote(m.id,'abstain');
  exception when sqlstate 'P0001' then denied:=sqlerrm='CONFIDENCE_VOTE_LOCKED'; end;
  if not denied then raise exception 'RESOLVED_BALLOT_MUTATED'; end if;
  perform set_config('request.jwt.claim.sub','50000000-0000-4000-8000-000000000001',true);
  denied:=false;
  begin perform public.propose_parliament_bill(
    f.match_id,'energy-resilience',1,'household-support');
  exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'FORMER_GOVERNMENT_STILL_PROPOSES'; end if;
  perform set_config('request.jwt.claim.sub','50000000-0000-4000-8000-000000000002',true);
  if (public.invite_coalition_partner(f.match_id,
      '50000000-0000-4000-8000-000000000003')).leader_id<>
      '50000000-0000-4000-8000-000000000002'::uuid then
    raise exception 'NEW_CABINET_CANNOT_FORM_COALITION'; end if;
end $$;

-- Rejected motion after all ballots cannot overthrow the cabinet.
do $$
declare f record; m public.match_confidence_motions%rowtype; n integer;
begin
  select * into f from pg_temp.governance_fixture;
  perform set_config('request.jwt.claim.sub','50000000-0000-4000-8000-000000000004',true);
  m:=public.propose_confidence_motion(f.match_id,'50000000-0000-4000-8000-000000000003');
  perform public.cast_confidence_vote(m.id,'yes');
  for n in 1..3 loop
    perform set_config('request.jwt.claim.sub',
      ('50000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid::text,true);
    perform public.cast_confidence_vote(m.id,'no');
  end loop;
  if (select status from public.match_confidence_motions where id=m.id)<>'rejected' or
     (select host_user_id from public.matches where id=f.match_id)<>
       '50000000-0000-4000-8000-000000000002'::uuid then
    raise exception 'FAILED_MOTION_TRANSFERRED_POWER'; end if;
end $$;

-- Expired motions are settled by the actual calendar worker, no browser call.
do $$
declare f record; m public.match_confidence_motions%rowtype;
begin
  select * into f from pg_temp.governance_fixture;
  perform set_config('request.jwt.claim.sub','50000000-0000-4000-8000-000000000003',true);
  m:=public.propose_confidence_motion(f.match_id,'50000000-0000-4000-8000-000000000004');
  perform public.cast_confidence_vote(m.id,'yes');
end $$;
reset role;
update public.match_confidence_motions
set closes_at=now()-interval '2 minutes',created_at=now()-interval '26 hours'
where status='open' and match_id=(select match_id from pg_temp.governance_fixture);
do $$
declare f record; result jsonb;
begin
  select * into f from pg_temp.governance_fixture;
  result:=game_internal.process_calendar();
  if (result->>'confidenceClosures')::integer<>1
    or (result->>'confidenceErrors')::integer<>0
    or (select count(*) from public.match_confidence_motions
       where match_id=f.match_id and status='open')<>0 then
    raise exception 'CONFIDENCE_CALENDAR_NOT_SETTLED: %',result; end if;
  result:=game_internal.process_calendar();
  if (result->>'confidenceClosures')::integer<>0 then
    raise exception 'CONFIDENCE_CALENDAR_NOT_IDEMPOTENT'; end if;
end $$;
set local role authenticated;

-- An outsider cannot see/write negotiation, submit motions or participate.
select set_config('request.jwt.claim.sub','50000000-0000-4000-8000-000000000005',true);
do $$
declare f record; denied boolean; m uuid;
begin
  select * into f from pg_temp.governance_fixture;
  denied:=false;
  begin perform public.get_governance_state(f.match_id);
  exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'GOVERNANCE_DATA_LEAK'; end if;
  denied:=false;
  begin perform public.propose_confidence_motion(
      f.match_id,'50000000-0000-4000-8000-000000000003');
  exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'OUTSIDER_COULD_CENSURE'; end if;
  select id into m from public.match_confidence_motions limit 1;
  denied:=false;
  begin perform public.cast_confidence_vote(m,'yes');
  exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'OUTSIDER_VOTE_ACCEPTED'; end if;
  if has_table_privilege('authenticated','public.match_coalition_members','SELECT') or
    has_table_privilege('authenticated','public.match_confidence_motions','INSERT') or
    has_table_privilege('authenticated','public.match_confidence_votes','SELECT') or
    has_function_privilege('anon','public.propose_confidence_motion(uuid,uuid)','EXECUTE') or
    has_function_privilege('authenticated','game_internal.finalize_confidence_motion(uuid)','EXECUTE') or
    not has_function_privilege('authenticated','public.get_governance_state(uuid)','EXECUTE') then
    raise exception 'GOVERNANCE_GRANT_OR_RLS_FAILURE'; end if;
end $$;
rollback;
