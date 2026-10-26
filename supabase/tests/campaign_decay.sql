-- AOS-048: rollback-only integration for time-decaying campaign persuasion.
-- Uses real authoritative campaign, electoral and opinion-poll functions.
-- Synthetic users, match, dated interventions and polls disappear on ROLLBACK.
begin;

insert into auth.users
 (id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at)
select ('58000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 '00000000-0000-0000-0000-000000000000','authenticated','authenticated',
 'aos48-'||n||'@example.invalid','',now(),now(),now()
from generate_series(1,3) n;

create temporary table campaign_decay_fixture(match_id uuid,invite_code text);
grant select,insert on pg_temp.campaign_decay_fixture to authenticated;
-- The trusted deterministic helper is deliberately not callable by player roles.
do $$
begin
 if game_internal.campaign_effective_influence(
  20::smallint,now()-interval '6 days',(now() at time zone 'UTC')::date)<>20
 or game_internal.campaign_effective_influence(
  20::smallint,now()-interval '8 days',(now() at time zone 'UTC')::date)<>18
 or game_internal.campaign_effective_influence(
  20::smallint,now()-interval '15 days',(now() at time zone 'UTC')::date)<>16
 or game_internal.campaign_effective_influence(
  3::smallint,now()-interval '15 days',(now() at time zone 'UTC')::date)<>0 then
   raise exception 'DECAY_INTEGER_BOUNDARIES_UNSAFE';
 end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','58000000-0000-4000-8000-000000000001',true);
do $$
declare m public.matches%rowtype;
begin
 m:=public.create_match('Decay Electoral Test Nation','Public Cabinet');
 insert into pg_temp.campaign_decay_fixture values(m.id,m.invite_code);
end $$;
select set_config('request.jwt.claim.sub','58000000-0000-4000-8000-000000000002',true);
select public.join_match((select invite_code from pg_temp.campaign_decay_fixture),'Social Opposition');
select set_config('request.jwt.claim.sub','58000000-0000-4000-8000-000000000001',true);
select public.start_match((select match_id from pg_temp.campaign_decay_fixture));

do $$
declare
 mid uuid:=(select match_id from pg_temp.campaign_decay_fixture);
 target text;
 event public.match_campaign_events%rowtype;
 current_state jsonb;
 before_pct numeric; after_pct numeric;
begin
 -- Public status must be based on the current effective score, not historical acts.
 current_state:=public.get_campaign_state(mid);
 target:=current_state->'cohorts'->0->>'code';
 if current_state->>'influenceModel'<>'campaign-decay-v2'
 or current_state->'cohorts'->0->>'myInfluence'<>'0'
 or current_state->'cohorts'->0->'nextDecayOn'<>'null'::jsonb then
   raise exception 'CAMPAIGN_V2_INITIAL_STATE_INVALID';
 end if;
 before_pct:=(select (p->>'voteSharePct')::numeric
   from jsonb_array_elements(public.get_election_state(mid)->'projection'->'parties') p
   where p->>'userId'=auth.uid()::text);
 event:=public.launch_campaign(mid,target,'policy_forum');
 if event.model_version<>'campaign-decay-v2' or
   event.influence_after<>event.influence_delta or
   event.influence_after not between 1 and 5 then
  raise exception 'CAMPAIGN_V2_ACT_NOT_VERSIONED';
 end if;
 current_state:=public.get_campaign_state(mid);
 if current_state->'cohorts'->0->>'myInfluence'<>event.influence_after::text
 or current_state->'cohorts'->0->>'nextDecayOn'<>
   (((now() at time zone 'UTC')::date+7)::text) then
   raise exception 'NEXT_DECAY_NOT_DERIVED_FROM_AUTHORITATIVE_UTC';
 end if;
 after_pct:=(select (p->>'voteSharePct')::numeric
   from jsonb_array_elements(public.get_election_state(mid)->'projection'->'parties') p
   where p->>'userId'=auth.uid()::text);
 if after_pct<=before_pct then raise exception 'DECAY_V2_PERSUASION_NOT_IN_ELECTION'; end if;
 if public.get_election_state(mid)->'projection'->>'modelVersion'<>'electoral-districts-v2'
 or (select sum((p->>'seats')::integer)
     from jsonb_array_elements(public.get_election_state(mid)->'projection'->'parties') p)<>100 then
   raise exception 'ELECTORAL_V2_DISTRICT_CERTIFICATION_DRIFT';
 end if;
end $$;
reset role;

-- Test aging at the trusted database boundary; do not modify real user history.
update public.match_campaign_influence
 set updated_at=now()-interval '8 days'
 where match_id=(select match_id from pg_temp.campaign_decay_fixture)
 and user_id='58000000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub','58000000-0000-4000-8000-000000000001',true);
do $$
declare mid uuid:=(select match_id from pg_temp.campaign_decay_fixture);
 current_state jsonb;
 historical_after integer; effective integer; parties jsonb;
begin
 current_state:=public.get_campaign_state(mid);
 historical_after:=(current_state->'recentActs'->0->>'influence_after')::integer;
 effective:=(current_state->'cohorts'->0->>'myInfluence')::integer;
 if effective<>historical_after-2 or
    (current_state->'cohorts'->0->>'nextDecayOn')::date<>
      ((now() at time zone 'UTC')::date-1+7) then
   raise exception 'CAMPAIGN_INFLUENCE_DID_NOT_DECAY_AFTER_WEEK';
 end if;
 parties:=public.get_election_state(mid)->'projection'->'parties';
 if (select (x->>'campaignInfluenceTotal')::integer
     from jsonb_array_elements(parties) x where x->>'userId'=auth.uid()::text)<>effective then
   raise exception 'ELECTION_AND_CAMPAIGN_SOURCES_DISAGREE';
 end if;
 if historical_after<effective then raise exception 'IMMUTABLE_CAMPAIGN_ACT_DRIFT'; end if;
