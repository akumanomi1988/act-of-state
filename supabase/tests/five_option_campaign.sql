-- AOS-054: full five-choice persistent policy programme, authoritative signing,
-- exact retry semantics and historic option identity. Disposable rollback only.
begin;
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at)
values('54000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000',
 'authenticated','authenticated','five-option@example.invalid','',now(),now(),now());
set local role authenticated;
select set_config('request.jwt.claim.sub','54000000-0000-4000-8000-000000000001',true);

do $$
declare
 g public.governments%rowtype;
 policy record;
 e public.decision_events%rowtype;
 repeated public.decision_events%rowtype;
 total integer:=0;
 w jsonb;
begin
 g:=public.start_government();
 w:=public.get_government_world(g.id);
 if jsonb_array_length(w->'dossiers')<>31 or jsonb_array_length(w->'options')<>155 then
   raise exception 'FIVE_CHOICE_WORLD_NOT_COMPLETE'; end if;
 if (select count(*) from (
    select d.id,d.version,count(*) c,count(distinct o.id) variants,
      count(distinct o.policy_target) distinct_positions,min(length(o.description)) short
    from public.dossiers d join public.dossier_options o
    on o.dossier_id=d.id and o.dossier_version=d.version
    where d.release_kind='intro'
    group by d.id,d.version
  ) x where x.c<>5 or x.variants<>5 or x.distinct_positions<4 or x.short<40)<>0 then
   raise exception 'FIVE_CHOICE_QUALITY_REGRESSION'; end if;
 -- Every new authoritative fifth option can be signed and replayed in a
 -- single account; each permanent dossier remains one logical immutable act.
 for policy in select d.id,o.id as option_id,o.treasury_delta_m_eur as cost
    from public.dossiers d join public.dossier_options o
     on o.dossier_id=d.id and o.dossier_version=d.version
    where d.release_kind='intro' and o.id='levy-'||d.id
    order by d.id
 loop
   e:=public.submit_decision(g.id,policy.id,1,policy.option_id);
   repeated:=public.submit_decision(g.id,policy.id,1,policy.option_id);
   if repeated.id<>e.id or e.option_id<>policy.option_id
      or (e.state_after->>'treasury_m_eur')::integer-
         (e.state_before->>'treasury_m_eur')::integer<>policy.cost then
     raise exception 'FIVE_CHOICE_AUTHORITATIVE_SIGN_RETRY_FAILED: %',policy.id;
   end if;
   total:=total+1;
 end loop;
 if total<>28 then raise exception 'FIVE_CHOICE_NOT_ALL_PLAYABLE %',total; end if;
 if jsonb_array_length(public.get_government_world(g.id)->'events')<>28 then
   raise exception 'FIVE_CHOICE_SIGNED_HISTORY_INCOMPLETE'; end if;
end $$;
rollback;

