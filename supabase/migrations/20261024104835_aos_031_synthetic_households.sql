-- AOS-031: persistent, deterministic synthetic family sample.
-- Synthetic archetypes are not real citizens, addresses, PII or political polling.
create table public.synthetic_households (
 government_id uuid not null references public.governments(id) on delete cascade,
 household_no smallint not null check(household_no between 1 and 300),
 cohort_code text not null,
 residents smallint not null check(residents between 1 and 5),
 age_band text not null check(age_band in ('young','working','senior')),
 income_band text not null check(income_band in ('low','middle','high')),
 settlement text not null check(settlement in ('urban','rural')),
 policy_preference smallint not null check(policy_preference between 0 and 100),
 support smallint not null check(support between 0 and 100),
 trust smallint not null check(trust between 0 and 100),
 model_version text not null default 'households-v1' check(model_version='households-v1'),
 primary key(government_id,household_no),
 foreign key(government_id,cohort_code)
   references public.population_cohorts(government_id,code) on delete cascade
);
create index household_cohort_idx
 on public.synthetic_households(government_id,cohort_code);
alter table public.synthetic_households enable row level security;
revoke all on public.synthetic_households from public,anon,authenticated;

create function game_internal.seed_synthetic_households(p_government uuid)
returns integer language plpgsql security definer set search_path='' as $$
declare v_rows integer;
begin
 if not exists(select 1 from public.governments g where g.id=p_government) then
   raise exception 'GOVERNMENT_NOT_FOUND' using errcode='42501'; end if;
 if (select count(*) from public.population_cohorts c where c.government_id=p_government)<2
   or (select sum(c.population_weight) from public.population_cohorts c
       where c.government_id=p_government)<>100 then
   raise exception 'HOUSEHOLD_INVALID_COHORT_WEIGHTS' using errcode='P0001'; end if;
 with cohorts as (
   select c.*,sum(c.population_weight) over(order by c.code) as ceiling
   from public.population_cohorts c where c.government_id=p_government
 ),
 generated as (
   select n as household_no,c.code as cohort_code,c.ideal_policy,c.support,c.trust,
     (1+(n*17)%5)::smallint as residents,
     case when n%10<3 then 'young' when n%10<8 then 'working'
       else 'senior' end as age_band,
     case when (n*7)%10<3 then 'low' when (n*7)%10<8 then 'middle'
       else 'high' end as income_band,
     case when n%7<5 then 'urban' else 'rural' end as settlement
   from generate_series(1,300) n
   join cohorts c on ((n-1)%100)<c.ceiling
     and ((n-1)%100)>=c.ceiling-c.population_weight
 )
 insert into public.synthetic_households(
   government_id,household_no,cohort_code,residents,age_band,
   income_band,settlement,policy_preference,support,trust)
 select p_government,g.household_no,g.cohort_code,g.residents,g.age_band,
   g.income_band,g.settlement,
   greatest(0,least(100,g.ideal_policy+((g.household_no*19)%41)-20+
     case g.income_band when 'high' then 8 when 'low' then -8 else 0 end +
     case g.settlement when 'rural' then 4 else 0 end))::smallint,
   greatest(0,least(100,g.support+((g.household_no*13)%11)-5))::smallint,
   greatest(0,least(100,g.trust+((g.household_no*11)%9)-4))::smallint
 from generated g
 on conflict(government_id,household_no) do nothing;
 get diagnostics v_rows=row_count;
 return v_rows;
end $$;
revoke all on function game_internal.seed_synthetic_households(uuid)
 from public,anon,authenticated;

-- Monetary, policy and fiscal decisions already mutate population_cohorts.
-- This trigger propagates them to household microstates atomically with bounded,
-- deterministic different sensitivities. No browser-supplied values or RNG.
create function game_internal.apply_cohort_change_to_households()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.support is distinct from old.support or new.trust is distinct from old.trust then
   update public.synthetic_households h
     set support=greatest(0,least(100,
       h.support+round((new.support-old.support)*
         (75+(h.household_no%6)*10)/100.0)::integer))::smallint,
         trust=greatest(0,least(100,
       h.trust+round((new.trust-old.trust)*
         (75+(h.household_no%6)*10)/100.0)::integer))::smallint
   where h.government_id=new.government_id and h.cohort_code=new.code;
 end if;
 return new;
end $$;
create trigger household_cohort_response
 after update of support,trust on public.population_cohorts
 for each row execute function game_internal.apply_cohort_change_to_households();
revoke all on function game_internal.apply_cohort_change_to_households()
 from public,anon,authenticated;

-- Backfill countries without rewriting historical decision snapshots.
-- Existing governments retain their authoritative treasury/cohort statistics.
do $backfill$
declare v_id uuid;
begin
 for v_id in select id from public.governments order by id loop
   perform game_internal.seed_synthetic_households(v_id);
 end loop;
end $backfill$;

-- Every new government now receives its 300 stable synthetic household agents.
create or replace function public.start_government() returns public.governments
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
 perform game_internal.seed_synthetic_households(v_g.id);
 return v_g;
end $$;

