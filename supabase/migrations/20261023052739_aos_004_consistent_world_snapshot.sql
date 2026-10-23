-- ACT OF STATE | AOS-MVP-001. One statement-consistent, owner-scoped game world.
-- Verified in the dedicated Akumanomi Supabase project (2026-10-23).
create function public.get_government_world(p_government_id uuid)
returns jsonb
language sql stable security invoker set search_path = ''
as $$
  select jsonb_build_object(
    'government', to_jsonb(g),
    'gameDay', ((now() at time zone 'UTC')::date)::text,
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
      from public.population_cohorts c
      where c.government_id = g.id
    ), '[]'::jsonb),
    'events', coalesce((
      select jsonb_agg(to_jsonb(e) order by e.created_at desc, e.id)
      from public.decision_events e
      where e.government_id = g.id
    ), '[]'::jsonb)
  )
  from public.governments g
  where g.id = p_government_id
    and g.owner_id = (select auth.uid())
$$;

revoke all on function public.get_government_world(uuid)
  from public, anon, authenticated;
grant execute on function public.get_government_world(uuid)
  to authenticated;
