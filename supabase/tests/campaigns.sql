-- AOS-029: all assertions run on synthetic Auth users and ROLLBACK completely.
begin;
insert into auth.users
  (id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at)
select ('33000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 '00000000-0000-0000-0000-000000000000','authenticated','authenticated',
 'campaign-'||n||'@example.invalid','',now(),now(),now()
from generate_series(1,3) n;

create temporary table campaign_fixture(match_id uuid,invite_code text,government_id uuid);
grant select,insert on pg_temp.campaign_fixture to authenticated;
set local role authenticated;
select set_config('request.jwt.claim.sub','33000000-0000-4000-8000-000000000001',true);

do $$
declare m public.matches%rowtype; state jsonb;
begin
 m:=public.create_match('Campaign Integrity Match','National Alliance');
 insert into pg_temp.campaign_fixture values(m.id,m.invite_code,m.government_id);
 state:=public.get_campaign_state(m.id);
 if state->>'available'<>'false' or state->>'usedThisWeek'<>'false' then
   raise exception 'CAMPAIGN_INCORRECT_LOBBY_STATE'; end if;
end $$;

do $$
declare f record; m public.matches%rowtype;
begin
 select * into f from pg_temp.campaign_fixture;
 perform set_config('request.jwt.claim.sub','33000000-0000-4000-8000-000000000002',true);
 perform public.join_match(f.invite_code,'Social Reform');
 perform set_config('request.jwt.claim.sub','33000000-0000-4000-8000-000000000001',true);
 m:=public.start_match(f.match_id);
 if m.status<>'active' then raise exception 'MATCH_START_FAILED'; end if;
end $$;

do $$
declare
 f record; b jsonb; a jsonb; s jsonb;
 original public.match_campaign_events%rowtype;
 repeated public.match_campaign_events%rowtype;
 original_share numeric; resulting_share numeric;
 target text; expected integer; others integer;
 blocked boolean:=false;
begin
 select * into f from pg_temp.campaign_fixture;
 b:=public.get_election_state(f.match_id);
 s:=public.get_campaign_state(f.match_id);
 if s->>'available'<>'true' then raise exception 'CAMPAIGN_NOT_AVAILABLE'; end if;
 if jsonb_array_length(s->'cohorts')<>2 then
   raise exception 'CAMPAIGN_WRONG_COHORT_COUNT'; end if;
 target:=s->'cohorts'->0->>'code';
 original_share:=(select (x->>'voteSharePct')::numeric
   from jsonb_array_elements(b->'projection'->'parties') x
   where x->>'userId'='33000000-0000-4000-8000-000000000001');
 original:=public.launch_campaign(f.match_id,target,'policy_forum');
 repeated:=public.launch_campaign(f.match_id,target,'policy_forum');
 if original.id<>repeated.id then raise exception 'CAMPAIGN_NOT_IDEMPOTENT'; end if;
 if original.influence_delta<1 or original.influence_delta>5 or
     original.influence_after<>original.influence_delta then
   raise exception 'CAMPAIGN_IMPACT_OUT_OF_RANGE'; end if;
 if original.model_version<>'campaign-outreach-v1' then
   raise exception 'CAMPAIGN_UNVERSIONED'; end if;
 select jsonb_array_length(public.get_campaign_state(f.match_id)->'recentActs') into others;
 if others<>1 then raise exception 'CAMPAIGN_DUPLICATE_EVENT'; end if;
 begin
   perform public.launch_campaign(f.match_id,target,'dialogue');
 exception when sqlstate 'P0001' then blocked:=true;
 end;
 if not blocked then raise exception 'CAMPAIGN_WEEKLY_QUOTA_BYPASSED'; end if;
 s:=public.get_campaign_state(f.match_id);
 if s->>'available'<>'false' or s->>'usedThisWeek'<>'true' then
   raise exception 'CAMPAIGN_WRONG_LOCK_STATE'; end if;
 if (select count(*) from jsonb_array_elements(s->'recentActs'))<>1 then
   raise exception 'CAMPAIGN_HISTORY_MISSING'; end if;
 a:=public.get_election_state(f.match_id);
 if a->'projection'->>'modelVersion'<>'electoral-households-v1' then
   raise exception 'ELECTION_VERSION_STALE'; end if;
 resulting_share:=(select (x->>'voteSharePct')::numeric
   from jsonb_array_elements(a->'projection'->'parties') x
   where x->>'userId'='33000000-0000-4000-8000-000000000001');
 if resulting_share<=original_share then
   raise exception 'CAMPAIGN_DID_NOT_CHANGE_REAL_ELECTION' using detail=
     original_share||' -> '||resulting_share; end if;
 if (select sum((x->>'seats')::integer)
      from jsonb_array_elements(a->'projection'->'parties') x)<>100 then
   raise exception 'CAMPAIGN_BROKE_SEAT_ALLOCATION'; end if;
end $$;

do $$
declare f record; denied boolean:=false; invalid boolean:=false;
begin
 select * into f from pg_temp.campaign_fixture;
 perform set_config('request.jwt.claim.sub','33000000-0000-4000-8000-000000000003',true);
 begin perform public.get_campaign_state(f.match_id);
 exception when sqlstate '42501' then denied:=true; end;
 if not denied then raise exception 'CAMPAIGN_OUTSIDER_READ'; end if;
 denied:=false;
 begin perform public.launch_campaign(f.match_id,'workers','dialogue');
 exception when sqlstate '42501' then denied:=true; end;
 if not denied then raise exception 'CAMPAIGN_OUTSIDER_WRITE'; end if;
 perform set_config('request.jwt.claim.sub','33000000-0000-4000-8000-000000000002',true);
 begin perform public.launch_campaign(f.match_id,'invalid-cohort','dialogue');
 exception when sqlstate 'P0001' then invalid:=true; end;
 if not invalid then raise exception 'CAMPAIGN_BAD_COHORT_ACCEPTED'; end if;
 invalid:=false;
 begin perform public.launch_campaign(f.match_id,
   (public.get_campaign_state(f.match_id)->'cohorts'->0->>'code'),
   'forged-client-value');
 exception when sqlstate 'P0001' then invalid:=true; end;
 if not invalid then raise exception 'CAMPAIGN_BAD_STRATEGY_ACCEPTED'; end if;
 if jsonb_array_length(public.get_campaign_state(f.match_id)->'recentActs')<>1 then
   raise exception 'CAMPAIGN_INVALID_OPERATION_MUTATED'; end if;
end $$;

-- Move the test match into the seven-day election freeze (only synthetic data).
reset role;
update public.matches set started_at=now()-interval '85 days'
where id=(select match_id from pg_temp.campaign_fixture);
set local role authenticated;
select set_config('request.jwt.claim.sub','33000000-0000-4000-8000-000000000002',true);
do $$
declare f record; denied boolean:=false; s jsonb;
begin
 select * into f from pg_temp.campaign_fixture;
 s:=public.get_campaign_state(f.match_id);
 if s->>'available'<>'false' then raise exception 'CAMPAIGN_FREEZE_VISIBLE_AS_OPEN'; end if;
 begin
   perform public.launch_campaign(f.match_id,
     (public.get_campaign_state(f.match_id)->'cohorts'->0->>'code'),
     'dialogue');
 exception when sqlstate 'P0001' then denied:=true; end;
 if not denied then raise exception 'CAMPAIGN_FREEZE_BYPASSED'; end if;
end $$;
reset role;
rollback;