create function public.get_population_profile(p_government_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_owner uuid:=auth.uid();
begin
 if v_owner is null or not exists (
   select 1 from public.governments g
   where g.id=p_government_id and (
     g.owner_id=v_owner or exists(
       select 1 from public.matches m
       join public.match_players p on p.match_id=m.id
       where m.government_id=g.id and p.user_id=v_owner)
   )) then raise exception 'GOVERNMENT_NOT_FOUND_OR_FORBIDDEN' using errcode='42501';
 end if;
 return jsonb_build_object(
   'modelVersion','households-v1',
   'households',(select count(*) from public.synthetic_households h
     where h.government_id=p_government_id),
   'sampleResidents',(select coalesce(sum(h.residents),0)
     from public.synthetic_households h where h.government_id=p_government_id),
   'segments',coalesce((
      with split as (
       select h.residents,h.support,h.trust,
         x.dimension,x.code from public.synthetic_households h
       cross join lateral (values
         ('age',h.age_band),('income',h.income_band),
         ('settlement',h.settlement),('cohort',h.cohort_code)
       ) x(dimension,code)
       where h.government_id=p_government_id
      )
      select jsonb_agg(jsonb_build_object(
        'dimension',s.dimension,'code',s.code,
        'households',s.households,'residents',s.residents,
        'support',s.support,'trust',s.trust
      ) order by s.dimension,s.code)
      from (select dimension,code,count(*)::integer as households,
        sum(residents)::integer as residents,
        round(sum(residents*support)::numeric/nullif(sum(residents),0))::integer as support,
        round(sum(residents*trust)::numeric/nullif(sum(residents),0))::integer as trust
        from split group by dimension,code) s
   ),'[]'::jsonb)
 );
end $$;
revoke all on function public.get_population_profile(uuid) from public,anon;
grant execute on function public.get_population_profile(uuid) to authenticated;

-- Use household microstates rather than two aggregate cohorts in elections.
-- Existing electoral v1/v2 historical certificates remain immutable.
create or replace function public._calculate_election_projection(p_match_id uuid)
returns jsonb language plpgsql stable security definer set search_path to '' as $$
declare
  v_match public.matches%rowtype;
  v_parties jsonb;
  v_cohorts jsonb;
begin
  select * into v_match from public.matches where id=p_match_id;
  if not found then raise exception 'MATCH_FORBIDDEN' using errcode='42501'; end if;
  if not exists(select 1 from public.population_cohorts
      where government_id=v_match.government_id) then
    raise exception 'POPULATION_NOT_INITIALIZED' using errcode='P0001'; end if;
  if (select count(*) from public.synthetic_households h
       where h.government_id=v_match.government_id)<>300 then
    raise exception 'HOUSEHOLDS_NOT_INITIALIZED' using errcode='P0001'; end if;
  with
  family_scores as (
    select p.user_id,p.seat_no,p.party_name,p.manifesto_policy,
      h.household_no,h.residents,
      greatest(1,100-2*abs(h.policy_preference-p.manifesto_policy)
        + case when p.user_id=v_match.host_user_id
          then round((h.support-50)*0.30+(h.trust-50)*0.20)::integer
          else 0 end + coalesce(ci.influence,0))::numeric as score
    from public.match_players p
    cross join public.synthetic_households h
    left join public.match_campaign_influence ci
      on ci.match_id=p.match_id and ci.user_id=p.user_id
      and ci.cohort_code=h.cohort_code
    where p.match_id=p_match_id and h.government_id=v_match.government_id
  ),
  apportioned as (
    select *,score/sum(score) over(partition by household_no) as family_share
    from family_scores
  ),
  popular as (
    select user_id,seat_no,party_name,manifesto_policy,
      sum(residents*family_share)/nullif(sum(residents),0) as vote_share
    from apportioned
    group by user_id,seat_no,party_name,manifesto_policy
  ),
  ranked_quotients as (
    select p.user_id,
      row_number() over(order by p.vote_share/d.divisor desc,p.seat_no asc) as rank
    from popular p cross join lateral generate_series(1,100) as d(divisor)
  ),
  seats as (
    select user_id,count(*)::integer as seats
    from ranked_quotients where rank<=100 group by user_id
  )
  select jsonb_agg(jsonb_build_object(
    'userId',p.user_id,'seatNo',p.seat_no,'partyName',p.party_name,
    'manifestoPolicy',p.manifesto_policy,
    'campaignInfluenceTotal',coalesce((select sum(i.influence) from public.match_campaign_influence i
      where i.match_id=p_match_id and i.user_id=p.user_id),0),
    'voteSharePct',round(p.vote_share*100,2),
    'seats',coalesce(s.seats,0)
  ) order by coalesce(s.seats,0) desc,p.vote_share desc,p.seat_no asc)
  into v_parties from popular p left join seats s on s.user_id=p.user_id;
  select jsonb_agg(jsonb_build_object(
    'code',c.code,'weight',c.population_weight,'idealPolicy',c.ideal_policy,
    'support',c.support,'trust',c.trust
  ) order by c.code) into v_cohorts
  from public.population_cohorts c where c.government_id=v_match.government_id;
  if v_parties is null then
    raise exception 'MATCH_REQUIRES_TWO_PLAYERS' using errcode='P0001'; end if;
  return jsonb_build_object(
    'modelVersion','electoral-households-v1','householdSampleSize',300,'parties',v_parties,'cohorts',v_cohorts);
end $$;
alter table public.match_elections
  alter column model_version set default 'electoral-households-v1';
