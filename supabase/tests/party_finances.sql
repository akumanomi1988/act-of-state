-- AOS-053: immutable campaign expense, equal subsidies, authorization and retries.
begin;
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at)
select ('35000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 '00000000-0000-0000-0000-000000000000',
 'authenticated','authenticated','finance-'||n||'@example.invalid','',now(),now(),now()
from generate_series(1,3) n;
create temporary table finance_fixture(match_id uuid,gov_id uuid,invite_code text,target_code text);
grant select,insert on pg_temp.finance_fixture to authenticated;
set local role authenticated;
select set_config('request.jwt.claim.sub','35000000-0000-4000-8000-000000000001',true);

do $$
declare m public.matches%rowtype; v jsonb;
begin
 m:=public.create_match('Finance acceptance nation','Equal Funding Party');
 insert into pg_temp.finance_fixture values(m.id,m.government_id,m.invite_code,
   public.get_campaign_state(m.id)->'cohorts'->0->>'code');
 v:=public.get_party_finances(m.id);
 if v->>'active'<>'false' or (v->>'earnedCredits')::int<>0
  or (v->>'availableCredits')::int<>0 then
    raise exception 'FINANCE_LOBBY_NOT_INERT'; end if;
end $$;

do $$
declare f record; m public.matches%rowtype; v jsonb;
begin
 select * into f from pg_temp.finance_fixture;
 perform set_config('request.jwt.claim.sub','35000000-0000-4000-8000-000000000002',true);
 perform public.join_match(f.invite_code,'Opposition Reform');
 perform set_config('request.jwt.claim.sub','35000000-0000-4000-8000-000000000001',true);
 m:=public.start_match(f.match_id);
 v:=public.get_party_finances(f.match_id);
 if v->>'active'<>'true' or (v->>'availableCredits')::int<>12
  or (v->'costs'->>'policy_forum')::int<>10 then
    raise exception 'FINANCE_INITIAL_GRANT_WRONG: %',v; end if;
end $$;

do $$
declare f record; evt public.match_campaign_events%rowtype;
 retry public.match_campaign_events%rowtype; v jsonb; receipt public.match_campaign_spending%rowtype;
begin
 select * into f from pg_temp.finance_fixture;
 evt:=public.launch_campaign(f.match_id,f.target_code,'policy_forum');
 retry:=public.launch_campaign(f.match_id,f.target_code,'policy_forum');
 if evt.id<>retry.id then raise exception 'FINANCE_IDEMPOTENCY_FAILED'; end if;
 v:=public.get_party_finances(f.match_id);
 if (v->>'availableCredits')::int<>2 or (v->>'spentCredits')::int<>10
  or jsonb_array_length(v->'recentSpending')<>1 then
   raise exception 'FINANCE_SPEND_MISMATCH: %',v; end if;
 select * into receipt from public.match_campaign_spending where campaign_event_id=evt.id;
 if receipt.cost_credits<>10 or receipt.strategy<>'policy_forum' then
   raise exception 'FINANCE_RECEIPT_INVALID'; end if;
 if (select count(*) from public.match_campaign_spending where match_id=f.match_id)<>1 then
   raise exception 'FINANCE_RETRY_DOUBLE_SPEND'; end if;
end $$;

do $$
declare f record; v jsonb; blocked boolean:=false;
begin
 select * into f from pg_temp.finance_fixture;
 perform set_config('request.jwt.claim.sub','35000000-0000-4000-8000-000000000002',true);
 v:=public.get_party_finances(f.match_id);
 if (v->>'availableCredits')::int<>12 or (v->>'spentCredits')::int<>0
  or jsonb_array_length(v->'recentSpending')<>0 then
  raise exception 'FINANCE_OTHER_PARTY_NOT_ISOLATED: %',v; end if;
 perform set_config('request.jwt.claim.sub','35000000-0000-4000-8000-000000000003',true);
 begin
  perform public.get_party_finances(f.match_id);
 exception when insufficient_privilege then blocked:=true;
 end;
 if not blocked then raise exception 'FINANCE_NONMEMBER_READ_ALLOWED'; end if;
 blocked:=false;
 begin
  perform public.launch_campaign(f.match_id,f.target_code,'dialogue');
 exception when insufficient_privilege then blocked:=true;
 end;
 if not blocked then raise exception 'FINANCE_NONMEMBER_WRITE_ALLOWED'; end if;
end $$;

do $$
declare f record; blocked boolean:=false;
begin
 select * into f from pg_temp.finance_fixture;
 perform set_config('request.jwt.claim.sub','35000000-0000-4000-8000-000000000001',true);
 begin
   update public.match_campaign_spending set cost_credits=4 where match_id=f.match_id;
 exception when insufficient_privilege then blocked:=true;
 end;
 if not blocked then raise exception 'FINANCE_DIRECT_WRITE_ALLOWED'; end if;
 blocked:=false;
 begin
   perform public.launch_campaign(f.match_id,f.target_code,'dialogue');
 exception when sqlstate 'P0001' then blocked:=true;
 end;
 if not blocked then raise exception 'FINANCE_WEEKLY_QUOTA_BYPASS'; end if;
end $$;

do $$
begin
 if game_internal.party_campaign_entitlement('2026-10-26 12:00+00'::timestamptz,'2026-10-26')<>12 or
    game_internal.party_campaign_entitlement('2026-10-26 12:00+00'::timestamptz,'2026-11-02')<>16 or
    game_internal.party_campaign_entitlement('2026-10-26 12:00+00'::timestamptz,'2026-12-07')<>36 or
    game_internal.party_campaign_entitlement('2026-10-26 12:00+00'::timestamptz,'2026-10-25')<>12
 then raise exception 'FINANCE_WEEK_BOUNDARIES_WRONG'; end if;
end $$;
rollback;

