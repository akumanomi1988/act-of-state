-- Execute only in an isolated ACT OF STATE test DB. Changes are rolled back.
begin;
insert into auth.users
 (id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at)
values
 ('10000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000',
  'authenticated','authenticated','aos-one@example.invalid','',now(),now(),now()),
 ('10000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000',
  'authenticated','authenticated','aos-two@example.invalid','',now(),now(),now());
-- A second editorial version must NOT create a new logical decision slot.
insert into public.dossiers(id,version,title,context,category,release_kind)
select id,2,title,context,category,release_kind
from public.dossiers where id='energy-resilience';
insert into public.dossier_options
 (dossier_id,dossier_version,id,title,description,treasury_delta_m_eur,
  policy_target,response_intensity,trust_base_delta)
select dossier_id,2,id,title,description,treasury_delta_m_eur,
 policy_target,response_intensity,trust_base_delta
from public.dossier_options where dossier_id='energy-resilience' and dossier_version=1;
-- A second fictional dossier exercises cumulative decisions and insufficient funds.
insert into public.dossiers(id,version,title,context,category,release_kind)
values('sequence-stress',1,'Cumulative policy stress','Rollback-only fixture',
 'Economy','intro');
insert into public.dossier_options
 (dossier_id,dossier_version,id,title,description,treasury_delta_m_eur,
  policy_target,response_intensity,trust_base_delta)
values
 ('sequence-stress',1,'over-budget','Unaffordable policy','Must fail atomically',
  -12000,50,0,0),
 ('sequence-stress',1,'moderate-investment','Moderate policy','Second valid transition',
  -300,50,40,1);
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
do $$
declare g public.governments%rowtype; g2 public.governments%rowtype;
 ev public.decision_events%rowtype; ev2 public.decision_events%rowtype;
 funds integer; caught boolean;
 seq_event public.decision_events%rowtype; seq_retry public.decision_events%rowtype;
 cohort_before_failure jsonb; world_snapshot jsonb;
