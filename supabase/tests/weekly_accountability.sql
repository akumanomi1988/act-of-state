-- AOS-037: authenticated 3-user, 2-week history and expiry; no fixtures persist.
begin;
insert into auth.users
 (id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at)
select ('43000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 '00000000-0000-0000-0000-000000000000','authenticated','authenticated',
 'accountability-'||n||'@example.invalid','',now(),now(),now()
from generate_series(1,3) n;

create temporary table qa_week_fixture(
 match_id uuid,government_id uuid,invite_code text,current_monday date,
 previous_monday date,old_dossier text,new_dossier text
);
grant select,insert on pg_temp.qa_week_fixture to authenticated;

set local role authenticated;
select set_config('request.jwt.claim.sub','43000000-0000-4000-8000-000000000001',true);
do $$
declare m public.matches%rowtype; mon date;
begin
 m:=public.create_match('Weekly Reporting Assembly','Civic Government');
 mon:=(now() at time zone 'UTC')::date;
 mon:=mon-(extract(isodow from mon)::integer-1);
 insert into pg_temp.qa_week_fixture values(m.id,m.government_id,m.invite_code,
   mon,mon-7,'qa-history-prior-'||to_char(mon,'YYYYMMDD'),
     'qa-history-now-'||to_char(mon,'YYYYMMDD'));
end $$;

select set_config('request.jwt.claim.sub','43000000-0000-4000-8000-000000000002',true);
select public.join_match((select invite_code from pg_temp.qa_week_fixture),
  'Accountable Opposition');

select set_config('request.jwt.claim.sub','43000000-0000-4000-8000-000000000001',true);
select public.start_match((select match_id from pg_temp.qa_week_fixture));

-- Operators may backdate *disposable* test matches to examine a real
-- completed week, without changing wall-clock UTC or real game state.
reset role;
update public.matches set started_at=now()-interval '21 days'
 where id=(select match_id from pg_temp.qa_week_fixture);

-- Realistic complete slates: each approved week has exactly ten dossiers,
-- independently cited, with at least two well-formed options each.
insert into public.weekly_releases(week_start)
select previous_monday from pg_temp.qa_week_fixture
union all select current_monday from pg_temp.qa_week_fixture;

insert into public.dossiers(
 id,version,title,context,category,release_kind,available_from,
 source_url,source_title,source_published_at)
select case when n=1 then f.old_dossier else f.old_dossier||'-'||n end,
  1,'Previous weekly housing report '||n,
  'A rollback-only previous weekly political event in a fictional game.',
  'Economía','weekly',f.previous_monday,
  'https://example.invalid/old-report-'||n,'Synthetic historical fixture '||n,
  now()-interval '8 days'
from pg_temp.qa_week_fixture f cross join generate_series(1,10) n
union all
select case when n=1 then f.new_dossier else f.new_dossier||'-'||n end,
  1,'Current weekly housing report '||n,
  'A rollback-only current weekly political event in a fictional game.',
  'Economía','weekly',f.current_monday,
  'https://example.invalid/current-report-'||n,'Synthetic current fixture '||n,
  now()-interval '2 days'
from pg_temp.qa_week_fixture f cross join generate_series(1,10) n;

insert into public.dossier_options(
 dossier_id,dossier_version,id,title,description,
 treasury_delta_m_eur,policy_target,response_intensity,trust_base_delta)
select d.id,d.version,o.id,o.title,
 'Two-sided rollback-only public policy alternative.',o.treasury,40,25,2
from public.dossiers d
cross join (values('qa-accept','Accept housing response',-100),
 ('qa-current','Maintain housing response',0)) o(id,title,treasury)
where d.id like 'qa-history-prior-%' or d.id like 'qa-history-now-%';

select public.approve_weekly_release(previous_monday)
from pg_temp.qa_week_fixture;
select public.approve_weekly_release(current_monday)
from pg_temp.qa_week_fixture;

do $$
declare f record;
begin
 select * into f from pg_temp.qa_week_fixture;
 if (select available_until from public.dossiers where id=f.old_dossier)
    <>f.previous_monday+4 or
   (select available_until from public.dossiers where id=f.new_dossier)
    <>f.current_monday+4 then
   raise exception 'WEEKLY_END_DATE_NOT_FIXED_TO_FRIDAY'; end if;

 insert into public.decision_events(
 government_id,dossier_id,dossier_version,option_id,
 parameters_snapshot,decided_on,state_before,state_after,cohort_effects,
 dossier_title_snapshot,option_title_snapshot)
 values(f.government_id,f.old_dossier,1,'qa-accept',
 '{"treasury_delta_m_eur":-100}',f.previous_monday+3,
 '{"treasury_m_eur":12000,"approval":50,"trust":50}',
 '{"treasury_m_eur":11900,"approval":52,"trust":51}','[]',
 'Previous weekly housing report','Accept public housing response');
 if not game_internal.close_match_friday(f.match_id,f.previous_monday) then
   raise exception 'WEEKLY_HISTORY_FRIDAY_ACT_NOT_INSERTED'; end if;

 insert into public.match_stances(
   match_id,user_id,dossier_id,dossier_version,option_id,policy_affinity)
 values(f.match_id,'43000000-0000-4000-8000-000000000002',
   f.new_dossier,1,'qa-current',75);

 insert into public.parliament_bills(
   match_id,dossier_id,dossier_version,option_id,proposed_by)
 values(f.match_id,f.new_dossier,1,'qa-current',
   '43000000-0000-4000-8000-000000000001');
 insert into public.parliament_votes(bill_id,match_id,user_id,choice)
 select b.id,f.match_id,'43000000-0000-4000-8000-000000000002','yes'
 from public.parliament_bills b where b.match_id=f.match_id
 and b.dossier_id=f.new_dossier;
end $$;

-- Guest can see government history, published citations, its own actions,
-- other parties' aggregate activity and the frozen, immutable Friday act.
set local role authenticated;
select set_config('request.jwt.claim.sub','43000000-0000-4000-8000-000000000002',true);
do $$
declare f record; result jsonb; old_week jsonb; new_week jsonb;
 blocked boolean:=false;
begin
 select * into f from pg_temp.qa_week_fixture;
 result:=public.get_match_weekly_accountability(f.match_id,8);
 if jsonb_array_length(result->'weeks')<2 or
    result->>'serverDay'<>
      (now() at time zone 'UTC')::date::text then
   raise exception 'WEEKLY_HISTORY_MISSING_EXPECTED_WEEKS'; end if;
 select value into old_week from jsonb_array_elements(result->'weeks') x
   where x.value->>'weekStart'=f.previous_monday::text;
 select value into new_week from jsonb_array_elements(result->'weeks') x
   where x.value->>'weekStart'=f.current_monday::text;
 if old_week->>'status'<>'closed' or
    old_week->'fridayAct'->>'decisions_resolved'<>'1' or
    old_week->'fridayAct'->>'treasury_delta_m_eur'<>'-100' or
    jsonb_array_length(old_week->'dossiers')<>10 or
    (select count(*) from jsonb_array_elements(old_week->'dossiers') d
       where d->>'id'=f.old_dossier and
         d->'decision'->>'optionId'='qa-accept')<>1 then
   raise exception 'OFFICIAL_WEEKLY_HISTORY_INCONSISTENT'; end if;
 if new_week->>'published'<>'true' or
    jsonb_array_length(new_week->'dossiers')<>10 or
    (select count(*) from jsonb_array_elements(new_week->'dossiers') d
       where d->>'id'=f.new_dossier and d->>'positions'='1' and
       d->'bill'->>'yesVotes'='1')<>1 or
    (select count(*) from jsonb_array_elements(new_week->'parties') p
       where p->>'partyName'='Accountable Opposition'
         and p->>'positions'='1' and p->>'votes'='1')<>1 then
   raise exception 'POLITICAL_PARTICIPATION_NOT_RECONCILED'; end if;
 if (select count(*) from jsonb_array_elements(result->'weeks') x
   where x.value->>'weekStart'>f.current_monday::text)>0 then
   raise exception 'FUTURE_WEEK_LEAK'; end if;

 begin perform public.record_match_stance(f.match_id,f.old_dossier,1,'qa-accept');
 exception when sqlstate 'P0001' then blocked:=sqlerrm='DOSSIER_NOT_AVAILABLE'; end;
 if not blocked then raise exception 'CLOSED_WEEK_ACCEPTED_NEW_POSITION'; end if;
 blocked:=false;
 begin perform public.get_match_weekly_accountability(f.match_id,13);
 exception when sqlstate 'P0001' then blocked:=sqlerrm='MATCH_WEEK_RANGE_INVALID'; end;
 if not blocked then raise exception 'UNBOUNDED_HISTORY_ACCEPTED'; end if;
end $$;

select set_config('request.jwt.claim.sub','43000000-0000-4000-8000-000000000003',true);
do $$
declare blocked boolean:=false; m uuid;
begin
 select match_id into m from pg_temp.qa_week_fixture;
 begin perform public.get_match_weekly_accountability(m,8);
 exception when sqlstate '42501' then blocked:=sqlerrm='MATCH_FORBIDDEN'; end;
 if not blocked then raise exception 'CROSS_MATCH_HISTORY_LEAK'; end if;
end $$;

reset role;
do $$
begin
 if has_function_privilege('anon','public.get_match_weekly_accountability(uuid,integer)','EXECUTE')
 or has_table_privilege('authenticated','public.match_weekly_closures','SELECT')
 then raise exception 'WEEKLY_AUDIT_PRIVILEGES_EXPOSED'; end if;
end $$;
rollback;
