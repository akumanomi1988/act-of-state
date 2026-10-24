-- AOS-030: skip pre-activation Fridays without scheduler failure.
create or replace function game_internal.close_match_friday(p_match_id uuid,p_week_start date)
returns boolean language plpgsql set search_path='' as $$
declare
  v_match public.matches%rowtype;
  v_published integer; v_decisions integer; v_delta integer;
  v_treasury integer; v_approval smallint; v_trust smallint;
  v_rows integer;
begin
  if p_week_start is null or extract(isodow from p_week_start)<>1 or
     p_week_start+5>(now() at time zone 'UTC')::date then
    raise exception 'FRIDAY_NOT_CLOSED' using errcode='P0001'; end if;
  select * into v_match from public.matches where id=p_match_id for update;
  if not found or v_match.status<>'active' then
    raise exception 'FRIDAY_MATCH_NOT_ACTIVE' using errcode='P0001'; end if;
  -- A match founded on Saturday/Sunday has no Friday to close in its first
  -- partial week. Skip it rather than poisoning the hourly failure ledger.
  if (v_match.started_at at time zone 'UTC')::date>p_week_start+4 then
    return false; end if;
  select count(*) into v_published from public.dossiers d
    join public.weekly_releases r on r.week_start=d.available_from
    where d.release_kind='weekly' and d.available_from=p_week_start
      and r.state='approved';
  select count(*),
    coalesce(sum((e.state_after->>'treasury_m_eur')::integer -
                 (e.state_before->>'treasury_m_eur')::integer),0)
    into v_decisions,v_delta
    from public.decision_events e join public.dossiers d
      on d.id=e.dossier_id and d.version=e.dossier_version
    where e.government_id=v_match.government_id and d.release_kind='weekly'
      and d.available_from=p_week_start and e.decided_on<=p_week_start+4;
  select coalesce((e.state_after->>'treasury_m_eur')::integer,12000),
         coalesce((e.state_after->>'approval')::smallint,50),
         coalesce((e.state_after->>'trust')::smallint,50)
    into v_treasury,v_approval,v_trust
    from public.decision_events e
    where e.government_id=v_match.government_id and e.decided_on<=p_week_start+4
    order by e.decided_on desc,e.created_at desc,e.id desc limit 1;
  v_treasury:=coalesce(v_treasury,12000);
  v_approval:=coalesce(v_approval,50);
  v_trust:=coalesce(v_trust,50);
  insert into public.match_weekly_closures(
    match_id,week_start,dossiers_published,decisions_resolved,
    treasury_delta_m_eur,treasury_at_friday_m_eur,
    approval_at_friday,trust_at_friday)
  values(p_match_id,p_week_start,v_published,v_decisions,v_delta,
    v_treasury,v_approval,v_trust)
  on conflict(match_id,week_start) do nothing;
  get diagnostics v_rows=row_count;
  return v_rows=1;
end $$;
