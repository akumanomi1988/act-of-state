-- AOS-050: complete original 18-case permanent reform story, not live news.
-- Tests exact source catalogue, every option, independent signed outcomes,
-- archived founding integrity, replay/idempotency and cross-owner RLS.
-- Transaction rolls back everything. Do not run on hosted player data.
begin;
insert into auth.users
 (id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at)
values
 ('51000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000',
  'authenticated','authenticated','reforms-host@example.invalid','',now(),now(),now()),
 ('51000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000',
  'authenticated','authenticated','reforms-outsider@example.invalid','',now(),now(),now());

set local role authenticated;
select set_config('request.jwt.claim.sub','51000000-0000-4000-8000-000000000001',true);

do $$
declare
 v_g public.governments%rowtype;
 v_policy record;
 v_act public.decision_events%rowtype;
 v_retry public.decision_events%rowtype;
 v_world jsonb;
 v_count integer:=0;
 v_added integer:=0;
 v_old integer;
 v_denied boolean:=false;
begin
 v_g:=public.start_government();
 v_old:=v_g.treasury_m_eur;
 v_world:=public.get_government_world(v_g.id);

 if (select count(*) from public.dossiers
   where release_kind='intro' and programme_chapter='founding')<>10
 or (select count(*) from public.dossiers
   where release_kind='intro' and programme_chapter in
     ('society','economy','institutions','resilience'))<>18
 or (select count(*) from public.dossier_options o
     join public.dossiers d on d.id=o.dossier_id and d.version=o.dossier_version
     where d.release_kind='intro')<>155
 or jsonb_array_length(v_world->'dossiers')<>31
 or jsonb_array_length(v_world->'options')<>155 then
   raise exception 'AOS_REFORM_CATALOGUE_AND_SNAPSHOT_INCOMPLETE';
 end if;

 if (select count(*) from (
  select programme_chapter,count(*) n from public.dossiers
  where programme_chapter in ('society','economy','institutions','resilience')
  group by programme_chapter
 ) x where (x.programme_chapter in ('society','economy') and n=5)
    or (x.programme_chapter in ('institutions','resilience') and n=4))<>4 then
    raise exception 'AOS_REFORM_CHAPTER_COVERAGE';
 end if;

 if exists(select 1 from public.dossiers d
   where d.programme_chapter in ('society','economy','institutions','resilience')
   and (d.release_kind<>'intro' or d.available_from is not null or
        d.available_until is not null or d.source_url is not null or
        length(d.context)<130 or position('Escenario ficticio:' in d.context)<>1))
 or exists(select 1 from (
     select d.id,d.version,count(o.id) as alternatives,
       count(distinct o.policy_target) as targets,
       min(o.treasury_delta_m_eur) as min_cost,
       max(o.treasury_delta_m_eur) as max_cost,
       min(length(o.description)) as shortest_choice
     from public.dossiers d join public.dossier_options o
       on o.dossier_id=d.id and o.dossier_version=d.version
     where d.programme_chapter in ('society','economy','institutions','resilience')
     group by d.id,d.version
   ) quality where alternatives<>5 or targets<>5 or min_cost>=0 or
     max_cost<=0 or shortest_choice<45)
 or (select count(distinct (programme_chapter,programme_order))
     from public.dossiers where programme_chapter in
      ('society','economy','institutions','resilience'))<>18
 then raise exception 'AOS_REFORM_CONTENT_NOT_BALANCED_OR_FICTIONAL'; end if;

 -- Complete every new reform using a fiscally positive but politically
 -- controversial reserve-preserving option. All 18 cases are playable even
 -- after a conservative initial programme and no newsroom publication.
 for v_policy in
   select d.id as dossier_id,o.id as option_id,o.treasury_delta_m_eur as cost
   from public.dossiers d
   cross join lateral (
      select o2.id,o2.treasury_delta_m_eur from public.dossier_options o2
      where o2.dossier_id=d.id and o2.dossier_version=d.version
      order by o2.treasury_delta_m_eur desc,o2.id limit 1
   ) o
   where d.release_kind='intro' and d.programme_chapter in
     ('society','economy','institutions','resilience')
   order by d.programme_chapter,d.programme_order
 loop
   v_act:=public.submit_decision(v_g.id,v_policy.dossier_id,1,v_policy.option_id);
   v_retry:=public.submit_decision(v_g.id,v_policy.dossier_id,1,v_policy.option_id);
   if v_retry.id<>v_act.id or v_retry.state_after<>v_act.state_after or
      v_act.dossier_title_snapshot is null or v_act.option_title_snapshot is null or
      v_act.engine_version is null or
      (v_act.state_after->>'treasury_m_eur')::integer<>
        (v_act.state_before->>'treasury_m_eur')::integer+v_policy.cost then
     raise exception 'AOS_REFORM_INVALID_IMMUTABLE_ACT_%',v_policy.dossier_id;
   end if;
   v_count:=v_count+1;
   v_added:=v_added+v_policy.cost;
 end loop;

 if v_count<>18 or v_added<=0 or
   (select treasury_m_eur from public.governments where id=v_g.id)<>v_old+v_added then
   raise exception 'AOS_REFORM_TOTAL_TREASURY_INCONSISTENT';
 end if;
 v_world:=public.get_government_world(v_g.id);
 if jsonb_array_length(v_world->'events')<>18 or
   (select count(*) from public.decision_events e
     where e.government_id=v_g.id)<>18 then
   raise exception 'AOS_REFORM_HISTORY_NOT_PERSISTED';
 end if;

 begin
   perform public.submit_decision(v_g.id,'pension-covenant',1,'basic-pension-floor');
 exception when sqlstate 'P0001' then
   v_denied:=sqlerrm='DOSSIER_ALREADY_DECIDED';
 end;
 if not v_denied then raise exception 'AOS_REFORM_CONFLICTING_RETRY_WAS_ACCEPTED'; end if;
 if (select count(*) from public.decision_events e
   where e.government_id=v_g.id)<>18 then
   raise exception 'AOS_REFORM_DUPLICATE_WRITE';
 end if;

 -- A second real SQL Auth identity may establish another independent
 -- government but may not read, sign or replay the first account's reforms.
 perform set_config('request.jwt.claim.sub',
   '51000000-0000-4000-8000-000000000002',true);
 if public.get_government_world(v_g.id) is not null then
   raise exception 'AOS_REFORM_CROSS_OWNER_SNAPSHOT_LEAK';
 end if;
 v_denied:=false;
 begin
   perform public.submit_decision(v_g.id,'care-economy',1,'public-home-care');
 exception when insufficient_privilege then v_denied:=true; end;
 if not v_denied then raise exception 'AOS_REFORM_CROSS_OWNER_WRITE'; end if;
 v_g:=public.start_government();
 if v_g.owner_id=
      '51000000-0000-4000-8000-000000000001'::uuid then
   raise exception 'AOS_REFORM_CROSS_OWNER_GOVERNMENT';
 end if;
end $$;
rollback;
