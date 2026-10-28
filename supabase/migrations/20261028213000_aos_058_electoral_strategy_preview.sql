-- AOS-058. Read-only electoral strategy forecasts: same 300 household,
-- six-district D'Hondt calculator for committed and hypothetical programmes.
-- No historical election, campaign event, manifesto or fiscal act is mutated.
create or replace function game_internal._strategy_projection_core(p_match_id uuid,p_override_user uuid,p_override_policy smallint)
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
   select p.user_id,p.seat_no,p.party_name,(case when p.user_id=p_override_user then p_override_policy else p.manifesto_policy end),
     h.household_no,h.residents,h.district_code,
     greatest(1,100-2*abs(h.policy_preference-(case when p.user_id=p_override_user then p_override_policy else p.manifesto_policy end))
       + case when p.user_id=v_match.host_user_id
         then round((h.support-50)*0.30+(h.trust-50)*0.20)::integer
         else 0 end + case when ci.influence is null then 0 else
         game_internal.campaign_effective_influence(ci.influence,ci.updated_at,
           (now() at time zone 'UTC')::date) end)::numeric as score
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
     'campaignInfluenceTotal',coalesce((select sum(game_internal.campaign_effective_influence(i.influence,i.updated_at,
         (now() at time zone 'UTC')::date))
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
 return jsonb_build_object('modelVersion','electoral-districts-v2',
   'householdSampleSize',300,'parties',v_parties,'cohorts',v_cohorts,
   'districts',v_districts);
end $$;
revoke all on function game_internal._strategy_projection_core(uuid,uuid,smallint)
 from public,anon,authenticated;

-- Preserve established public RPC signature and existing grants.
create or replace function public._calculate_election_projection(p_match_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 return game_internal._strategy_projection_core(p_match_id,null::uuid,null::smallint);
end $$;

create function public.preview_election_strategy(p_match_id uuid,p_policy smallint)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_user uuid:=auth.uid();
 v_match public.matches%rowtype;
 v_day date:=(now() at time zone 'UTC')::date;
 v_due date;
 v_actual jsonb;v_proposed jsonb;
begin
 if v_user is null then
   raise exception 'MATCH_FORBIDDEN' using errcode='42501';end if;
 select * into v_match from public.matches where id=p_match_id;
 if not found or not exists(select 1 from public.match_players p
     where p.match_id=p_match_id and p.user_id=v_user) then
   raise exception 'MATCH_FORBIDDEN' using errcode='42501';end if;
 if p_policy is null or p_policy not between 0 and 100 then
   raise exception 'STRATEGY_INVALID_POLICY' using errcode='P0001';end if;
 if v_match.status<>'active' then
   raise exception 'STRATEGY_MATCH_NOT_ACTIVE' using errcode='P0001';end if;
 v_due:=public._next_election_date(p_match_id);
 if v_due is null or v_day>v_due-7 then
   raise exception 'STRATEGY_CAMPAIGN_CLOSED' using errcode='P0001';end if;
 v_actual:=game_internal._strategy_projection_core(p_match_id,null::uuid,null::smallint);
 v_proposed:=game_internal._strategy_projection_core(p_match_id,v_user,p_policy);
 return jsonb_build_object(
   'modelVersion','electoral-strategy-v1','matchId',p_match_id,
   'playerId',v_user,'serverDay',v_day::text,'proposedPolicy',p_policy,
   'current',v_actual,'hypothetical',v_proposed,'committed',false);
end $$;
revoke all on function public.preview_election_strategy(uuid,smallint)
 from public,anon;
grant execute on function public.preview_election_strategy(uuid,smallint)
 to authenticated;
