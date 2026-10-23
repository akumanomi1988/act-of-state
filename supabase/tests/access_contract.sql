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
          'dossier_options','decision_events','weekly_releases',
          'editorial_members','editorial_weeks',
          'matches','match_players','match_stances'
        ])
        and c.relrowsecurity) <> 11 then
    raise exception 'GAME_TABLE_RLS_NOT_ENABLED';
  end if;

  if not has_table_privilege('authenticated', 'public.governments', 'SELECT')
    or not has_table_privilege('authenticated', 'public.population_cohorts', 'SELECT')
    or not has_table_privilege('authenticated', 'public.dossiers', 'SELECT')
    or not has_table_privilege('authenticated', 'public.dossier_options', 'SELECT')
    or not has_table_privilege('authenticated', 'public.decision_events', 'SELECT')
    or not has_table_privilege('authenticated', 'public.weekly_releases', 'SELECT')
    or not has_table_privilege('authenticated', 'public.editorial_members', 'SELECT')
    or not has_table_privilege('authenticated', 'public.editorial_weeks', 'SELECT')
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
    or has_table_privilege('anon', 'public.editorial_members', 'SELECT')
    or has_table_privilege('anon', 'public.editorial_weeks', 'SELECT')
    or has_table_privilege('authenticated', 'public.editorial_members', 'INSERT')
    or has_table_privilege('authenticated', 'public.editorial_members', 'UPDATE')
    or has_table_privilege('authenticated', 'public.editorial_weeks', 'INSERT')
    or has_table_privilege('authenticated', 'public.editorial_weeks', 'UPDATE')
    or has_table_privilege('authenticated', 'public.editorial_weeks', 'DELETE')
    or has_table_privilege('anon', 'public.matches', 'SELECT')
    or has_table_privilege('anon', 'public.match_players', 'SELECT')
    or has_table_privilege('anon', 'public.match_stances', 'SELECT')
    or has_table_privilege('authenticated', 'public.matches', 'SELECT')
    or has_table_privilege('authenticated', 'public.match_players', 'SELECT')
    or has_table_privilege('authenticated', 'public.match_stances', 'SELECT')
    or has_table_privilege('authenticated', 'public.matches', 'INSERT')
    or has_table_privilege('authenticated', 'public.match_players', 'INSERT')
    or has_table_privilege('authenticated', 'public.match_stances', 'INSERT')
    or has_table_privilege('authenticated', 'public.matches', 'UPDATE')
    or has_table_privilege('authenticated', 'public.match_players', 'UPDATE')
    or has_table_privilege('authenticated', 'public.match_stances', 'UPDATE')
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
    or has_function_privilege('anon', 'public.save_editorial_week(date,integer,jsonb)', 'EXECUTE')
    or has_function_privilege('anon', 'public.publish_editorial_week(date,integer)', 'EXECUTE')
    or not has_function_privilege('authenticated', 'public.save_editorial_week(date,integer,jsonb)', 'EXECUTE')
    or not has_function_privilege('authenticated', 'public.publish_editorial_week(date,integer)', 'EXECUTE')
    or has_function_privilege('anon', 'public.create_match(text,text)', 'EXECUTE')
    or has_function_privilege('anon', 'public.join_match(text,text)', 'EXECUTE')
    or has_function_privilege('anon', 'public.start_match(uuid)', 'EXECUTE')
    or has_function_privilege('anon', 'public.leave_match(uuid)', 'EXECUTE')
    or has_function_privilege('anon', 'public.list_my_matches()', 'EXECUTE')
    or has_function_privilege('anon', 'public.get_match_world(uuid)', 'EXECUTE')
    or has_function_privilege('anon', 'public.record_match_stance(uuid,text,integer,text)', 'EXECUTE')
    or not has_function_privilege('authenticated', 'public.create_match(text,text)', 'EXECUTE')
    or not has_function_privilege('authenticated', 'public.join_match(text,text)', 'EXECUTE')
    or not has_function_privilege('authenticated', 'public.start_match(uuid)', 'EXECUTE')
    or not has_function_privilege('authenticated', 'public.leave_match(uuid)', 'EXECUTE')
    or not has_function_privilege('authenticated', 'public.list_my_matches()', 'EXECUTE')
    or not has_function_privilege('authenticated', 'public.get_match_world(uuid)', 'EXECUTE')
    or not has_function_privilege('authenticated', 'public.record_match_stance(uuid,text,integer,text)', 'EXECUTE')
    then
    raise exception 'RPC_EXECUTE_PERMISSION_DRIFT';
  end if;

  raise notice 'AOS RLS and Data API privileges passed';
end
$$;
rollback;
