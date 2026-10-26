-- End-to-end weekly publication gate. All fixtures are rolled back.
begin;
insert into auth.users
 (id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at)
values
 ('10000000-0000-4000-8000-000000000071','00000000-0000-0000-0000-000000000000',
  'authenticated','authenticated','weekly-one@example.invalid','',now(),now(),now()),
 ('10000000-0000-4000-8000-000000000072','00000000-0000-0000-0000-000000000000',
  'authenticated','authenticated','weekly-two@example.invalid','',now(),now(),now());
create temporary table test_calendar_dates as
select ((now() at time zone 'UTC')::date -
       (extract(isodow from (now() at time zone 'UTC')::date)::integer-1))::date as monday;
grant select on pg_temp.test_calendar_dates to authenticated,service_role;
insert into public.weekly_releases(week_start)
select monday from test_calendar_dates
union all select monday+7 from test_calendar_dates;

-- Source URLs deliberately use a non-resolving test domain, not real news.
insert into public.dossiers
 (id,version,title,context,category,release_kind,available_from,
  source_url,source_title,source_published_at)
select 'weekly-test-'||n,1,'Fictional weekly fixture '||n,
 'Rollback-only test content','Institutional','weekly',d.monday,
 'https://example.invalid/weekly-fixture-'||n,'Synthetic test source '||n,
 now()-interval '1 day'
from generate_series(1,9) n cross join test_calendar_dates d;
insert into public.dossier_options
 (dossier_id,dossier_version,id,title,description,treasury_delta_m_eur,
  policy_target,response_intensity,trust_base_delta)
select d.id,1,o.id,o.title,'Rollback-only test option',o.delta,50,10,0
from public.dossiers d
cross join (values('act','Act',-100),('hold','Hold',0)) o(id,title,delta)
where d.id like 'weekly-test-%';

-- Exactly nine dossiers cannot be approved.
set local role service_role;
do $$
declare caught boolean:=false; v_monday date;
begin
 select monday into v_monday from pg_temp.test_calendar_dates;
 begin perform public.approve_weekly_release(v_monday);
 exception when sqlstate 'P0001' then
  caught:=sqlerrm='WEEKLY_RELEASE_REQUIRES_TEN_DISTINCT_DOSSIERS';
 end;
 if not caught then raise exception 'NINE_DOSSIERS_APPROVED'; end if;
end $$;
reset role;

-- Complete the tenth dossier and its two options.
insert into public.dossiers
 (id,version,title,context,category,release_kind,available_from,
  source_url,source_title,source_published_at)
select 'weekly-test-10',1,'Fictional weekly fixture 10',
 'Rollback-only test content','Institutional','weekly',monday,
 'https://example.invalid/weekly-fixture-10','Synthetic test source 10',
 now()-interval '1 day' from test_calendar_dates;
insert into public.dossier_options
 (dossier_id,dossier_version,id,title,description,treasury_delta_m_eur,
  policy_target,response_intensity,trust_base_delta)
values
 ('weekly-test-10',1,'act','Act','Rollback-only test option',-100,50,10,0),
 ('weekly-test-10',1,'hold','Hold','Rollback-only test option',0,50,10,0);

set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000071',true);
do $$
declare g public.governments%rowtype; caught boolean:=false; v_monday date;
begin
 select monday into v_monday from pg_temp.test_calendar_dates;
 g:=public.start_government();
 if exists(select 1 from public.dossiers where id like 'weekly-test-%') or
    exists(select 1 from public.dossier_options where dossier_id like 'weekly-test-%') then
  raise exception 'UNAPPROVED_WEEKLY_CONTENT_VISIBLE'; end if;
 begin perform public.approve_weekly_release(v_monday);
 exception when insufficient_privilege then caught:=true; end;
 if not caught then raise exception 'PLAYER_APPROVED_WEEKLY_RELEASE'; end if;
 caught:=false;
 begin perform public.submit_decision(g.id,'weekly-test-1',1,'act');
 exception when sqlstate 'P0001' then caught:=true; end;
 if not caught then raise exception 'UNAPPROVED_DECISION_ACCEPTED'; end if;
 if (select count(*) from public.decision_events where government_id=g.id)<>0
    or (select treasury_m_eur from public.governments where id=g.id)<>12000 then
  raise exception 'UNAPPROVED_DECISION_PERSISTED'; end if;
