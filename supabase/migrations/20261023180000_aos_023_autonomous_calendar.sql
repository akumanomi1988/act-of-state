-- AOS-023: durable server-driven political calendar and parliamentary/electoral settlement.
-- Supabase Cron invokes this without browser sessions. All clock dates are UTC.
create schema if not exists game_internal;
revoke all on schema game_internal from public, anon, authenticated;

create table public.match_weekly_closures (
  match_id uuid not null references public.matches(id) on delete cascade,
  week_start date not null check (extract(isodow from week_start)=1),
  closed_at timestamptz not null default now(),
  dossiers_published smallint not null check (dossiers_published between 0 and 10),
  decisions_resolved smallint not null check (decisions_resolved between 0 and 10),
  treasury_delta_m_eur integer not null,
  treasury_at_friday_m_eur integer not null,
  approval_at_friday smallint not null check (approval_at_friday between 0 and 100),
  trust_at_friday smallint not null check (trust_at_friday between 0 and 100),
  engine_version text not null default 'friday-ledger-v1',
  primary key (match_id, week_start)
);
create index match_weekly_closures_latest
  on public.match_weekly_closures(match_id,week_start desc);
alter table public.match_weekly_closures enable row level security;
revoke all on public.match_weekly_closures from public,anon,authenticated;

create table game_internal.calendar_failures (
  event_kind text not null check(event_kind in ('parliament','election','friday')),
  entity_id uuid not null,
  attempts integer not null default 1,
  last_error text not null,
  last_attempt_at timestamptz not null default now(),
  primary key(event_kind,entity_id)
);
revoke all on game_internal.calendar_failures from public,anon,authenticated;

-- One shared implementation of parliamentary settlement for players and Cron.
create function game_internal.finalize_bill(p_bill_id uuid)
returns public.parliament_bills language plpgsql set search_path='' as $$
declare
  v_bill public.parliament_bills%rowtype;
  v_total integer; v_count integer; v_yes integer; v_no integer;
  v_pass boolean;
begin
  select * into v_bill from public.parliament_bills where id=p_bill_id for update;
  if not found then raise exception 'PARLIAMENT_BILL_NOT_FOUND' using errcode='P0001'; end if;
  if v_bill.status<>'open' then return v_bill; end if;
  select coalesce(sum(mandate_seats),0) into v_total
    from public.match_players where match_id=v_bill.match_id;
  select coalesce(sum(seat_weight),0),
         coalesce(sum(seat_weight) filter(where choice='yes'),0),
         coalesce(sum(seat_weight) filter(where choice='no'),0)
    into v_count,v_yes,v_no
    from public.parliament_votes where bill_id=p_bill_id;
  if v_yes>v_total/2 then
    v_pass:=true;
  elsif v_count>=v_total or now()>=v_bill.closes_at then
    v_pass:=v_count>=(v_total+1)/2 and v_yes>v_no;
  else
    return v_bill;
  end if;
  update public.parliament_bills
    set status=case when v_pass then 'passed' else 'rejected' end,
        closed_at=now()
    where id=p_bill_id returning * into v_bill;
  return v_bill;
end $$;

create or replace function public.finalize_parliament_bill(p_bill_id uuid)
returns public.parliament_bills language plpgsql security definer
set search_path='' as $$
declare
  v_user uuid:=auth.uid(); v_match_id uuid;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  select match_id into v_match_id from public.parliament_bills where id=p_bill_id;
  if v_match_id is null or not exists(
    select 1 from public.match_players
    where match_id=v_match_id and user_id=v_user) then
    raise exception 'MATCH_FORBIDDEN' using errcode='42501';
  end if;
  return game_internal.finalize_bill(p_bill_id);
end $$;

-- Shared authoritative election transaction. Its schema is inaccessible to API roles.
create function game_internal.certify_due_election(p_match_id uuid)
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
  insert into public.match_elections(
    match_id,election_no,scheduled_on,certified_on,incumbent_user_id,
    winner_user_id,population_snapshot,parties_snapshot)
  values(p_match_id,v_no,v_due,v_day,v_match.host_user_id,v_winner,
    v_projection->'cohorts',v_projection->'parties')
  returning * into v_election;
  for v_party in select value from jsonb_array_elements(v_projection->'parties') loop
    update public.match_players
      set mandate_seats=(v_party->>'seats')::smallint
      where match_id=p_match_id and user_id=(v_party->>'userId')::uuid;
  end loop;
  update public.matches set host_user_id=v_winner where id=p_match_id;
  return v_election;
