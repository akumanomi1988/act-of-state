-- AOS-058 rollback-only integration: one shared authoritative D'Hondt core,
-- member-only strategy forecasts, zero mutation and frozen-campaign denial.
begin;
insert into auth.users
(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at)
select ('66000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 '00000000-0000-0000-0000-000000000000',
 'authenticated','authenticated','strategy-'||n||'@example.invalid',
 '',now(),now(),now()
from generate_series(1,3) n;

create temporary table strategy_fixture(match_id uuid,government_id uuid,invite_code text);
grant select,insert on pg_temp.strategy_fixture to authenticated;
set local role authenticated;
select set_config('request.jwt.claim.sub','66000000-0000-4000-8000-000000000001',true);
do $fixture$
declare m public.matches%rowtype;
begin
 m:=public.create_match('Electoral strategy fixture','First Party');
 insert into pg_temp.strategy_fixture values(m.id,m.government_id,m.invite_code);
end $fixture$;
select set_config('request.jwt.claim.sub','66000000-0000-4000-8000-000000000002',true);
select public.join_match((select invite_code from pg_temp.strategy_fixture),'Second Party');
select set_config('request.jwt.claim.sub','66000000-0000-4000-8000-000000000001',true);
select public.start_match((select match_id from pg_temp.strategy_fixture));

do $member$
declare mid uuid:=(select match_id from pg_temp.strategy_fixture);
 current_state jsonb; preview jsonb; more jsonb; same jsonb;
 original_policy integer; changed boolean:=false; blocked boolean:=false;
 sum_national integer; sum_district integer;
begin
 current_state:=public.get_election_state(mid)->'projection';
 original_policy:=(select (x->>'manifestoPolicy')::integer
  from jsonb_array_elements(current_state->'parties') x
  where x->>'userId'=auth.uid()::text);
 for original_policy in select unnest(array[0,25,50,75,100]) loop
  preview:=public.preview_election_strategy(mid,original_policy::smallint);
  if preview->>'matchId'<>mid::text or
     preview->>'playerId'<>auth.uid()::text or
     preview->>'modelVersion'<>'electoral-strategy-v1' or
     preview->>'committed'<>'false' or
     preview->'current'<>current_state or
     preview->'hypothetical'->>'modelVersion'<>'electoral-districts-v2' or
     (select (x->>'manifestoPolicy')::integer
       from jsonb_array_elements(preview->'hypothetical'->'parties') x
       where x->>'userId'=auth.uid()::text)<>original_policy then
    raise exception 'STRATEGY_COMMITTED_PROJECTION_OR_LINEAGE_CHANGED';
  end if;
  sum_national:=(select sum((x->>'seats')::integer)
   from jsonb_array_elements(preview->'hypothetical'->'parties') x);
  sum_district:=(select sum((p->>'seats')::integer)
   from jsonb_array_elements(preview->'hypothetical'->'districts') d
   cross join lateral jsonb_array_elements(d->'parties') p);
  if sum_national<>100 or sum_district<>100 or
    (select count(*) from jsonb_array_elements(preview->'hypothetical'->'districts'))<>6 then
     raise exception 'STRATEGY_SEAT_MASS_NOT_CONSERVED';
  end if;
  if exists(select 1 from jsonb_array_elements(preview->'hypothetical'->'parties') p
    join lateral jsonb_array_elements(current_state->'parties') old
    on p->>'userId'=old->>'userId'
    where p->>'userId'<>auth.uid()::text and
      (p->>'manifestoPolicy')::integer<>(old->>'manifestoPolicy')::integer) then
    raise exception 'STRATEGY_MODIFIED_RIVAL_MANIFESTO';end if;
  if preview->'hypothetical'<>current_state then changed:=true;end if;
 end loop;
 if not changed then raise exception 'STRATEGY_DIFFERENT_POLICIES_HAD_NO_EFFECT';end if;
 same:=public.preview_election_strategy(mid,50);
 if same<>public.preview_election_strategy(mid,50) then
  raise exception 'STRATEGY_NONDETERMINISTIC_REPLAY';end if;
 begin perform public.preview_election_strategy(mid,-1);
 exception when sqlstate 'P0001' then blocked:=sqlerrm='STRATEGY_INVALID_POLICY';end;
 if not blocked then raise exception 'STRATEGY_NEGATIVE_POLICY_ALLOWED';end if;
 blocked:=false;
 begin perform public.preview_election_strategy(mid,101);
 exception when sqlstate 'P0001' then blocked:=sqlerrm='STRATEGY_INVALID_POLICY';end;
 if not blocked then raise exception 'STRATEGY_OUT_OF_RANGE_POLICY_ALLOWED';end if;
 blocked:=false;
 begin perform public.preview_election_strategy(mid,null);
 exception when sqlstate 'P0001' then blocked:=sqlerrm='STRATEGY_INVALID_POLICY';end;
 if not blocked then raise exception 'STRATEGY_NULL_POLICY_ALLOWED';end if;
end $member$;

-- The preview must never persist any changes in the actual game tables.
reset role;
do $read$
declare mid uuid:=(select match_id from pg_temp.strategy_fixture);
begin
 if exists(select 1 from public.match_players p
   where p.match_id=mid and p.manifesto_policy<>50) then
  raise exception 'STRATEGY_MODIFIED_SAVED_MANIFESTO';end if;
 if exists(select 1 from public.match_campaign_events e where e.match_id=mid)
 or exists(select 1 from public.match_elections e where e.match_id=mid)
 or exists(select 1 from public.decision_events d
   where d.government_id=(select government_id from pg_temp.strategy_fixture)) then
  raise exception 'STRATEGY_CREATED_GAME_ACTS';end if;
 if has_function_privilege('anon','public.preview_election_strategy(uuid,smallint)','EXECUTE')
 or has_function_privilege('authenticated',
    'game_internal._strategy_projection_core(uuid,uuid,smallint)','EXECUTE')
 or not has_function_privilege('authenticated',
    'public.preview_election_strategy(uuid,smallint)','EXECUTE') then
  raise exception 'STRATEGY_API_GRANTS_BROKEN';end if;
end $read$;

set local role authenticated;
select set_config('request.jwt.claim.sub','66000000-0000-4000-8000-000000000003',true);
do $outsider$
declare blocked boolean:=false;
begin
 begin perform public.preview_election_strategy(
  (select match_id from pg_temp.strategy_fixture),0);
 exception when sqlstate '42501' then blocked:=sqlerrm='MATCH_FORBIDDEN';end;
 if not blocked then raise exception 'STRATEGY_OUTSIDER_READ_SUCCEEDED';end if;
end $outsider$;

reset role;
-- Synthetic clock shift within a transaction only (not server time control).
update public.matches set started_at=now()-interval '88 days'
 where id=(select match_id from pg_temp.strategy_fixture);
set local role authenticated;
select set_config('request.jwt.claim.sub','66000000-0000-4000-8000-000000000001',true);
do $freeze$
declare blocked boolean:=false;
begin
 begin perform public.preview_election_strategy(
  (select match_id from pg_temp.strategy_fixture),25);
 exception when sqlstate 'P0001' then
  blocked:=sqlerrm='STRATEGY_CAMPAIGN_CLOSED';end;
 if not blocked then raise exception 'STRATEGY_FROZEN_CAMPAIGN_BYPASSED';end if;
end $freeze$;
rollback;