end $$;
reset role;

set local role service_role;
do $$
declare v_monday date; first_approval public.weekly_releases%rowtype;
 retry public.weekly_releases%rowtype;
begin
 select monday into v_monday from pg_temp.test_calendar_dates;
 first_approval:=public.approve_weekly_release(v_monday);
 retry:=public.approve_weekly_release(v_monday);
 if first_approval.state<>'approved' or
    first_approval.approved_at is null or
    first_approval.approved_at<>retry.approved_at then
  raise exception 'WEEKLY_APPROVAL_NOT_IDEMPOTENT'; end if;
end $$;
reset role;

-- A complete future slate may be approved early but remains server-embargoed.
insert into public.dossiers
 (id,version,title,context,category,release_kind,available_from,
  source_url,source_title,source_published_at)
select 'future-weekly-test-'||n,1,'Future fictional fixture '||n,
 'Rollback-only embargo test','Institutional','weekly',d.monday+7,
 'https://example.invalid/future-fixture-'||n,'Synthetic future source '||n,
 now()-interval '1 day'
from generate_series(1,10) n cross join test_calendar_dates d;
insert into public.dossier_options
 (dossier_id,dossier_version,id,title,description,treasury_delta_m_eur,
  policy_target,response_intensity,trust_base_delta)
select d.id,1,o.id,o.title,'Rollback-only test option',0,50,10,0
from public.dossiers d
cross join (values('act','Act'),('hold','Hold')) o(id,title)
where d.id like 'future-weekly-test-%';
set local role service_role;
select public.approve_weekly_release(monday+7) from pg_temp.test_calendar_dates;
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000071',true);
do $$
declare g public.governments%rowtype; caught boolean:=false;
begin
  select * into strict g from public.governments where owner_id=auth.uid();
  if exists(select 1 from public.dossiers where id like 'future-weekly-test-%') or
     exists(select 1 from public.dossier_options where dossier_id like 'future-weekly-test-%') then
    raise exception 'FUTURE_WEEKLY_CONTENT_VISIBLE'; end if;
  begin perform public.submit_decision(g.id,'future-weekly-test-1',1,'act');
  exception when sqlstate 'P0001' then caught:=true; end;
  if not caught then raise exception 'FUTURE_WEEKLY_DECISION_ACCEPTED'; end if;
end $$;
reset role;

-- Approved editorial content is immutable even for privileged data writes.
do $$
declare caught boolean;
begin
 caught:=false;
 begin update public.dossiers set title='Tampered' where id='weekly-test-1';
 exception when sqlstate 'P0001' then caught:=true; end;
 if not caught then raise exception 'APPROVED_DOSSIER_EDIT_ALLOWED'; end if;
 caught:=false;
 begin update public.dossier_options set treasury_delta_m_eur=-9999
 where dossier_id='weekly-test-1';
 exception when sqlstate 'P0001' then caught:=true; end;
 if not caught then raise exception 'APPROVED_OPTION_EDIT_ALLOWED'; end if;
 caught:=false;
 begin update public.weekly_releases set state='draft'
 where week_start=(select monday from pg_temp.test_calendar_dates);
 exception when sqlstate 'P0001' then caught:=true; end;
 if not caught then raise exception 'APPROVED_SLATE_REOPENED'; end if;
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000071',true);
do $$
declare g public.governments%rowtype; w jsonb;
 ev public.decision_events%rowtype; retry public.decision_events%rowtype;
 v_monday date;
