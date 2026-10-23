-- Verify Data API grants and RLS under a plain PostgreSQL service.
-- Execute only after the production migrations; no game data is retained.
begin;
do $$
begin
  if (select count(*)
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = any(array[
          'governments','population_cohorts','dossiers',
          'dossier_options','decision_events','weekly_releases'
        ])
        and c.relrowsecurity) <> 6 then
    raise exception 'GAME_TABLE_RLS_NOT_ENABLED';
  end if;

  if not has_table_privilege('authenticated', 'public.governments', 'SELECT')
    or not has_table_privilege('authenticated', 'public.population_cohorts', 'SELECT')
    or not has_table_privilege('authenticated', 'public.dossiers', 'SELECT')
    or not has_table_privilege('authenticated', 'public.dossier_options', 'SELECT')
    or not has_table_privilege('authenticated', 'public.decision_events', 'SELECT')
    or not has_table_privilege('authenticated', 'public.weekly_releases', 'SELECT')
    then
    raise exception 'AUTHENTICATED_READ_GRANT_MISSING';
  end if;

  if has_table_privilege('anon', 'public.governments', 'SELECT')
    or has_table_privilege('anon', 'public.dossiers', 'SELECT')
    or has_table_privilege('anon', 'public.decision_events', 'SELECT')
    or has_table_privilege('authenticated', 'public.governments', 'INSERT')
    or has_table_privilege('authenticated', 'public.governments', 'UPDATE')
    or has_table_privilege('authenticated', 'public.decision_events', 'INSERT')
    or has_table_privilege('authenticated', 'public.dossiers', 'UPDATE')
    or has_table_privilege('authenticated', 'public.weekly_releases', 'INSERT')
    or has_table_privilege('authenticated', 'public.weekly_releases', 'UPDATE')
    or has_table_privilege('anon', 'public.weekly_releases', 'SELECT')
    then
    raise exception 'UNEXPECTED_DATA_API_WRITE_OR_ANON_GRANT';
  end if;

  if has_function_privilege('anon', 'public.start_government()', 'EXECUTE')
    or has_function_privilege('anon', 'public.submit_decision(uuid,text,integer,text)', 'EXECUTE')
    or has_function_privilege('anon', 'public.get_government_world(uuid)', 'EXECUTE')
    or has_function_privilege('anon', 'public.get_game_day()', 'EXECUTE')
    or not has_function_privilege('authenticated', 'public.start_government()', 'EXECUTE')
    or not has_function_privilege('authenticated', 'public.submit_decision(uuid,text,integer,text)', 'EXECUTE')
    or not has_function_privilege('authenticated', 'public.get_government_world(uuid)', 'EXECUTE')
    or not has_function_privilege('authenticated', 'public.get_weekly_calendar(uuid)', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.approve_weekly_release(date)', 'EXECUTE')
    or has_function_privilege('anon', 'public.approve_weekly_release(date)', 'EXECUTE')
    or not has_function_privilege('service_role', 'public.approve_weekly_release(date)', 'EXECUTE')
    then
    raise exception 'RPC_EXECUTE_PERMISSION_DRIFT';
  end if;

  raise notice 'AOS RLS and Data API privileges passed';
end
$$;
rollback;
