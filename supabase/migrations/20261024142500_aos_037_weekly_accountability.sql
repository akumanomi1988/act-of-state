-- AOS-037: immutable weekly participation and official legislative accountability.
-- Historic releases remain readable in this member-scoped report, but are no
-- longer actionable after Friday. No scheduled/current fictional news is created.

create function game_internal.enforce_weekly_dossier_window()
returns trigger language plpgsql set search_path='' as $$
begin
 if new.release_kind='weekly' then
   new.available_until:=new.available_from+4;
 end if;
 return new;
end $$;

-- Existing approved dossiers may have been published without an end date.
-- They become historic records, never disappear from the weekly ledger.
update public.dossiers
set available_until=available_from+4
where release_kind='weekly'
  and available_until is distinct from available_from+4;

create trigger weekly_dossier_window_guard
before insert or update on public.dossiers
for each row execute function game_internal.enforce_weekly_dossier_window();

alter table public.dossiers
add constraint weekly_dossier_friday_deadline
check (release_kind<>'weekly' or available_until=available_from+4);

-- The calendar must retain approved weekly counts after Friday. With the
-- new expiry RLS, the former SECURITY INVOKER implementation would see zero
-- dossiers on Saturday and erase the week's readout. A tightly owner-scoped
-- SECURITY DEFINER read retains history while explicitly checking release
-- approval and never exposing unpublished or future slates.
create or replace function public.get_weekly_calendar(p_government_id uuid)
returns jsonb language sql stable security definer set search_path=''
as $$
  with day_clock as (
    select (now() at time zone 'UTC')::date as game_day
  ), week_clock as (
    select game_day,
      game_day - (extract(isodow from game_day)::integer-1) as week_start,
      extract(isodow from game_day)::integer as day_of_week
    from day_clock
  )
  select jsonb_build_object(
    'weekStart',w.week_start::text,
    'friday', (w.week_start+4)::text,
    'dayOfWeek',w.day_of_week,
    'fridayReached',w.day_of_week>=5,
    'weeklyTotal',(
      select count(*) from public.dossiers d
      where d.release_kind='weekly' and d.available_from=w.week_start
        and exists(select 1 from public.weekly_releases r
          where r.week_start=w.week_start and r.state='approved'
            and r.week_start<=(now() at time zone 'UTC')::date)
    ),
    'weeklyResolved',(
      select count(*) from public.decision_events e
      join public.dossiers d
        on d.id=e.dossier_id and d.version=e.dossier_version
      where e.government_id=p_government_id and d.release_kind='weekly'
        and d.available_from=w.week_start
        and exists(select 1 from public.weekly_releases r
          where r.week_start=w.week_start and r.state='approved'
            and r.week_start<=(now() at time zone 'UTC')::date)
    ),
    'weeklyTreasuryDeltaM',(
      select coalesce(sum((e.state_after->>'treasury_m_eur')::integer -
                   (e.state_before->>'treasury_m_eur')::integer),0)
      from public.decision_events e
      join public.dossiers d
        on d.id=e.dossier_id and d.version=e.dossier_version
      where e.government_id=p_government_id and d.release_kind='weekly'
        and d.available_from=w.week_start
        and exists(select 1 from public.weekly_releases r
          where r.week_start=w.week_start and r.state='approved'
            and r.week_start<=(now() at time zone 'UTC')::date)
    )
  )
  from week_clock w
  where exists (
    select 1 from public.governments g
    where g.id=p_government_id and g.owner_id=(select auth.uid())
  )
$$;

-- Indexes used by the bounded (maximum twelve weeks) accountability report.
create index match_stances_by_dossier
 on public.match_stances(match_id,dossier_id,dossier_version);
create index dossiers_week_archive_idx
 on public.dossiers(available_from,id,version) where release_kind='weekly';

create function public.get_match_weekly_accountability(
  p_match_id uuid,p_weeks integer default 8
) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
 v_actor uuid:=auth.uid();
 v_match public.matches%rowtype;
 v_today date:=(now() at time zone 'UTC')::date;
 v_monday date;
 v_first date;
 v_records jsonb;
