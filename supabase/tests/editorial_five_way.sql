-- AOS-056: five-way editorial publication acceptance.
-- The test validates four-choice, duplicate-title and duplicate-position rejection
-- without any partial release; a valid ten-slot week remains publishable.
begin;
insert into auth.users
 (id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at)
values('56000000-0000-4000-8000-000000000001',
 '00000000-0000-0000-0000-000000000000',
 'authenticated','authenticated','five-way-publisher@example.invalid','',
 now(),now(),now());
insert into public.editorial_members(user_id,role)
values('56000000-0000-4000-8000-000000000001','publisher');

create temporary table five_way_fixture as
with day as (
 select ((now() at time zone 'UTC')::date-
  (extract(isodow from (now() at time zone 'UTC')::date)::integer-1))::date as monday
)
select monday, jsonb_agg(jsonb_build_object(
 'id','weekly-'||monday::text||'-'||lpad(n::text,2,'0'),
 'title','Fictional policy debate number '||n,
 'context','Rollback-only fictional political debate with independently reviewed source and options '||n,
 'category','National institutions',
 'source_url','https://example.invalid/five-options-'||n,
 'source_title','A distinct synthetic source article number '||n,
 'source_published_at',to_jsonb(now()-interval '1 day'),
 'options',jsonb_build_array(
  jsonb_build_object('id','option-a','title','Approve immediate intervention',
   'description','Authorize immediate action with an explicitly audited fiscal cost.',
   'treasury_delta_m_eur',-200,'policy_target',15,
   'response_intensity',40,'trust_base_delta',2),
  jsonb_build_object('id','option-b','title','Negotiate limited intervention',
   'description','Authorize a limited pilot after an independent local review.',
   'treasury_delta_m_eur',-80,'policy_target',35,
   'response_intensity',30,'trust_base_delta',1),
  jsonb_build_object('id','option-c','title','Maintain current approach',
   'description','Avoid new budget commitments while maintaining current safeguards.',
   'treasury_delta_m_eur',0,'policy_target',55,
   'response_intensity',20,'trust_base_delta',-1),
  jsonb_build_object('id','option-d','title','Delegate regional authority',
   'description','Fund regional delegates to monitor the programme and audit results.',
   'treasury_delta_m_eur',-45,'policy_target',75,
   'response_intensity',25,'trust_base_delta',3),
  jsonb_build_object('id','option-e','title','Apply progressive special levy',
   'description','Collect a progressive levy to pay the immediate public expenditure.',
   'treasury_delta_m_eur',120,'policy_target',95,
   'response_intensity',50,'trust_base_delta',-3)
  )
 ) order by n) as slate
from day cross join generate_series(1,10) n
group by monday;
grant select on pg_temp.five_way_fixture to authenticated;
set local role authenticated;
select set_config('request.jwt.claim.sub','56000000-0000-4000-8000-000000000001',true);
do $$
declare
 f record;
 v_revision integer:=0;
 v_bad jsonb;
 v_week public.editorial_weeks%rowtype;
 v_kind text;
 v_caught boolean;
begin
 select * into strict f from pg_temp.five_way_fixture;
 for v_kind in select unnest(array['four','duplicate_title','duplicate_position']) loop
  v_bad:=f.slate;
  if v_kind='four' then
   v_bad:=jsonb_set(v_bad,'{0,options}',(v_bad->0->'options')-4);
  elsif v_kind='duplicate_title' then
   v_bad:=jsonb_set(v_bad,'{0,options,4,title}',v_bad->0->'options'->0->'title');
  else
   v_bad:=jsonb_set(v_bad,'{0,options,4,policy_target}',v_bad->0->'options'->0->'policy_target');
  end if;
  v_week:=public.save_editorial_week(f.monday,v_revision,v_bad);
  v_revision:=v_week.revision;
  perform public.review_editorial_slot(f.monday,v_revision,d.value->>'id',true)
    from jsonb_array_elements(v_bad) d;
  v_caught:=false;
  begin
   perform public.publish_editorial_week(f.monday,v_revision);
  exception when sqlstate 'P0001' then
   v_caught:=sqlerrm='EDITORIAL_INVALID_OPTIONS';
  end;
  if not v_caught then raise exception 'INVALID_FIVE_WAY_SLATE_ACCEPTED: %',v_kind; end if;
  if exists(select 1 from public.weekly_releases r where r.week_start=f.monday)
    or exists(select 1 from public.dossiers d
        where d.id='weekly-'||f.monday::text||'-01') then
   raise exception 'INCOMPLETE_FIVE_WAY_SLATE_PARTIALLY_RELEASED';
  end if;
 end loop;
 v_week:=public.save_editorial_week(f.monday,v_revision,f.slate);
 v_revision:=v_week.revision;
 perform public.review_editorial_slot(f.monday,v_revision,d.value->>'id',true)
   from jsonb_array_elements(f.slate) d;
 v_week:=public.publish_editorial_week(f.monday,v_revision);
 if v_week.status<>'published'
 or (select count(*) from public.dossiers
   where id like 'weekly-'||f.monday::text||'-%')<>10
 or (select count(*) from public.dossier_options o join public.dossiers d
   on d.id=o.dossier_id and d.version=o.dossier_version
   where d.id like 'weekly-'||f.monday::text||'-%')<>50
 then raise exception 'VALID_FIVE_WAY_WEEK_NOT_PUBLISHED'; end if;
 if (public.publish_editorial_week(f.monday,v_revision)).revision<>v_week.revision
 then raise exception 'PUBLISH_RETRY_NOT_IDEMPOTENT'; end if;
 raise notice 'AOS-056 five-way weekly publication contract PASS';
end $$;
rollback;
