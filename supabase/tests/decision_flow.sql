-- Execute only in an isolated ACT OF STATE test DB. Changes are rolled back.
begin;
insert into auth.users
 (id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at)
values
 ('10000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000',
  'authenticated','authenticated','aos-one@example.invalid','',now(),now(),now()),
 ('10000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000',
  'authenticated','authenticated','aos-two@example.invalid','',now(),now(),now());
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
do $$
declare g public.governments%rowtype; g2 public.governments%rowtype;
 ev public.decision_events%rowtype; ev2 public.decision_events%rowtype;
 funds integer; caught boolean;
begin
 g:=public.start_government();
 g2:=public.start_government();
 if g.id<>g2.id then raise exception 'SESSION_RESUME_FAILED'; end if;
 if (select count(*) from public.population_cohorts where government_id=g.id)<>2 then
  raise exception 'COHORT_SEED_FAILED'; end if;
 if not exists(select 1 from public.dossiers where id='energy-resilience' and version=1) then
  raise exception 'DOSSIER_LOOKUP_FAILED'; end if;
 if public.get_game_day()<>(now() at time zone 'UTC')::date then
  raise exception 'SERVER_DAY_MISMATCH'; end if;
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
 if jsonb_array_length(ev.cohort_effects)<>2 then
  raise exception 'MISSING_COHORT_EFFECTS'; end if;
 if (select count(*) from public.decision_events where government_id=g.id)<>1 then
  raise exception 'BAD_HISTORY'; end if;
 caught:=false;
 begin perform public.submit_decision(g.id,'energy-resilience',1,'industry-investment');
 exception when sqlstate 'P0001' then caught:=true; end;
 if not caught then raise exception 'CONFLICTING_RETRY_ACCEPTED'; end if;
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
 raise notice 'AOS transactional integration tests passed';
end $$;
rollback;