end $$;

create or replace function public.certify_match_election(p_match_id uuid)
returns public.match_elections language plpgsql security definer
set search_path='' as $$
declare v_user uuid:=auth.uid();
begin
  if v_user is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  if not exists(select 1 from public.match_players
    where match_id=p_match_id and user_id=v_user) then
    raise exception 'MATCH_FORBIDDEN' using errcode='42501'; end if;
  return game_internal.certify_due_election(p_match_id);
end $$;

-- Immutable Friday snapshots are reconstructed from the dated decision ledger,
-- not today's mutable government state. A Friday closes on Saturday UTC.
create function game_internal.close_match_friday(p_match_id uuid,p_week_start date)
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
  if not found or v_match.status<>'active' or
     (v_match.started_at at time zone 'UTC')::date>p_week_start+4 then
    raise exception 'FRIDAY_MATCH_NOT_ACTIVE' using errcode='P0001'; end if;
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

create function game_internal.process_calendar()
returns jsonb language plpgsql set search_path='' as $$
declare
  v_bill record; v_match record; v_week date; v_last_week date;
  v_day date:=(now() at time zone 'UTC')::date;
  v_closed_bills integer:=0; v_elections integer:=0;
  v_fridays integer:=0; v_errors integer:=0;
  v_row public.parliament_bills%rowtype;
begin
  -- Time-based ballots first; elections must never leapfrog open legislation.
  for v_bill in select b.id from public.parliament_bills b
    where b.status='open' and b.closes_at<=now()
      and not exists(select 1 from game_internal.calendar_failures f
        where f.event_kind='parliament' and f.entity_id=b.id
          and f.last_attempt_at>now()-interval '1 hour')
    order by b.closes_at,b.id limit 500 for update skip locked
  loop
    begin
      v_row:=game_internal.finalize_bill(v_bill.id);
      if v_row.status<>'open' then v_closed_bills:=v_closed_bills+1; end if;
      delete from game_internal.calendar_failures
        where event_kind='parliament' and entity_id=v_bill.id;
    exception when others then
      v_errors:=v_errors+1;
      insert into game_internal.calendar_failures(event_kind,entity_id,last_error)
      values('parliament',v_bill.id,sqlerrm)
      on conflict(event_kind,entity_id) do update
      set attempts=game_internal.calendar_failures.attempts+1,
          last_error=excluded.last_error,last_attempt_at=now();
    end;
  end loop;
  -- Elections are serialized by the match row lock and immutable act key.
  for v_match in select m.id from public.matches m
    where m.status='active' and public._next_election_date(m.id)<=v_day
      and not exists(select 1 from game_internal.calendar_failures f
        where f.event_kind='election' and f.entity_id=m.id
          and f.last_attempt_at>now()-interval '1 hour')
      and not exists(select 1 from public.parliament_bills b
        where b.match_id=m.id and b.status='open')
    order by m.started_at,m.id limit 100 for update skip locked
  loop
    begin
      perform game_internal.certify_due_election(v_match.id);
      v_elections:=v_elections+1;
      delete from game_internal.calendar_failures
        where event_kind='election' and entity_id=v_match.id;
    exception when others then
      v_errors:=v_errors+1;
      insert into game_internal.calendar_failures(event_kind,entity_id,last_error)
      values('election',v_match.id,sqlerrm)
      on conflict(event_kind,entity_id) do update
      set attempts=game_internal.calendar_failures.attempts+1,
          last_error=excluded.last_error,last_attempt_at=now();
    end;
  end loop;
  -- Saturday is the first instant at which Friday's full day can be settled.
  v_last_week:=v_day-(extract(isodow from v_day)::integer-1);
  if extract(isodow from v_day)<6 then v_last_week:=v_last_week-7; end if;
  for v_match in select m.id,m.started_at from public.matches m
    where m.status='active' and m.started_at is not null
      and (m.started_at at time zone 'UTC')::date<=v_last_week+4
      and not exists(select 1 from game_internal.calendar_failures f
        where f.event_kind='friday' and f.entity_id=m.id
          and f.last_attempt_at>now()-interval '1 hour')
      and not exists(select 1 from public.match_weekly_closures c
        where c.match_id=m.id and c.week_start=v_last_week)
    order by m.started_at,m.id limit 100 for update skip locked
  loop
    v_week:=(v_match.started_at at time zone 'UTC')::date;
    v_week:=v_week-(extract(isodow from v_week)::integer-1);
    while v_week<=v_last_week loop
      begin
        if game_internal.close_match_friday(v_match.id,v_week) then
          v_fridays:=v_fridays+1; end if;
        delete from game_internal.calendar_failures
          where event_kind='friday' and entity_id=v_match.id;
      exception when others then
        v_errors:=v_errors+1;
        insert into game_internal.calendar_failures(event_kind,entity_id,last_error)
        values('friday',v_match.id,sqlerrm)
        on conflict(event_kind,entity_id) do update
        set attempts=game_internal.calendar_failures.attempts+1,
            last_error=excluded.last_error,last_attempt_at=now();
        exit;
      end;
      v_week:=v_week+7;
    end loop;
  end loop;
  return jsonb_build_object(
    'serverDay',v_day,'closedBills',v_closed_bills,
    'certifiedElections',v_elections,'fridayClosures',v_fridays,
    'errors',v_errors);
