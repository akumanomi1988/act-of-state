-- Historical decision title snapshots survive expiration and editorial rewrites.
-- Must be executed only in isolated ACT OF STATE test context; all writes rollback.
begin;
insert into auth.users
 (id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at)
values('10000000-0000-4000-8000-000000000051','00000000-0000-0000-0000-000000000000',
'authenticated','authenticated','aos-history@example.invalid','',now(),now(),now());
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000051',true);
do $$
declare g public.governments%rowtype; e public.decision_events%rowtype;
begin
 g:=public.start_government();
 e:=public.submit_decision(g.id,'energy-resilience',1,'household-support');
 if e.dossier_title_snapshot <> 'Plan de resiliencia energética'
 or e.option_title_snapshot <> 'Proteger a los hogares'
 or e.state_after->>'treasury_m_eur' <> '10600' then
  raise exception 'HISTORY_SNAPSHOT_NOT_SAVED'; end if;
end $$;
reset role;
update public.dossiers set title='TITULO EDITORIAL MODIFICADO',
 available_until=((now() at time zone 'UTC')::date - 1)
where id='energy-resilience' and version=1;
update public.dossier_options set title='OPCION EDITORIAL MODIFICADA'
where dossier_id='energy-resilience' and dossier_version=1 and id='household-support';
set local role authenticated;
do $$
declare g public.governments%rowtype; w jsonb; e public.decision_events%rowtype;
begin
 select * into strict g from public.governments where owner_id=auth.uid();
 w:=public.get_government_world(g.id);
 if exists(select 1 from jsonb_array_elements(w->'dossiers') d
   where d->>'id'='energy-resilience')
 or exists(select 1 from jsonb_array_elements(w->'options') o
   where o->>'dossier_id'='energy-resilience') then
  raise exception 'EXPIRED_EDITORIAL_CATALOG_VISIBLE'; end if;
 if jsonb_array_length(w->'dossiers') <> 9
 or jsonb_array_length(w->'options') <> 27
 or not exists(select 1 from jsonb_array_elements(w->'dossiers') d
     where d->>'id'='water-security') then
  raise exception 'OTHER_AVAILABLE_DOSSIER_HIDDEN'; end if;
 if jsonb_array_length(w->'events') <> 1 then
  raise exception 'HISTORICAL_DECISION_DISAPPEARED'; end if;
 if w->'events'->0->>'dossier_title_snapshot' <> 'Plan de resiliencia energética'
 or w->'events'->0->>'option_title_snapshot' <> 'Proteger a los hogares' then
  raise exception 'HISTORICAL_TITLES_NOT_IMMUTABLE'; end if;
 e:=public.submit_decision(g.id,'energy-resilience',1,'household-support');
 if e.id::text <> w->'events'->0->>'id' then
  raise exception 'IDEMPOTENT_HISTORY_RETRY_FAILED'; end if;
 if (w->'government'->>'treasury_m_eur')::int<>10600 then
  raise exception 'NATIONAL_STATE_REPLAY_DRIFT'; end if;
end $$;
rollback;
