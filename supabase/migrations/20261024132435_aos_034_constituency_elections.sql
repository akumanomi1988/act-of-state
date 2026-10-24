-- AOS-034: persistent synthetic regions and constituency-based national elections.
-- Model is fictional, deterministic, purely server-authoritative, not real voting data.
create table public.electoral_districts (
  code text primary key,
  label text not null unique,
  seats smallint not null check(seats between 1 and 100),
  sort_order smallint not null unique
);
insert into public.electoral_districts(code,label,seats,sort_order) values
 ('capital','Distrito Capital',25,1),
 ('industrial','Corredor Industrial',20,2),
 ('coastal','Región Costera',18,3),
 ('agrarian','Llanuras Agrarias',15,4),
 ('highland','Territorios de Montaña',12,5),
 ('frontier','Frontera Interior',10,6);
alter table public.electoral_districts enable row level security;
revoke all on public.electoral_districts from public,anon,authenticated;

-- The 300 persistent families retain all prior states and history.
-- Region assignment derives only from their stable household index, so it is
-- independent of signup order, tax effects, campaign influence and clock time.
alter table public.synthetic_households add column district_code text;
update public.synthetic_households h
set district_code=case
 when (h.household_no-1)%100<25 then 'capital'
 when (h.household_no-1)%100<45 then 'industrial'
 when (h.household_no-1)%100<63 then 'coastal'
 when (h.household_no-1)%100<78 then 'agrarian'
 when (h.household_no-1)%100<90 then 'highland'
 else 'frontier' end;
alter table public.synthetic_households
 alter column district_code set not null,
 add constraint synthetic_household_district_fk foreign key(district_code)
 references public.electoral_districts(code);
create index household_district_idx
 on public.synthetic_households(government_id,district_code);

-- Future creation follows the same deterministic distribution.
create or replace function game_internal.seed_synthetic_households(p_government uuid)
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
     case when n%7<5 then 'urban' else 'rural' end as settlement,
     case when (n-1)%100<25 then 'capital'
       when (n-1)%100<45 then 'industrial'
       when (n-1)%100<63 then 'coastal'
       when (n-1)%100<78 then 'agrarian'
       when (n-1)%100<90 then 'highland'
       else 'frontier' end as district_code
   from generate_series(1,300) n
   join cohorts c on ((n-1)%100)<c.ceiling
     and ((n-1)%100)>=c.ceiling-c.population_weight
 )
 insert into public.synthetic_households(
   government_id,household_no,cohort_code,residents,age_band,
   income_band,settlement,policy_preference,support,trust,district_code)
 select p_government,g.household_no,g.cohort_code,g.residents,g.age_band,
   g.income_band,g.settlement,
   greatest(0,least(100,g.ideal_policy+((g.household_no*19)%41)-20+
     case g.income_band when 'high' then 8 when 'low' then -8 else 0 end +
     case g.settlement when 'rural' then 4 else 0 end))::smallint,
   greatest(0,least(100,g.support+((g.household_no*13)%11)-5))::smallint,
   greatest(0,least(100,g.trust+((g.household_no*11)%9)-4))::smallint,
   g.district_code
 from generated g
 on conflict(government_id,household_no) do nothing;
 get diagnostics v_rows=row_count;
 return v_rows;
end $$;
revoke all on function game_internal.seed_synthetic_households(uuid)
 from public,anon,authenticated;

