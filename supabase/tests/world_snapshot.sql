-- Isolated AOS SQL integration; rollback leaves no synthetic users or game state.
begin;
insert into auth.users
 (id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at)
values
 ('10000000-0000-4000-8000-000000000011','00000000-0000-0000-0000-000000000000',
 'authenticated','authenticated','aos-world-one@example.invalid','',now(),now(),now()),
 ('10000000-0000-4000-8000-000000000012','00000000-0000-0000-0000-000000000000',
 'authenticated','authenticated','aos-world-two@example.invalid','',now(),now(),now());
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000011',true);
do $$
declare g public.governments%rowtype; v jsonb; ev public.decision_events%rowtype;
begin
 g:=public.start_government();
 v:=public.get_government_world(g.id);
 if (v->'government'->>'id') <> g.id::text then
  raise exception 'WORLD_OWNER_ID_MISMATCH'; end if;
 if (v->>'gameDay') <> ((now() at time zone 'UTC')::date)::text then
  raise exception 'WORLD_DAY_INCORRECT'; end if;
 if v->'calendar'->>'weekStart' <> (((now() at time zone 'UTC')::date -
      (extract(isodow from (now() at time zone 'UTC')::date)::integer-1))::date)::text
 or (v->'calendar'->>'weeklyTotal')::integer<>0
 or (v->'calendar'->>'weeklyResolved')::integer<>0
 or (v->'calendar'->>'weeklyTreasuryDeltaM')::integer<>0 then
  raise exception 'WORLD_CALENDAR_INITIAL_DRIFT'; end if;
 if jsonb_array_length(v->'cohorts') <> 2
 or jsonb_array_length(v->'dossiers') <> 28
 or jsonb_array_length(v->'options') <> 84
 or jsonb_array_length(v->'events') <> 0 then
  raise exception 'WORLD_INITIAL_COLLECTIONS_INCORRECT'; end if;
 ev:=public.submit_decision(g.id,'energy-resilience',1,'household-support');
 v:=public.get_government_world(g.id);
 if (v->'government'->>'treasury_m_eur')::integer <> 10600
 or (v->'government'->>'approval')::integer <> 62
 or (v->'government'->>'trust')::integer <> 58 then
  raise exception 'WORLD_PERSISTED_STATE_MISMATCH'; end if;
 if jsonb_array_length(v->'events') <> 1
 or v->'events'->0->>'id' <> ev.id::text then
  raise exception 'WORLD_DECISION_HISTORY_MISMATCH'; end if;
 if jsonb_array_length(v->'cohorts') <> 2 then
  raise exception 'WORLD_COHORTS_MISSING'; end if;
 if public.submit_decision(g.id,'energy-resilience',1,'household-support') is distinct from ev then
  raise exception 'DUPLICATE_DECISION_MISMATCH'; end if;
 perform set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000012',true);
 if public.get_government_world(g.id) is not null then
  raise exception 'WORLD_CROSSTENANT_DISCLOSURE'; end if;
end $$;
rollback;