begin
 if v_actor is null or not exists(
   select 1 from public.match_players p where p.match_id=p_match_id
   and p.user_id=v_actor
 ) then raise exception 'MATCH_FORBIDDEN' using errcode='42501'; end if;
 if p_weeks is null or p_weeks not between 1 and 12 then
   raise exception 'MATCH_WEEK_RANGE_INVALID' using errcode='P0001'; end if;
 select * into v_match from public.matches where id=p_match_id;
 if not found or v_match.status<>'active' or v_match.started_at is null then
   raise exception 'MATCH_NOT_ACTIVE' using errcode='P0001'; end if;
 v_monday:=v_today-(extract(isodow from v_today)::integer-1);
 v_first:=(v_match.started_at at time zone 'UTC')::date;
 v_first:=v_first-(extract(isodow from v_first)::integer-1);

 select coalesce(jsonb_agg(
   jsonb_build_object(
     'weekStart',w.week_start,
     'friday',w.week_start+4,
     'status',case when c.week_start is not null then 'closed'
       when w.week_start+5<=v_today then 'awaiting-settlement'
       else 'live' end,
     'published',exists(select 1 from public.weekly_releases r
       where r.week_start=w.week_start and r.state='approved'
         and r.week_start<=v_today),
     'dossiers',coalesce((
       select jsonb_agg(jsonb_build_object(
         'id',d.id,'title',d.title,'category',d.category,
         'sourceTitle',d.source_title,'sourceUrl',d.source_url,
         'decision',case when e.id is null or e.decided_on>w.week_start+4
           then null else jsonb_build_object(
             'optionId',e.option_id,'decidedOn',e.decided_on,
             'treasuryDelta',coalesce((e.state_after->>'treasury_m_eur')::integer,0)-
               coalesce((e.state_before->>'treasury_m_eur')::integer,0),
             'approval',e.state_after->>'approval','trust',e.state_after->>'trust')
           end,
         'positions',(select count(*) from public.match_stances s
           where s.match_id=p_match_id and s.dossier_id=d.id
             and s.dossier_version=d.version)::integer,
         'bill', (select jsonb_build_object(
             'status',b.status,'closesAt',b.closes_at,
             'yesVotes',(select count(*) from public.parliament_votes v
               where v.bill_id=b.id and v.choice='yes'),
             'noVotes',(select count(*) from public.parliament_votes v
               where v.bill_id=b.id and v.choice='no'),
             'abstentions',(select count(*) from public.parliament_votes v
               where v.bill_id=b.id and v.choice='abstain'))
           from public.parliament_bills b where b.match_id=p_match_id
             and b.dossier_id=d.id and b.dossier_version=d.version
           order by b.created_at desc,b.id desc limit 1)
       ) order by d.id,d.version)
       from public.dossiers d
       left join public.decision_events e on e.government_id=v_match.government_id
         and e.dossier_id=d.id and e.dossier_version=d.version
       where d.release_kind='weekly' and d.available_from=w.week_start
         and exists(select 1 from public.weekly_releases r
           where r.week_start=w.week_start and r.state='approved'
             and r.week_start<=v_today)
     ),'[]'::jsonb),
     'parties',coalesce((
       select jsonb_agg(jsonb_build_object(
         'partyName',p.party_name,'seatNo',p.seat_no,
         'positions',(select count(*) from public.match_stances s
           join public.dossiers ds on ds.id=s.dossier_id
             and ds.version=s.dossier_version
           where s.match_id=p_match_id and s.user_id=p.user_id
             and ds.release_kind='weekly'
             and ds.available_from=w.week_start),
         'votes',(select count(*) from public.parliament_votes v
           join public.parliament_bills b on b.id=v.bill_id
           join public.dossiers ds on ds.id=b.dossier_id
             and ds.version=b.dossier_version
           where v.match_id=p_match_id and v.user_id=p.user_id
             and ds.release_kind='weekly'
             and ds.available_from=w.week_start)
       ) order by p.seat_no)
       from public.match_players p where p.match_id=p_match_id
     ),'[]'::jsonb),
     'fridayAct',to_jsonb(c),
     'elections',coalesce((
       select jsonb_agg(jsonb_build_object(
         'certifiedOn',el.certified_on,'electionNo',el.election_no,
         'winnerParty',(select p.party_name from public.match_players p
           where p.match_id=p_match_id and p.user_id=el.winner_user_id)
       ) order by el.election_no)
       from public.match_elections el
       where el.match_id=p_match_id and el.certified_on
         between w.week_start and w.week_start+6
     ),'[]'::jsonb)
   ) order by w.week_start desc),'[]'::jsonb) into v_records
 from (
   select (v_monday-(i.n*7))::date as week_start
   from generate_series(0,p_weeks-1) i(n)
   where v_monday-(i.n*7)>=v_first
 ) w
 left join public.match_weekly_closures c on
   c.match_id=p_match_id and c.week_start=w.week_start;

 return jsonb_build_object('serverDay',v_today,'weeks',v_records);
end $$;

revoke all on function public.get_match_weekly_accountability(uuid,integer)
  from public,anon,authenticated;
grant execute on function public.get_match_weekly_accountability(uuid,integer)
  to authenticated;