begin
 select monday into v_monday from pg_temp.test_calendar_dates;
 select * into strict g from public.governments where owner_id=auth.uid();
 w:=public.get_government_world(g.id);
 if extract(isodow from (now() at time zone 'UTC')::date)>5 then
   if jsonb_array_length(w->'dossiers')<>31 or
      jsonb_array_length(w->'options')<>155 then
     raise exception 'CLOSED_WEEKLY_DOSSIERS_STILL_ACTIONABLE'; end if;
   begin
     perform public.submit_decision(g.id,'weekly-test-1',1,'act');
     raise exception 'EXPIRED_WEEKLY_DECISION_EXECUTED';
   exception when sqlstate 'P0001' then
     if sqlerrm<>'DOSSIER_NOT_AVAILABLE' then raise; end if;
   end;
 else
   if jsonb_array_length(w->'dossiers')<>41 or
      jsonb_array_length(w->'options')<>175 then
     raise exception 'APPROVED_WEEKLY_CONTENT_NOT_VISIBLE'; end if;
 end if;
 if w->'calendar'->>'weekStart'<>v_monday::text or
    w->'calendar'->>'friday'<>(v_monday+4)::text or
    (w->'calendar'->>'weeklyTotal')::integer<>10 or
    (w->'calendar'->>'weeklyResolved')::integer<>0 then
  raise exception 'WEEKLY_CALENDAR_INITIAL_DRIFT'; end if;
 if extract(isodow from (now() at time zone 'UTC')::date)<=5 then
   ev:=public.submit_decision(g.id,'weekly-test-1',1,'act');
   retry:=public.submit_decision(g.id,'weekly-test-1',1,'act');
   if ev.id<>retry.id then raise exception 'WEEKLY_DUPLICATE_EXECUTED'; end if;
   w:=public.get_government_world(g.id);
   if (w->'calendar'->>'weeklyResolved')::integer<>1 or
      (w->'calendar'->>'weeklyTreasuryDeltaM')::integer<>-100 or
      (w->'government'->>'treasury_m_eur')::integer<>11900 then
     raise exception 'WEEKLY_RESULT_NOT_PERSISTED'; end if;
 end if;
end $$;
-- The Friday readout must be derived from persisted before/after state, not
-- mutable simulation parameters. This artificial mutation is rollback-only.
reset role;
-- After Friday, published weekly dossiers are read-only. Supply the same
-- historical ledger values through trusted rollback-only fixture setup,
-- never through a prohibited late browser action.
do $$
declare g uuid; mon date;
begin
 if extract(isodow from (now() at time zone 'UTC')::date)>5 then
   select id into g from public.governments
    where owner_id='10000000-0000-4000-8000-000000000071';
   select monday into mon from pg_temp.test_calendar_dates;
   insert into public.decision_events(
     government_id,dossier_id,dossier_version,option_id,
     parameters_snapshot,decided_on,state_before,state_after,cohort_effects,
     dossier_title_snapshot,option_title_snapshot)
   values(g,'weekly-test-1',1,'act',
     '{"treasury_delta_m_eur":-100}'::jsonb,mon+4,
     '{"treasury_m_eur":12000,"approval":50,"trust":50}'::jsonb,
     '{"treasury_m_eur":11900,"approval":52,"trust":51}'::jsonb,'[]'::jsonb,
     'Fictional weekly fixture 1','Act');
 end if;
end $$;
update public.decision_events
set parameters_snapshot=jsonb_set(parameters_snapshot,'{treasury_delta_m_eur}','999'::jsonb,true)
where dossier_id='weekly-test-1';
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000071',true);
do $$
declare g uuid;
begin
 select id into strict g from public.governments where owner_id=auth.uid();
 if (public.get_weekly_calendar(g)->>'weeklyTreasuryDeltaM')::integer<>-100 then
  raise exception 'WEEKLY_READOUT_USES_UNTRUSTED_PARAMETERS';
 end if;
end $$;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000072',true);
do $$
declare g public.governments%rowtype; other_id uuid;
begin
 select id into other_id from public.governments
 where owner_id='10000000-0000-4000-8000-000000000071';
 if public.get_weekly_calendar(other_id) is not null or
    public.get_government_world(other_id) is not null then
  raise exception 'WEEKLY_CALENDAR_CROSSTENANT_LEAK'; end if;
 g:=public.start_government();
 if (public.get_weekly_calendar(g.id)->>'weeklyResolved')::integer<>0 then
  raise exception 'WEEKLY_PLAYER_ISOLATION_DRIFT'; end if;
end $$;
rollback;