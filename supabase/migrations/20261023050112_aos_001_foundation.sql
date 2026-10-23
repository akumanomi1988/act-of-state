-- ACT OF STATE | MVP foundation. Only deploy into a dedicated project.
create table public.governments (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null unique references auth.users(id) on delete cascade,
 country_name text not null default 'República de Arcadia',
 treasury_m_eur integer not null default 12000 check (treasury_m_eur >= 0),
 approval smallint not null default 50 check (approval between 0 and 100),
 trust smallint not null default 50 check (trust between 0 and 100),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table public.population_cohorts (
 id uuid primary key default gen_random_uuid(),
 government_id uuid not null references public.governments(id) on delete cascade,
 code text not null,
 label text not null,
 population_weight integer not null check (population_weight > 0),
 ideal_policy smallint not null check (ideal_policy between 0 and 100),
 support smallint not null default 50 check (support between 0 and 100),
 trust smallint not null default 50 check (trust between 0 and 100),
 unique(government_id,code)
);
create table public.dossiers (
 id text not null, version int not null check (version > 0),
 title text not null, context text not null, category text not null,
 release_kind text not null default 'intro' check(release_kind in ('intro','weekly')),
 available_from date, available_until date,
 primary key(id,version),
 check(available_until is null or available_from is null or available_until >= available_from),
 -- Weekly dossiers are always released on Monday, never without a server release date.
 constraint weekly_monday_publication check (
  release_kind <> 'weekly' or
  (available_from is not null and extract(isodow from available_from)=1)
 )
);
create table public.dossier_options (
 dossier_id text not null, dossier_version int not null, id text not null,
 title text not null, description text not null,
 treasury_delta_m_eur int not null,
 policy_target smallint not null check(policy_target between 0 and 100),
 response_intensity smallint not null check(response_intensity between 0 and 100),
 trust_base_delta smallint not null check(trust_base_delta between -20 and 20),
 primary key(dossier_id,dossier_version,id),
 foreign key(dossier_id,dossier_version) references public.dossiers(id,version)
);
create table public.decision_events (
 id uuid primary key default gen_random_uuid(),
 government_id uuid not null references public.governments(id) on delete cascade,
 dossier_id text not null, dossier_version int not null, option_id text not null,
 engine_version text not null default 'weighted-cohorts-v1',
 parameters_snapshot jsonb not null,
 decided_on date not null, state_before jsonb not null, state_after jsonb not null,
 cohort_effects jsonb not null, created_at timestamptz not null default now(),
 unique(government_id,dossier_id),
 foreign key(dossier_id,dossier_version,option_id)
 references public.dossier_options(dossier_id,dossier_version,id)
);
create index decision_history_by_government
 on public.decision_events(government_id,created_at desc);
-- Read-only Data API. Mutations only through authenticated validated RPC.
alter table public.governments enable row level security;
alter table public.population_cohorts enable row level security;
alter table public.dossiers enable row level security;
alter table public.dossier_options enable row level security;
alter table public.decision_events enable row level security;
revoke all on public.governments, public.population_cohorts,
 public.dossiers, public.dossier_options, public.decision_events
 from public, anon, authenticated;
grant select on public.governments, public.population_cohorts,
 public.dossiers, public.dossier_options, public.decision_events to authenticated;
create policy governments_owner_read on public.governments for select
 to authenticated using(owner_id=(select auth.uid()));
create policy cohorts_owner_read on public.population_cohorts for select
 to authenticated using(exists(
 select 1 from public.governments g where g.id=government_id
 and g.owner_id=(select auth.uid())));
create policy decisions_owner_read on public.decision_events for select
 to authenticated using(exists(
 select 1 from public.governments g where g.id=government_id
 and g.owner_id=(select auth.uid())));
-- Game-authoritative visibility: never disclose a scheduled dossier/options early.
create policy dossiers_authenticated_read on public.dossiers
 for select to authenticated using (
  (release_kind='intro' or
    (release_kind='weekly' and available_from is not null))
  and (available_from is null or available_from <= (now() at time zone 'UTC')::date)
  and (available_until is null or available_until >= (now() at time zone 'UTC')::date)
 );
create policy options_authenticated_read on public.dossier_options
 for select to authenticated using (
  exists (
   select 1 from public.dossiers d
   where d.id=dossier_id and d.version=dossier_version
  )
 );
-- Fictional editorial scenario, not a real-world news report.
insert into public.dossiers(id,version,title,context,category,release_kind)
values('energy-resilience',1,'Plan de resiliencia energética',
 'Un escenario ficticio: el encarecimiento de la energía presiona a hogares e industrias. Decide la prioridad de la intervención pública.',
 'Economía y energía','intro');
insert into public.dossier_options
(dossier_id,dossier_version,id,title,description,treasury_delta_m_eur,
 policy_target,response_intensity,trust_base_delta)
values
('energy-resilience',1,'household-support','Proteger a los hogares',
 'Ayudas focalizadas a hogares vulnerables con coste fiscal.',
 -1400,25,35,2),
('energy-resilience',1,'industry-investment','Incentivar la inversión',
 'Incentivos fiscales a eficiencia energética industrial.',
 -850,75,35,0),
('energy-resilience',1,'fiscal-restraint','Contener el gasto',
 'No activar nuevas ayudas y mantener margen presupuestario.',
 200,50,20,-2);

create function public.get_game_day() returns date
language sql stable security invoker set search_path=''
as $$ select (now() at time zone 'UTC')::date $$;

create function public.start_government() returns public.governments
language plpgsql volatile security definer set search_path=''
as $$
declare v_owner uuid:=auth.uid(); v_g public.governments%rowtype;
begin
 if v_owner is null then
  raise exception 'AUTH_REQUIRED' using errcode='42501';
 end if;
 insert into public.governments(owner_id) values(v_owner)
 on conflict(owner_id) do nothing;
 select * into strict v_g from public.governments where owner_id=v_owner;
 insert into public.population_cohorts(government_id,code,label,population_weight,ideal_policy)
 values
  (v_g.id,'households','Hogares y trabajadores',65,25),
  (v_g.id,'industry','Industria y emprendedores',35,75)
 on conflict(government_id,code) do nothing;
 return v_g;
end $$;

create function public.submit_decision(
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
  option_id,decided_on,state_before,state_after,cohort_effects,engine_version,parameters_snapshot)
 values(v_g.id,p_dossier_id,p_dossier_version,p_option_id,v_day,v_before,
  v_after,v_effects,'weighted-cohorts-v1',jsonb_build_object(
   'treasury_delta_m_eur',v_o.treasury_delta_m_eur,
   'policy_target',v_o.policy_target,
   'response_intensity',v_o.response_intensity,
   'trust_base_delta',v_o.trust_base_delta)) returning * into v_event;
 return v_event;
end $$;
-- SECURITY DEFINER never exposed to anonymous/public callers.
revoke all on function public.get_game_day() from public,anon,authenticated;
revoke all on function public.start_government() from public,anon,authenticated;
revoke all on function public.submit_decision(uuid,text,integer,text)
 from public,anon,authenticated;
grant execute on function public.get_game_day() to authenticated;
grant execute on function public.start_government() to authenticated;
grant execute on function public.submit_decision(uuid,text,integer,text)
 to authenticated;