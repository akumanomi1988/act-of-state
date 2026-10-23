-- Editorial approval serialization and result-derived fiscal readout.
-- Only a trusted backend/editorial operator can approve a complete weekly slate.
create or replace function public.approve_weekly_release(p_week_start date)
returns public.weekly_releases
language plpgsql volatile security definer set search_path=''
as $$
declare
  v_release public.weekly_releases%rowtype;
  v_count integer;
  v_distinct integer;
begin
  if p_week_start is null or extract(isodow from p_week_start) <> 1 then
    raise exception 'WEEK_START_MUST_BE_MONDAY' using errcode='P0001';
  end if;
  select * into v_release from public.weekly_releases
  where week_start=p_week_start for update;
  if not found then
    raise exception 'WEEKLY_RELEASE_NOT_FOUND' using errcode='P0001';
  end if;
  if v_release.state='approved' then return v_release; end if;
  -- Serialize approval with concurrent dossier/option edits.
  -- SHARE conflicts with the ROW EXCLUSIVE locks of editorial writes.
  lock table public.dossiers, public.dossier_options in share mode;
  select count(*),count(distinct id) into v_count,v_distinct
  from public.dossiers
  where release_kind='weekly' and available_from=p_week_start;
  if v_count<>10 or v_distinct<>10 then
    raise exception 'WEEKLY_RELEASE_REQUIRES_TEN_DISTINCT_DOSSIERS'
      using errcode='P0001';
  end if;
  if exists (
    select 1 from public.dossiers d
    where d.release_kind='weekly' and d.available_from=p_week_start
    and (
      (select count(*) from public.dossier_options o
       where o.dossier_id=d.id and o.dossier_version=d.version) < 2
      or d.source_published_at > now()
    )
  ) then
    raise exception 'WEEKLY_RELEASE_INCOMPLETE_EDITORIAL_REVIEW'
      using errcode='P0001';
  end if;
  update public.weekly_releases
  set state='approved',approved_at=now()
  where week_start=p_week_start returning * into v_release;
  return v_release;
end $$;
revoke all on function public.approve_weekly_release(date)
from public,anon,authenticated;
grant execute on function public.approve_weekly_release(date) to service_role;


create or replace function public.get_weekly_calendar(p_government_id uuid)
returns jsonb language sql stable security invoker set search_path=''
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
    ),
    'weeklyResolved',(
      select count(*) from public.decision_events e
      join public.dossiers d
        on d.id=e.dossier_id and d.version=e.dossier_version
      where e.government_id=p_government_id and d.release_kind='weekly'
        and d.available_from=w.week_start
    ),
    'weeklyTreasuryDeltaM',(
      select coalesce(sum((e.state_after->>'treasury_m_eur')::integer -
                   (e.state_before->>'treasury_m_eur')::integer),0)
      from public.decision_events e
      join public.dossiers d
        on d.id=e.dossier_id and d.version=e.dossier_version
      where e.government_id=p_government_id and d.release_kind='weekly'
        and d.available_from=w.week_start
    )
  )
  from week_clock w
  where exists (
    select 1 from public.governments g
    where g.id=p_government_id and g.owner_id=(select auth.uid())
  )
$$;
revoke all on function public.get_weekly_calendar(uuid)
from public,anon,authenticated;
grant execute on function public.get_weekly_calendar(uuid) to authenticated;

