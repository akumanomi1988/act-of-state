-- ACT OF STATE: historical titles remain available when dossiers expire or change.
-- Backfill existing events without changing simulated political outcomes.
alter table public.decision_events
 add column if not exists dossier_title_snapshot text,
 add column if not exists option_title_snapshot text;

update public.decision_events e
 set dossier_title_snapshot = d.title,
     option_title_snapshot = o.title
from public.dossiers d
join public.dossier_options o
 on o.dossier_id=d.id and o.dossier_version=d.version
where e.dossier_id=d.id and e.dossier_version=d.version
  and e.option_id=o.id
  and (e.dossier_title_snapshot is null or e.option_title_snapshot is null);

alter table public.decision_events
 alter column dossier_title_snapshot set not null,
 alter column option_title_snapshot set not null;

create or replace function public.submit_decision(
 p_government_id uuid,p_dossier_id text,p_dossier_version integer,p_option_id text
) returns public.decision_events
language plpgsql volatile security definer set search_path=''
as $$
declare
 v_owner uuid:=auth.uid();
 v_g public.governments%rowtype;
 v_d public.dossiers%rowtype;
 v_o public.dossier_options%rowtype;
 v_c public.population_cohorts%rowtype;
 v_event public.decision_events%rowtype;
 v_before jsonb; v_after jsonb; v_effects jsonb:='[]'::jsonb;
 v_new_support smallint; v_new_trust smallint;
 v_approval smallint; v_trust smallint;
 v_day date:=(now() at time zone 'UTC')::date;
begin
 if v_owner is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
 -- Serialize decisions within the same government.
 select * into v_g from public.governments
 where id=p_government_id and owner_id=v_owner for update;
 if not found then
  raise exception 'GOVERNMENT_NOT_FOUND_OR_FORBIDDEN' using errcode='42501';
 end if;
 -- Retried identical requests return the same persisted event.
 select * into v_event from public.decision_events
 where government_id=v_g.id and dossier_id=p_dossier_id;
 if found then
  if v_event.option_id<>p_option_id or v_event.dossier_version<>p_dossier_version then
   raise exception 'DOSSIER_ALREADY_DECIDED' using errcode='P0001';
  end if;
  return v_event;
 end if;
 select * into v_d from public.dossiers
 where id=p_dossier_id and version=p_dossier_version;
 if not found or (v_d.release_kind='weekly' and v_d.available_from is null)
 or (v_d.available_from is not null and v_day<v_d.available_from)
 or (v_d.available_until is not null and v_day>v_d.available_until) then
  raise exception 'DOSSIER_NOT_AVAILABLE' using errcode='P0001';
 end if;
 select * into v_o from public.dossier_options
 where dossier_id=p_dossier_id and dossier_version=p_dossier_version and id=p_option_id;
 if not found then raise exception 'INVALID_OPTION' using errcode='P0001'; end if;
 if v_g.treasury_m_eur+v_o.treasury_delta_m_eur<0 then
  raise exception 'INSUFFICIENT_TREASURY' using errcode='P0001';
 end if;
 v_before:=jsonb_build_object('treasury_m_eur',v_g.treasury_m_eur,
  'approval',v_g.approval,'trust',v_g.trust);
 -- Deterministic weighted cohort response. Version: weighted-cohorts-v1.
 for v_c in select * from public.population_cohorts
   where government_id=v_g.id order by code for update
 loop
  v_new_support:=greatest(0,least(100,v_c.support+
   round((50-abs(v_c.ideal_policy-v_o.policy_target))*v_o.response_intensity/100.0)::int));
  v_new_trust:=greatest(0,least(100,v_c.trust+
   round((50-abs(v_c.ideal_policy-v_o.policy_target))*v_o.response_intensity/200.0)::int+
   v_o.trust_base_delta));
  update public.population_cohorts
   set support=v_new_support,trust=v_new_trust where id=v_c.id;
  v_effects:=v_effects||jsonb_build_array(jsonb_build_object(
   'code',v_c.code,'label',v_c.label,'population_weight',v_c.population_weight,
   'support_before',v_c.support,'support_after',v_new_support,
   'trust_before',v_c.trust,'trust_after',v_new_trust));
 end loop;
 select round(sum(population_weight*support)::numeric/
   nullif(sum(population_weight),0))::smallint,
  round(sum(population_weight*trust)::numeric/
   nullif(sum(population_weight),0))::smallint
 into v_approval,v_trust from public.population_cohorts where government_id=v_g.id;
 if v_approval is null or v_trust is null then
  raise exception 'POPULATION_NOT_INITIALIZED' using errcode='P0001';
 end if;
 update public.governments
 set treasury_m_eur=treasury_m_eur+v_o.treasury_delta_m_eur,
 approval=v_approval,trust=v_trust,updated_at=now()
 where id=v_g.id returning * into v_g;
 v_after:=jsonb_build_object('treasury_m_eur',v_g.treasury_m_eur,
  'approval',v_g.approval,'trust',v_g.trust);
 insert into public.decision_events(government_id,dossier_id,dossier_version,
  option_id,decided_on,state_before,state_after,cohort_effects,engine_version,parameters_snapshot,
  dossier_title_snapshot,option_title_snapshot)
 values(v_g.id,p_dossier_id,p_dossier_version,p_option_id,v_day,v_before,
  v_after,v_effects,'weighted-cohorts-v1',jsonb_build_object(
   'treasury_delta_m_eur',v_o.treasury_delta_m_eur,
   'policy_target',v_o.policy_target,
   'response_intensity',v_o.response_intensity,
   'trust_base_delta',v_o.trust_base_delta),v_d.title,v_o.title) returning * into v_event;
 return v_event;
end $$;
revoke all on function public.submit_decision(uuid,text,integer,text)
 from public,anon,authenticated;
grant execute on function public.submit_decision(uuid,text,integer,text)
 to authenticated;
