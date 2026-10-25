-- AOS-043: full ten-decision real-engine campaign, rollback-only SQL integration.
-- Run only in disposable ACT OF STATE test DB, never with live users.
begin;
insert into auth.users
 (id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at)
values
 ('43000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000',
  'authenticated','authenticated','foundation-one@example.invalid','',now(),now(),now()),
 ('43000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000',
  'authenticated','authenticated','foundation-two@example.invalid','',now(),now(),now());

set local role authenticated;
select set_config('request.jwt.claim.sub','43000000-0000-4000-8000-000000000001',true);
do $$
declare
 v_government public.governments%rowtype;
 v_next record;
 v_event public.decision_events%rowtype;
 v_retry public.decision_events%rowtype;
 v_world jsonb;
 v_total_cost integer := 0;
 v_count integer := 0;
 v_before integer;
 v_denied boolean := false;
begin
 v_government := public.start_government();
 v_world := public.get_government_world(v_government.id);
 if (select count(*) from public.dossiers where release_kind='intro' and version=1)<>10 then
  raise exception 'FOUNDATIONAL_DOSSIER_COUNT_INCORRECT'; end if;
 if (select count(*) from public.dossier_options o join public.dossiers d
      on d.id=o.dossier_id and d.version=o.dossier_version
      where d.release_kind='intro' and d.version=1)<>30 then
  raise exception 'FOUNDATIONAL_OPTIONS_COUNT_INCORRECT'; end if;
 if jsonb_array_length(v_world->'dossiers')<>10 or
    jsonb_array_length(v_world->'options')<>30 then
  raise exception 'FOUNDATIONAL_DOSSIERS_NOT_IN_SNAPSHOT'; end if;
 if (select count(distinct category) from public.dossiers
     where release_kind='intro' and version=1)<>10 then
  raise exception 'FOUNDATIONAL_POLICY_COVERAGE_INCOMPLETE'; end if;
 -- Policy costs are bounded by the original 12,000 M€ treasury even when
 -- every most-expensive alternative is signed in one session.
 for v_next in
  select d.id, o.id as option_id, o.treasury_delta_m_eur as cost
  from public.dossiers d
  cross join lateral (
   select id,treasury_delta_m_eur from public.dossier_options
   where dossier_id=d.id and dossier_version=d.version
   order by treasury_delta_m_eur,id limit 1
  ) o
  where d.release_kind='intro' and d.version=1 order by d.id
 loop
  v_before := (select treasury_m_eur from public.governments
               where id=v_government.id);
  v_event := public.submit_decision(v_government.id,v_next.id,1,v_next.option_id);
  v_retry := public.submit_decision(v_government.id,v_next.id,1,v_next.option_id);
  if v_retry.id<>v_event.id or v_retry.state_after<>v_event.state_after or
     v_event.dossier_title_snapshot is null or v_event.option_title_snapshot is null or
     v_event.engine_version is null or
     (v_event.state_after->>'treasury_m_eur')::integer<>v_before+v_next.cost then
   raise exception 'FOUNDATIONAL_AUTHORITATIVE_RESULT_INVALID_%',v_next.id;
  end if;
  v_total_cost := v_total_cost + v_next.cost;
  v_count := v_count+1;
 end loop;
 if v_count<>10 or v_total_cost<>-8860 or
   (select treasury_m_eur from public.governments where id=v_government.id)<>3140 then
  raise exception 'FOUNDATIONAL_WORST_CASE_FISCAL_INVARIANT'; end if;
 v_world:=public.get_government_world(v_government.id);
 if jsonb_array_length(v_world->'events')<>10 or
   (select count(*) from public.decision_events where government_id=v_government.id)<>10 then
  raise exception 'FOUNDATIONAL_CAMPAIGN_NOT_PERSISTED'; end if;
 begin
  perform public.submit_decision(v_government.id,'housing-access',1,'permit-reform');
 exception when sqlstate 'P0001' then v_denied:=sqlerrm='DOSSIER_ALREADY_DECIDED'; end;
 if not v_denied then raise exception 'FOUNDATIONAL_CONFLICTING_RETRY_ACCEPTED'; end if;
 if (select count(*) from public.decision_events where government_id=v_government.id)<>10 then
  raise exception 'FOUNDATIONAL_CONFLICTING_RETRY_MUTATED_HISTORY'; end if;
 -- A second account cannot observe, alter or duplicate the first mandate.
 perform set_config('request.jwt.claim.sub','43000000-0000-4000-8000-000000000002',true);
 if public.get_government_world(v_government.id) is not null then
  raise exception 'FOUNDATIONAL_CROSS_ACCOUNT_READ'; end if;
 v_denied:=false;
 begin
  perform public.submit_decision(v_government.id,'housing-access',1,'public-housing');
 exception when insufficient_privilege then v_denied:=true; end;
 if not v_denied then raise exception 'FOUNDATIONAL_CROSS_ACCOUNT_WRITE'; end if;
 v_event:=public.submit_decision(public.start_government().id,'housing-access',1,'public-housing');
 if v_event.government_id=v_government.id or
    (select count(*) from public.decision_events where government_id=v_government.id)<>10 then
  raise exception 'FOUNDATIONAL_NEW_OWNER_ISOLATION'; end if;
end $$;
rollback;