end $$;
reset role;
update public.match_campaign_influence
 set updated_at=now()-interval '30 days'
 where match_id=(select match_id from pg_temp.campaign_decay_fixture)
 and user_id='58000000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub','58000000-0000-4000-8000-000000000001',true);
do $$
declare mid uuid:=(select match_id from pg_temp.campaign_decay_fixture);
 w jsonb; blocked boolean:=false;
begin
 w:=public.get_campaign_state(mid);
 if (w->'cohorts'->0->>'myInfluence')::integer<>0 or
   w->'cohorts'->0->'nextDecayOn'<>'null'::jsonb then
   raise exception 'PERSUASION_LONG_TERM_ZERO_NOT_ENFORCED';
 end if;
 begin perform public.launch_campaign(mid,w->'recentActs'->0->>'cohort_code','dialogue');
 exception when sqlstate 'P0001' then blocked:=sqlerrm='CAMPAIGN_WEEK_ALREADY_USED'; end;
 if not blocked then raise exception 'WEEKLY_CAP_BYPASSED_AFTER_DECAY'; end if;
end $$;
reset role;

-- Rollback-only fixture move models a return next week; no date injection
-- into production RPCs, no altered history on the hosted game.
update public.match_campaign_events
 set week_start=week_start-7
 where match_id=(select match_id from pg_temp.campaign_decay_fixture)
 and user_id='58000000-0000-4000-8000-000000000001';
-- The synthetic calendar jump also advances the financing entitlement and
-- moves its receipt into the original week. This entire fixture ROLLBACKs.
update public.match_campaign_spending
 set week_start=week_start-7
 where match_id=(select match_id from pg_temp.campaign_decay_fixture)
 and user_id='58000000-0000-4000-8000-000000000001';
update public.matches
 set started_at=started_at-interval '7 days'
 where id=(select match_id from pg_temp.campaign_decay_fixture);
set local role authenticated;
select set_config('request.jwt.claim.sub','58000000-0000-4000-8000-000000000001',true);
do $$
declare mid uuid:=(select match_id from pg_temp.campaign_decay_fixture);
 code text; revived public.match_campaign_events%rowtype;
 old_count integer;
begin
 code:=public.get_campaign_state(mid)->'recentActs'->0->>'cohort_code';
 revived:=public.launch_campaign(mid,code,'field_visit');
 if revived.influence_after<>revived.influence_delta or
   revived.influence_delta not between 1 and 4 then
   raise exception 'NEW_WEEK_RECAPTURE_DID_NOT_START_FROM_DECAYED_ZERO';
 end if;
 old_count:=jsonb_array_length(public.get_campaign_state(mid)->'recentActs');
 if old_count<>2 or
   (select count(*) from jsonb_array_elements(public.get_campaign_state(mid)->'recentActs') x
    where x->>'model_version'='campaign-decay-v2')<>2 then
   raise exception 'PAST_CAMPAIGN_EVENTS_OVERWRITTEN';
 end if;
end $$;
reset role;

-- Capture a real daily poll from the same authoritative district-v2 projection.
do $$
declare mid uuid:=(select match_id from pg_temp.campaign_decay_fixture);
 p public.match_opinion_polls%rowtype; before jsonb;
begin
 if not game_internal.capture_match_opinion_poll(mid) then
   raise exception 'DAILY_POLL_V2_CAPTURE_FAILED'; end if;
 select * into strict p from public.match_opinion_polls where match_id=mid;
 before:=p.projection;
 if p.model_version<>'electoral-districts-v2'
 or p.projection->>'modelVersion'<>'electoral-districts-v2'
 or (select sum((x->>'seats')::integer) from jsonb_array_elements(p.projection->'parties') x)<>100 then
   raise exception 'DAILY_POLL_V2_NOT_AUTHORITATIVE';
 end if;
 if game_internal.capture_match_opinion_poll(mid) then
   raise exception 'DAILY_POLL_V2_NOT_IDEMPOTENT'; end if;
 if (select projection from public.match_opinion_polls where match_id=mid)<>before then
   raise exception 'DAILY_POLL_IMMUTABLE_SNAPSHOT_CHANGED'; end if;
 if has_function_privilege('anon',
    'game_internal.campaign_effective_influence(smallint,timestamptz,date)','EXECUTE')
 or has_table_privilege('authenticated','public.match_campaign_influence','SELECT')
 or has_table_privilege('authenticated','public.match_campaign_events','UPDATE')
 then raise exception 'CAMPAIGN_DECAY_PRIVILEGE_LEAK'; end if;
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub','58000000-0000-4000-8000-000000000003',true);
do $$
declare mid uuid:=(select match_id from pg_temp.campaign_decay_fixture);
 rejected boolean:=false;
begin
 begin perform public.get_campaign_state(mid);
 exception when sqlstate '42501' then rejected:=true; end;
 if not rejected then raise exception 'FOREIGN_MATCH_CAMPAIGN_VISIBLE'; end if;
 rejected:=false;
 begin perform public.get_match_opinion_history(mid,30);
 exception when sqlstate '42501' then rejected:=true; end;
 if not rejected then raise exception 'FOREIGN_MATCH_POLL_VISIBLE'; end if;
end $$;
reset role;
rollback;