begin
 g:=public.start_government();
 g2:=public.start_government();
 if g.id<>g2.id then raise exception 'SESSION_RESUME_FAILED'; end if;
 if (select count(*) from public.population_cohorts where government_id=g.id)<>2 then
  raise exception 'COHORT_SEED_FAILED'; end if;
 if not exists(select 1 from public.dossiers where id='energy-resilience' and version=1) then
  raise exception 'DOSSIER_LOOKUP_FAILED'; end if;
 if not exists(select 1 from public.dossiers where id='water-security' and version=1) or
    (select count(*) from public.dossier_options where dossier_id='water-security' and dossier_version=1)<>3 then
  raise exception 'SECOND_EDITORIAL_DOSSIER_MISSING'; end if;
 if public.get_game_day()<>(now() at time zone 'UTC')::date then
  raise exception 'SERVER_DAY_MISMATCH'; end if;
 -- Weekly embargo/approval assertions live in weekly_release.sql.
 funds:=g.treasury_m_eur;
 caught:=false;
 begin
  perform public.submit_decision(g.id,'energy-resilience',1,'invalid-option');
 exception when sqlstate 'P0001' then caught:=true; end;
 if not caught then raise exception 'INVALID_CHOICE_ACCEPTED'; end if;
 if (select treasury_m_eur from public.governments where id=g.id)<>funds then
  raise exception 'INVALID_CHOICE_CHANGED_TREASURY'; end if;
 ev:=public.submit_decision(g.id,'energy-resilience',1,'household-support');
 ev2:=public.submit_decision(g.id,'energy-resilience',1,'household-support');
 if ev.id<>ev2.id or ev.state_after<>ev2.state_after then
  raise exception 'DUPLICATE_APPLIED'; end if;
 if (select treasury_m_eur from public.governments where id=g.id)<>funds-1400 then
  raise exception 'BAD_TREASURY_CHANGE'; end if;
 if (ev.state_after->>'approval')::int <> 62 or
    (ev.state_after->>'trust')::int <> 58 then
  raise exception 'INVALID_DETERMINISTIC_NATIONAL_STATE'; end if;
 if ev.parameters_snapshot <> jsonb_build_object(
     'treasury_delta_m_eur', -1400,
     'policy_target', 25, 'response_intensity', 35,
     'trust_base_delta', 2) then
  raise exception 'PARAMETERS_SNAPSHOT_MISSING_OR_INCORRECT'; end if;
 if (ev.cohort_effects->0->>'code') <> 'households' or
    (ev.cohort_effects->0->>'support_after')::int <> 68 or
    (ev.cohort_effects->0->>'trust_after')::int <> 61 or
    (ev.cohort_effects->1->>'code') <> 'industry' or
    (ev.cohort_effects->1->>'support_after')::int <> 50 or
    (ev.cohort_effects->1->>'trust_after')::int <> 52 then
  raise exception 'COHORT_RESPONSE_DRIFT'; end if;
 if jsonb_array_length(ev.cohort_effects)<>2 then
  raise exception 'MISSING_COHORT_EFFECTS'; end if;
 if (select count(*) from public.decision_events where government_id=g.id)<>1 then
  raise exception 'BAD_HISTORY'; end if;
 caught:=false;
 begin perform public.submit_decision(g.id,'energy-resilience',1,'industry-investment');
 exception when sqlstate 'P0001' then caught:=true; end;
 if not caught then raise exception 'CONFLICTING_RETRY_ACCEPTED'; end if;
 caught:=false;
 begin perform public.submit_decision(g.id,'energy-resilience',2,'household-support');
 exception when sqlstate 'P0001' then caught:=true; end;
 if not caught then raise exception 'VERSION_REPLAY_ACCEPTED'; end if;
 if (select count(*) from public.decision_events where government_id=g.id)<>1
    or (select treasury_m_eur from public.governments where id=g.id)<>funds-1400 then
  raise exception 'VERSION_REPLAY_MUTATED_STATE'; end if;
 -- A failed expensive decision must leave government, cohorts and history intact.
 select jsonb_agg(to_jsonb(c) order by c.code) into cohort_before_failure
 from public.population_cohorts c where c.government_id=g.id;
 caught:=false;
 begin
  perform public.submit_decision(g.id,'sequence-stress',1,'over-budget');
 exception when sqlstate 'P0001' then
  caught := sqlerrm='INSUFFICIENT_TREASURY';
 end;
 if not caught then raise exception 'INSUFFICIENT_TREASURY_NOT_REJECTED'; end if;
 if (select treasury_m_eur from public.governments where id=g.id)<>10600
  or (select approval from public.governments where id=g.id)<>62
  or (select trust from public.governments where id=g.id)<>58
  or (select count(*) from public.decision_events where government_id=g.id)<>1 then
  raise exception 'INSUFFICIENT_TREASURY_CHANGED_NATIONAL_STATE';
 end if;
 if (select jsonb_agg(to_jsonb(c) order by c.code)
     from public.population_cohorts c where c.government_id=g.id)
    <>cohort_before_failure then
  raise exception 'INSUFFICIENT_TREASURY_CHANGED_COHORTS';
 end if;
 -- A different dossier must compound its effects on the first decision.
 seq_event:=public.submit_decision(g.id,'water-security',1,'industrial-reuse');
 if seq_event.state_before<>ev.state_after or
    (seq_event.state_after->>'treasury_m_eur')::int<>9650 or
    (seq_event.state_after->>'approval')::int<>67 or
    (seq_event.state_after->>'trust')::int<>61 then
  raise exception 'CUMULATIVE_DECISION_STATE_DRIFT';
 end if;
 if (seq_event.cohort_effects->0->>'support_after')::int<>68 or
    (seq_event.cohort_effects->0->>'trust_after')::int<>61 or
    (seq_event.cohort_effects->1->>'support_after')::int<>65 or
    (seq_event.cohort_effects->1->>'trust_after')::int<>60 then
  raise exception 'CUMULATIVE_COHORT_RESPONSE_DRIFT';
 end if;
 seq_retry:=public.submit_decision(g.id,'water-security',1,'industrial-reuse');
 if seq_retry.id<>seq_event.id or
    (select count(*) from public.decision_events where government_id=g.id)<>2 then
  raise exception 'CUMULATIVE_DECISION_RETRY_DUPLICATED';
 end if;
 world_snapshot:=public.get_government_world(g.id);
 if jsonb_array_length(world_snapshot->'events')<>2 or
    (world_snapshot->'government'->>'treasury_m_eur')::int<>9650 then
  raise exception 'CUMULATIVE_HISTORY_SNAPSHOT_DRIFT';
 end if;
 caught:=false;
 begin
  update public.governments set treasury_m_eur=99999 where id=g.id;
 exception when insufficient_privilege then caught:=true; end;
 if not caught then raise exception 'UNAUTHORIZED_DIRECT_WRITE_ACCEPTED'; end if;
 perform set_config('request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000002',true);
 caught:=false;
 begin perform public.submit_decision(g.id,'energy-resilience',1,'household-support');
 exception when insufficient_privilege then caught:=true; end;
 if not caught then raise exception 'UNAUTHORIZED_DECISION_ACCEPTED'; end if;
 if exists(select 1 from public.governments where id=g.id) then
  raise exception 'GOVERNMENT_RLS_BROKEN'; end if;
 if exists(select 1 from public.decision_events where government_id=g.id) then
  raise exception 'DECISION_RLS_BROKEN'; end if;
 g2:=public.start_government();
 ev2:=public.submit_decision(g2.id,'energy-resilience',1,'household-support');
 if ev2.state_after<>ev.state_after or ev2.cohort_effects<>ev.cohort_effects then
  raise exception 'DETERMINISM_ACROSS_GOVERNMENTS_FAILED'; end if;
 perform set_config('request.jwt.claim.sub','',true);
 caught:=false;
 begin perform public.start_government();
 exception when insufficient_privilege then caught:=true; end;
 if not caught then raise exception 'NULL_IDENTITY_ACCEPTED'; end if;
 raise notice 'AOS transactional integration tests passed';
end $$;
rollback;