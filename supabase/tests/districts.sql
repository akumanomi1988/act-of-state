-- AOS-034: territorial household allocation, access control and D'Hondt.
begin;
insert into auth.users
 (id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at)
select ('37000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 '00000000-0000-0000-0000-000000000000','authenticated','authenticated',
 'districts-'||n||'@example.invalid','',now(),now(),now()
from generate_series(1,3) n;
create temporary table district_fixture(government_id uuid,match_id uuid,invite_code text);
grant select,insert on pg_temp.district_fixture to authenticated;
set local role authenticated;
select set_config('request.jwt.claim.sub','37000000-0000-4000-8000-000000000001',true);
do $$
declare g public.governments%rowtype; m public.matches%rowtype; profile jsonb;
begin
 g:=public.start_government();
 m:=public.create_match('District Election Test','Founding Cabinet');
 if m.government_id<>g.id then raise exception 'HOST_GOVERNMENT_MISMATCH'; end if;
 profile:=public.get_population_profile(g.id);
 if (profile->>'households')::integer<>300
    or (profile->>'sampleResidents')::integer<>900
    or jsonb_array_length(profile->'districts')<>6 then
   raise exception 'DISTRICT_PROFILE_INVALID'; end if;
 if (select sum((x->>'households')::integer) from
     jsonb_array_elements(profile->'segments') x
     where x->>'dimension'='district')<>300
    or (select sum((x->>'residents')::integer) from
     jsonb_array_elements(profile->'segments') x
     where x->>'dimension'='district')<>900
    or (select sum((x->>'seats')::integer) from
     jsonb_array_elements(profile->'districts') x)<>100 then
   raise exception 'DISTRICT_POPULATION_MASS_NOT_CONSERVED'; end if;
 insert into pg_temp.district_fixture values(g.id,m.id,m.invite_code);
end $$;

select set_config('request.jwt.claim.sub','37000000-0000-4000-8000-000000000003',true);
do $$
declare f record; denied boolean:=false;
begin
 select * into f from pg_temp.district_fixture;
 begin perform public.get_population_profile(f.government_id);
 exception when sqlstate '42501' then denied:=true; end;
 if not denied then raise exception 'DISTRICT_PROFILE_CROSSTENANT_LEAK'; end if;
end $$;

select set_config('request.jwt.claim.sub','37000000-0000-4000-8000-000000000002',true);
do $$
declare f record;
begin
 select * into f from pg_temp.district_fixture;
 perform public.join_match(f.invite_code,'Reform Party');
 if jsonb_array_length(public.get_population_profile(f.government_id)->'districts')<>6
 then raise exception 'MEMBER_DISTRICT_PROFILE_UNAVAILABLE'; end if;
 perform public.set_party_manifesto(f.match_id,15);
end $$;

select set_config('request.jwt.claim.sub','37000000-0000-4000-8000-000000000001',true);
do $$
declare f record; profile jsonb; projection jsonb; replay jsonb;
 districts jsonb; national_seats int; regional_seats int;
begin
 select * into f from pg_temp.district_fixture;
 perform public.start_match(f.match_id);
 projection:=public.get_election_state(f.match_id)->'projection';
 districts:=projection->'districts';
 if projection->>'modelVersion'<>'electoral-districts-v2'
   or (projection->>'householdSampleSize')::integer<>300
   or jsonb_array_length(districts)<>6 then
   raise exception 'ELECTION_DISTRICT_VERSION_NOT_ACTIVE'; end if;
 select sum((p->>'seats')::integer) into national_seats
   from jsonb_array_elements(projection->'parties') p;
 select sum((p->>'seats')::integer) into regional_seats
   from jsonb_array_elements(districts) d
   cross join lateral jsonb_array_elements(d->'parties') p;
 if national_seats<>100 or regional_seats<>100 or
   (select sum((d->>'seats')::integer)
    from jsonb_array_elements(districts) d)<>100 then
   raise exception 'DISTRICT_SEAT_TOTAL_INVALID'; end if;
 if exists (select 1 from jsonb_array_elements(districts) d
   where (select sum((p->>'seats')::integer)
     from jsonb_array_elements(d->'parties') p)<>(d->>'seats')::integer) then
   raise exception 'DISTRICT_LOCAL_DHONDT_SUM_INVALID'; end if;
 if (select sum((d->>'households')::integer)
    from jsonb_array_elements(districts) d)<>300 or
   (select sum((d->>'residents')::integer)
    from jsonb_array_elements(districts) d)<>900 then
   raise exception 'DISTRICT_ELECTORATE_MASS_INVALID'; end if;
 profile:=public.get_population_profile(f.government_id);
 if (select (d->>'households')::integer from jsonb_array_elements(districts) d
     where d->>'code'='capital') <>
    (select (s->>'households')::integer from jsonb_array_elements(profile->'segments') s
     where s->>'dimension'='district' and s->>'code'='capital') then
   raise exception 'DISTRICT_PROFILE_ELECTION_MISMATCH'; end if;
 perform public.start_government();
 replay:=public.get_election_state(f.match_id)->'projection';
 if replay<>projection then raise exception 'ELECTION_NOT_DETERMINISTIC'; end if;
end $$;
reset role;
do $$
declare f record;
begin
 select * into f from pg_temp.district_fixture;
 if has_table_privilege('authenticated','public.electoral_districts','SELECT')
    or has_table_privilege('anon','public.synthetic_households','SELECT')
    or has_table_privilege('authenticated','public.synthetic_households','UPDATE') then
    raise exception 'DISTRICT_RLS_LEAK'; end if;
 if (select count(*) from public.synthetic_households h where h.government_id=f.government_id
   and h.district_code is not null)<>300 then
   raise exception 'DISTRICT_HOUSEHOLDS_INCOMPLETE'; end if;
 if (select count(*) from public.synthetic_households h
    where h.government_id=f.government_id
      and h.district_code<>case
        when (h.household_no-1)%100<25 then 'capital'
        when (h.household_no-1)%100<45 then 'industrial'
        when (h.household_no-1)%100<63 then 'coastal'
        when (h.household_no-1)%100<78 then 'agrarian'
        when (h.household_no-1)%100<90 then 'highland'
        else 'frontier' end)<>0 then
    raise exception 'DISTRICT_MAPPING_CHANGED'; end if;
end $$;
rollback;