end $$;

-- Member-only calendar read model, including the latest immutable Friday act.
create function public.get_match_calendar(p_match_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
  v_user uuid:=auth.uid(); v_government_id uuid;
  v_day date:=(now() at time zone 'UTC')::date; v_monday date;
  v_published boolean; v_total integer; v_resolved integer;
  v_latest jsonb;
begin
  if v_user is null or not exists(select 1 from public.match_players
      where match_id=p_match_id and user_id=v_user) then
    raise exception 'MATCH_FORBIDDEN' using errcode='42501'; end if;
  select government_id into v_government_id from public.matches where id=p_match_id;
  v_monday:=v_day-(extract(isodow from v_day)::integer-1);
  select exists(select 1 from public.weekly_releases
    where week_start=v_monday and state='approved') into v_published;
  select count(*) into v_total from public.dossiers
    where release_kind='weekly' and available_from=v_monday and v_published;
  select count(*) into v_resolved from public.decision_events e
    join public.dossiers d on d.id=e.dossier_id and d.version=e.dossier_version
    where e.government_id=v_government_id and d.release_kind='weekly'
      and d.available_from=v_monday and v_published;
  select to_jsonb(c) into v_latest from public.match_weekly_closures c
    where c.match_id=p_match_id order by c.week_start desc limit 1;
  return jsonb_build_object(
    'gameDay',v_day,'monday',v_monday,'friday',v_monday+4,
    'fridayReached',extract(isodow from v_day)>=5,
    'weeklyPublished',v_published,'weeklyTotal',v_total,
    'weeklyResolved',v_resolved,'latestFriday',v_latest);
end $$;

revoke all on function public.get_match_calendar(uuid) from public,anon,authenticated;
grant execute on function public.get_match_calendar(uuid) to authenticated;
revoke all on function game_internal.finalize_bill(uuid),
  game_internal.certify_due_election(uuid),
  game_internal.close_match_friday(uuid,date),
  game_internal.process_calendar() from public,anon,authenticated;

-- Production Supabase offers pg_cron; disposable CI PostgreSQL does not.
-- The migration remains executable in both and auto-installs the live schedule.
do $calendar_schedule$
begin
  if exists(select 1 from pg_available_extensions where name='pg_cron') then
    execute 'create extension if not exists pg_cron with schema pg_catalog';
    perform cron.schedule('aos-calendar-v1','*/15 * * * *',
      'select game_internal.process_calendar()');
  else
    raise notice 'pg_cron unavailable: deploy an external scheduler for game_internal.process_calendar()';
  end if;
end $calendar_schedule$;
