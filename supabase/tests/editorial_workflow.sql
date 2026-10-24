-- Editorial draft/review/publish integration: every fixture is transactionally rolled back.
begin;
insert into auth.users
 (id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at)
values
 ('10000000-0000-4000-8000-000000000081','00000000-0000-0000-0000-000000000000',
  'authenticated','authenticated','editor-test@example.invalid','',now(),now(),now()),
 ('10000000-0000-4000-8000-000000000082','00000000-0000-0000-0000-000000000000',
  'authenticated','authenticated','publisher-test@example.invalid','',now(),now(),now()),
 ('10000000-0000-4000-8000-000000000083','00000000-0000-0000-0000-000000000000',
  'authenticated','authenticated','outsider-test@example.invalid','',now(),now(),now());

insert into public.editorial_members(user_id,role) values
 ('10000000-0000-4000-8000-000000000081','editor'),
 ('10000000-0000-4000-8000-000000000082','publisher');

create temporary table editorial_fixture as
with calendar as (
  select ((now() at time zone 'UTC')::date -
    (extract(isodow from (now() at time zone 'UTC')::date)::integer-1))::date as monday
)
select monday,
 jsonb_agg(jsonb_build_object(
  'id','weekly-'||monday::text||'-'||lpad(n::text,2,'0'),
  'title','Fictional policy decision number '||n,
  'context','Rollback-only fictional dossier context describing a government decision '||n||
    ' and its institutional trade-offs.',
  'category','Institutional',
  'source_url','https://example.invalid/editorial-fixture-'||n,
  'source_title','Synthetic test reference number '||n,
  'source_published_at',to_jsonb(now()-interval '1 day'),
  'options',jsonb_build_array(
    jsonb_build_object('id','option-a','title','Approve policy',
      'description','Rollback-only option: approve the measure.',
      'treasury_delta_m_eur',-100,'policy_target',30,
      'response_intensity',20,'trust_base_delta',2),
    jsonb_build_object('id','option-b','title','Reject policy',
      'description','Rollback-only option: reject the measure.',
      'treasury_delta_m_eur',0,'policy_target',70,
      'response_intensity',10,'trust_base_delta',-1))
  ) order by n) as full_draft
from calendar cross join generate_series(1,10) n
group by monday;
grant select on pg_temp.editorial_fixture to authenticated,service_role;

-- Unlisted users cannot enumerate staff or view drafts, and cannot use either RPC.
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000083',true);
do $$
declare blocked boolean:=false; f record;
begin
 select * into f from pg_temp.editorial_fixture;
 if exists(select 1 from public.editorial_members) or
    exists(select 1 from public.editorial_weeks) then
  raise exception 'EDITORIAL_RLS_CROSSTENANT_LEAK'; end if;
 begin
  perform public.save_editorial_week(f.monday,0,f.full_draft);
 exception when insufficient_privilege then blocked:=true; end;
 if not blocked then raise exception 'OUTSIDER_SAVED_EDITORIAL_WEEK'; end if;
 blocked:=false;
 begin
  perform public.publish_editorial_week(f.monday,0);
 exception when insufficient_privilege then blocked:=true; end;
 if not blocked then raise exception 'OUTSIDER_PUBLISHED_EDITORIAL_WEEK'; end if;
end $$;

-- Editors may save partial drafts, but not approve a release.
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000081',true);
do $$
declare f record; saved public.editorial_weeks%rowtype; blocked boolean:=false;
begin
 select * into f from pg_temp.editorial_fixture;
 saved:=public.save_editorial_week(f.monday,0,f.full_draft - 9);
 if saved.revision<>1 or jsonb_array_length(saved.draft)<>9 then
  raise exception 'EDITORIAL_PARTIAL_DRAFT_NOT_PERSISTED'; end if;
 begin
  perform public.save_editorial_week(f.monday,0,f.full_draft);
 exception when sqlstate 'P0001' then
  blocked:=sqlerrm='EDITORIAL_REVISION_CONFLICT'; end;
 if not blocked then raise exception 'EDITORIAL_STALE_WRITE_ACCEPTED'; end if;
 blocked:=false;
 begin
  perform public.publish_editorial_week(f.monday,1);
 exception when insufficient_privilege then blocked:=true; end;
 if not blocked then raise exception 'EDITOR_PUBLISHED_WEEK'; end if;
 if (select count(*) from public.weekly_releases where week_start=f.monday)<>0 then
  raise exception 'EDITORIAL_PARTIAL_DRAFT_BECAME_PLAYABLE'; end if;
end $$;

-- Publisher completes the ten dossiers and atomically approves them.
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000082',true);
do $$
declare f record; saved public.editorial_weeks%rowtype;
 first_publication public.editorial_weeks%rowtype;
 retry public.editorial_weeks%rowtype; blocked boolean:=false;
