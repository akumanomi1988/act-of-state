-- Calendar is derived from authoritative UTC date, never from client time.
-- Friday is a visible milestone/readout, not yet a binding decision deadline.
create function public.get_weekly_calendar(p_government_id uuid)
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
      select coalesce(sum((e.parameters_snapshot->>'treasury_delta_m_eur')::integer),0)
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

create or replace function public.get_government_world(p_government_id uuid)
returns jsonb language sql stable security invoker set search_path=''
as $$
  select jsonb_build_object(
    'government', to_jsonb(g),
    'gameDay', ((now() at time zone 'UTC')::date)::text,
    'calendar', public.get_weekly_calendar(g.id),
    'dossiers', coalesce((
      select jsonb_agg(to_jsonb(d) order by d.id, d.version desc)
      from public.dossiers d
    ), '[]'::jsonb),
    'options', coalesce((
      select jsonb_agg(to_jsonb(o) order by o.dossier_id, o.dossier_version, o.id)
      from public.dossier_options o
    ), '[]'::jsonb),
    'cohorts', coalesce((
      select jsonb_agg(to_jsonb(c) order by c.code)
      from public.population_cohorts c where c.government_id=g.id
    ), '[]'::jsonb),
    'events', coalesce((
      select jsonb_agg(to_jsonb(e) order by e.created_at desc, e.id)
      from public.decision_events e where e.government_id=g.id
    ), '[]'::jsonb)
  )
  from public.governments g
  where g.id=p_government_id and g.owner_id=(select auth.uid())
$$;
revoke all on function public.get_government_world(uuid)
from public,anon,authenticated;
grant execute on function public.get_government_world(uuid) to authenticated;