-- Aggregate authorized geography with exactly the same household weights.
create or replace function public.get_population_profile(p_government_id uuid)
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
   'districts',(select jsonb_agg(jsonb_build_object(
     'code',d.code,'label',d.label,'seats',d.seats) order by d.sort_order)
     from public.electoral_districts d),
   'segments',coalesce((
      with split as (
       select h.residents,h.support,h.trust,
         x.dimension,x.code from public.synthetic_households h
       cross join lateral (values
         ('age',h.age_band),('income',h.income_band),
         ('settlement',h.settlement),('cohort',h.cohort_code),
         ('district',h.district_code)
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

-- Historical acts retain their original snapshot/model version. New acts
-- receive independent constituency result snapshots, never recomputed.
alter table public.match_elections
 add column districts_snapshot jsonb not null default '[]'::jsonb;
-- D'Hondt happens independently within each territorial constituency.
-- Sample voters are weighted by residents, a performance incumbency term,
-- party policy distance and existing campaign influence by social cohort.
create or replace function public._calculate_election_projection(p_match_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_match public.matches%rowtype;
 v_parties jsonb; v_cohorts jsonb; v_districts jsonb;
begin
 select * into v_match from public.matches where id=p_match_id;
 if not found then raise exception 'MATCH_FORBIDDEN' using errcode='42501'; end if;
 if not exists(select 1 from public.population_cohorts
     where government_id=v_match.government_id) then
   raise exception 'POPULATION_NOT_INITIALIZED' using errcode='P0001'; end if;
 if (select count(*) from public.synthetic_households
     where government_id=v_match.government_id)<>300 or
    (select count(distinct district_code) from public.synthetic_households
     where government_id=v_match.government_id)<>6 then
   raise exception 'DISTRICT_POPULATION_NOT_INITIALIZED' using errcode='P0001'; end if;
 if (select sum(seats) from public.electoral_districts)<>100 then
   raise exception 'DISTRICT_SEATS_INVALID' using errcode='P0001'; end if;
 with family_scores as (
   select p.user_id,p.seat_no,p.party_name,p.manifesto_policy,
     h.household_no,h.residents,h.district_code,
     greatest(1,100-2*abs(h.policy_preference-p.manifesto_policy)
       + case when p.user_id=v_match.host_user_id
         then round((h.support-50)*0.30+(h.trust-50)*0.20)::integer
         else 0 end + coalesce(ci.influence,0))::numeric as score
   from public.match_players p cross join public.synthetic_households h
   left join public.match_campaign_influence ci
     on ci.match_id=p.match_id and ci.user_id=p.user_id
     and ci.cohort_code=h.cohort_code
   where p.match_id=p_match_id and h.government_id=v_match.government_id
 ), apportioned as (
   select *,score/sum(score) over(partition by household_no) as family_share
   from family_scores
 ), national_popular as (
   select user_id,seat_no,party_name,manifesto_policy,
     sum(residents*family_share)/sum(residents) as vote_share
   from apportioned
   group by user_id,seat_no,party_name,manifesto_policy
 ), district_popular as (
   select user_id,seat_no,party_name,district_code,
     sum(residents*family_share)/sum(residents) as vote_share
   from apportioned
   group by user_id,seat_no,party_name,district_code
 ), quotients as (
   select dp.user_id,dp.district_code,
     row_number() over(partition by dp.district_code
       order by dp.vote_share/divisor.d desc, dp.seat_no asc) as rank
   from district_popular dp
   join public.electoral_districts d on d.code=dp.district_code
   cross join lateral generate_series(1,d.seats) divisor(d)
 ), district_seats as (
   select q.user_id,q.district_code,count(*)::integer as seats
   from quotients q join public.electoral_districts d on d.code=q.district_code
   where q.rank<=d.seats group by q.user_id,q.district_code
 ), totals as (
   select user_id,sum(seats)::integer as seats
   from district_seats group by user_id
 ), district_population as (
   select h.district_code,count(*)::integer as households,
     sum(h.residents)::integer as residents
   from public.synthetic_households h
   where h.government_id=v_match.government_id group by h.district_code
 ), district_display as (
   select d.code,d.label,d.seats,d.sort_order,
     pop.households,pop.residents,
     (select jsonb_agg(jsonb_build_object(
       'userId',dp.user_id,'partyName',dp.party_name,
       'voteSharePct',round(dp.vote_share*100,2),
       'seats',coalesce(ds.seats,0)
     ) order by coalesce(ds.seats,0) desc,dp.vote_share desc,dp.seat_no)
     from district_popular dp
     left join district_seats ds on ds.district_code=dp.district_code
       and ds.user_id=dp.user_id
     where dp.district_code=d.code) as parties
   from public.electoral_districts d
   join district_population pop on pop.district_code=d.code
 )
 select
   (select jsonb_agg(jsonb_build_object(
     'userId',p.user_id,'seatNo',p.seat_no,'partyName',p.party_name,
     'manifestoPolicy',p.manifesto_policy,
     'campaignInfluenceTotal',coalesce((select sum(i.influence)
       from public.match_campaign_influence i
       where i.match_id=p_match_id and i.user_id=p.user_id),0),
     'voteSharePct',round(p.vote_share*100,2),
     'seats',coalesce(t.seats,0)
    ) order by coalesce(t.seats,0) desc,p.vote_share desc,p.seat_no)
    from national_popular p left join totals t on t.user_id=p.user_id),
   (select jsonb_agg(jsonb_build_object(
     'code',d.code,'label',d.label,'seats',d.seats,
     'households',d.households,'residents',d.residents,'parties',d.parties)
     order by d.sort_order) from district_display d)
 into v_parties,v_districts;
 select jsonb_agg(jsonb_build_object(
   'code',c.code,'weight',c.population_weight,'idealPolicy',c.ideal_policy,
   'support',c.support,'trust',c.trust) order by c.code) into v_cohorts
 from public.population_cohorts c where c.government_id=v_match.government_id;
 if v_parties is null then
   raise exception 'MATCH_REQUIRES_TWO_PLAYERS' using errcode='P0001'; end if;
 if (select coalesce(sum((p->>'seats')::integer),0)
   from jsonb_array_elements(v_parties) p)<>100 or
   (select count(*) from jsonb_array_elements(v_districts))<>6 then
   raise exception 'ELECTION_DISTRICT_APPORTIONMENT_FAILED' using errcode='P0001';
 end if;
 return jsonb_build_object('modelVersion','electoral-districts-v1',
   'householdSampleSize',300,'parties',v_parties,'cohorts',v_cohorts,
   'districts',v_districts);
end $$;
alter table public.match_elections
 alter column model_version set default 'electoral-districts-v1';

-- The autonomous calendar and manual certification share one authority.
create or replace function game_internal.certify_due_election(p_match_id uuid)
returns public.match_elections language plpgsql set search_path='' as $$
declare
  v_match public.matches%rowtype;
  v_due date; v_projection jsonb; v_winner uuid;
  v_election public.match_elections%rowtype; v_party jsonb;
  v_no integer; v_day date:=(now() at time zone 'UTC')::date;
begin
  select * into v_match from public.matches where id=p_match_id for update;
  if not found then raise exception 'MATCH_FORBIDDEN' using errcode='42501'; end if;
  if v_match.status<>'active' then
    raise exception 'MATCH_NOT_ACTIVE' using errcode='P0001'; end if;
  v_due:=public._next_election_date(p_match_id);
  if v_due is null or v_day<v_due then
    raise exception 'ELECTION_NOT_DUE' using errcode='P0001'; end if;
  if exists(select 1 from public.parliament_bills
      where match_id=p_match_id and status='open') then
    raise exception 'ELECTION_PARLIAMENT_OPEN' using errcode='P0001'; end if;
  select coalesce(max(election_no),0)+1 into v_no
    from public.match_elections where match_id=p_match_id;
  v_projection:=public._calculate_election_projection(p_match_id);
  v_winner:=(v_projection->'parties'->0->>'userId')::uuid;
  if (select sum((x->>'seats')::integer)
      from jsonb_array_elements(v_projection->'parties') x)<>100 then
    raise exception 'ELECTION_SEAT_ALLOCATION_INVALID' using errcode='P0001'; end if;
  if (select sum((d->>'seats')::integer)
      from jsonb_array_elements(v_projection->'districts') d)<>100 or
     (select sum((p->>'seats')::integer)
       from jsonb_array_elements(v_projection->'districts') d
       cross join lateral jsonb_array_elements(d->'parties') p)<>100 then
    raise exception 'ELECTION_DISTRICT_TOTAL_INVALID' using errcode='P0001';
  end if;
  insert into public.match_elections(
    match_id,election_no,scheduled_on,certified_on,incumbent_user_id,
    winner_user_id,population_snapshot,parties_snapshot,districts_snapshot)
  values(p_match_id,v_no,v_due,v_day,v_match.host_user_id,v_winner,
    v_projection->'cohorts',v_projection->'parties',v_projection->'districts')
  returning * into v_election;
  for v_party in select value from jsonb_array_elements(v_projection->'parties') loop
    update public.match_players
      set mandate_seats=(v_party->>'seats')::smallint
      where match_id=p_match_id and user_id=(v_party->>'userId')::uuid;
  end loop;
  update public.matches set host_user_id=v_winner where id=p_match_id;
  return v_election;
end $$;