begin
 select * into f from pg_temp.editorial_fixture;
 -- Reject a ten-dossier slate with one repeated source without creating
 -- any releases or dossiers, then recover with the independently sourced set.
 saved:=public.save_editorial_week(f.monday,1,
   jsonb_set(f.full_draft,'{9,source_url}',f.full_draft->0->'source_url'));
 -- The publisher must affirm each source on the saved revision.
 perform public.review_editorial_slot(f.monday,saved.revision,
   d.value->>'id',true) from jsonb_array_elements(saved.draft) d;
 begin
   perform public.publish_editorial_week(f.monday,saved.revision);
 exception when sqlstate 'P0001' then
   blocked:=sqlerrm='EDITORIAL_DUPLICATE_NEWS_SOURCE'; end;
 if not blocked then raise exception 'EDITORIAL_DUPLICATE_SOURCE_ACCEPTED'; end if;
 if exists(select 1 from public.weekly_releases where week_start=f.monday) then
   raise exception 'EDITORIAL_DUPLICATE_SOURCE_PARTIALLY_PUBLISHED'; end if;
 saved:=public.save_editorial_week(f.monday,2,f.full_draft);
 if saved.revision<>3 or jsonb_array_length(saved.draft)<>10 then
  raise exception 'EDITORIAL_COMPLETED_DRAFT_NOT_SAVED'; end if;
 -- Approvals on revision 2 must not authorize revision 3.
 blocked:=false;
 begin perform public.publish_editorial_week(f.monday,3);
 exception when sqlstate 'P0001' then
   blocked:=sqlerrm='EDITORIAL_REQUIRES_TEN_REVIEWS'; end;
 if not blocked then raise exception 'STALE_REVIEWS_AUTHORIZED_PUBLICATION'; end if;
 perform public.review_editorial_slot(f.monday,3,
   d.value->>'id',true) from jsonb_array_elements(saved.draft) d;
 first_publication:=public.publish_editorial_week(f.monday,3);
 retry:=public.publish_editorial_week(f.monday,3);
 if first_publication.status<>'published' or first_publication.revision<>4 or
    first_publication.published_at is null or retry.revision<>4 or
    first_publication.published_at<>retry.published_at then
  raise exception 'EDITORIAL_PUBLICATION_NOT_IDEMPOTENT'; end if;
 begin
  perform public.save_editorial_week(f.monday,4,f.full_draft);
 exception when sqlstate 'P0001' then
  blocked:=sqlerrm='EDITORIAL_ALREADY_PUBLISHED'; end;
 if not blocked then raise exception 'PUBLISHED_WEEK_REOPENED'; end if;
 if (select count(*) from public.dossiers
     where release_kind='weekly' and available_from=f.monday)<>10 or
    (select count(*) from public.dossier_options o join public.dossiers d
      on d.id=o.dossier_id and d.version=o.dossier_version
      where d.release_kind='weekly' and d.available_from=f.monday)<>20 or
    (select state from public.weekly_releases where week_start=f.monday)<>'approved' then
  raise exception 'EDITORIAL_PUBLICATION_MATERIALIZATION_FAILED'; end if;
end $$;

-- A malformed option must roll back the entire second publication statement.
do $$
declare f record; second_monday date; broken jsonb;
 saved public.editorial_weeks%rowtype; blocked boolean:=false;
begin
 select * into f from pg_temp.editorial_fixture;
 second_monday:=f.monday+7;
 broken:=replace(f.full_draft::text,f.monday::text,second_monday::text)::jsonb;
 broken:=jsonb_set(broken,'{9,options,1,treasury_delta_m_eur}','999999'::jsonb);
 saved:=public.save_editorial_week(second_monday,0,broken);
 perform public.review_editorial_slot(second_monday,saved.revision,
   d.value->>'id',true) from jsonb_array_elements(saved.draft) d;
 begin
  perform public.publish_editorial_week(second_monday,saved.revision);
 exception when sqlstate 'P0001' then
  blocked:=sqlerrm='EDITORIAL_INVALID_OPTION_PARAMETERS'; end;
 if not blocked then raise exception 'INVALID_EDITORIAL_PARAMETERS_PUBLISHED'; end if;
 if exists(select 1 from public.weekly_releases where week_start=second_monday) or
    exists(select 1 from public.dossiers where available_from=second_monday) or
    (select status from public.editorial_weeks where week_start=second_monday)<>'draft' then
  raise exception 'EDITORIAL_ATOMIC_ROLLBACK_FAILED'; end if;
end $$;

-- Published data is visible only through the existing server embargo and game policy.
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000083',true);
do $$
declare g public.governments%rowtype; w jsonb; f record;
begin
 select * into f from pg_temp.editorial_fixture;
 if exists(select 1 from public.editorial_weeks) or
    exists(select 1 from public.editorial_members) then
  raise exception 'EDITORIAL_STAFF_DATA_LEAK'; end if;
 g:=public.start_government();
 w:=public.get_government_world(g.id);
 if (w->'calendar'->>'weeklyTotal')::integer<>10 or
    (select count(*) from public.dossiers
     where release_kind='weekly' and available_from=f.monday)<>10 then
  raise exception 'EDITORIAL_PLAYABLE_DOSSIERS_NOT_VISIBLE'; end if;
end $$;
rollback;