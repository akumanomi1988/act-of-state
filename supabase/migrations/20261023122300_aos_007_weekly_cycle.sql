-- ACT OF STATE | Governed weekly publication and institutional calendar.
-- Weekly source claims are editorial inputs; database validates completeness,
-- not the factual accuracy of third-party reporting.
create table public.weekly_releases (
  week_start date primary key
    check (extract(isodow from week_start) = 1),
  state text not null default 'draft' check (state in ('draft','approved')),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  check ((state='draft' and approved_at is null) or
         (state='approved' and approved_at is not null))
);
create index weekly_releases_state_week on public.weekly_releases(state,week_start);
alter table public.weekly_releases enable row level security;
revoke all on public.weekly_releases from public,anon,authenticated;
grant select on public.weekly_releases to authenticated;
create policy weekly_releases_published_read on public.weekly_releases
for select to authenticated using (
  state='approved' and week_start <= (now() at time zone 'UTC')::date
);

alter table public.dossiers
  add column source_url text,
  add column source_title text,
  add column source_published_at timestamptz;
alter table public.dossiers
  add constraint weekly_news_source_required check (
    release_kind <> 'weekly' or (
      source_url is not null and length(source_url) <= 2048
      and source_url ~ '^https://[^[:space:]]+$'
      and source_title is not null and length(btrim(source_title)) > 0
      and source_published_at is not null
    )
  );

drop policy dossiers_authenticated_read on public.dossiers;
create policy dossiers_authenticated_read on public.dossiers
for select to authenticated using (
  (release_kind='intro' or (
    release_kind='weekly' and exists (
      select 1 from public.weekly_releases r
      where r.week_start=available_from and r.state='approved'
    )
  ))
  and (available_from is null or available_from <= (now() at time zone 'UTC')::date)
  and (available_until is null or available_until >= (now() at time zone 'UTC')::date)
);

-- Only a trusted backend/editorial operator can approve a complete weekly slate.
create function public.approve_weekly_release(p_week_start date)
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

-- Approval freezes the slate, preventing post-publication choice manipulation.
create function public.guard_approved_weekly_dossier()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
  if TG_OP in ('UPDATE','DELETE') and OLD.release_kind='weekly' and exists (
    select 1 from public.weekly_releases r
    where r.week_start=OLD.available_from and r.state='approved'
  ) then
    raise exception 'APPROVED_WEEKLY_CONTENT_IMMUTABLE' using errcode='P0001';
  end if;
  if TG_OP in ('INSERT','UPDATE') and NEW.release_kind='weekly' and exists (
    select 1 from public.weekly_releases r
    where r.week_start=NEW.available_from and r.state='approved'
  ) then
    raise exception 'APPROVED_WEEKLY_CONTENT_IMMUTABLE' using errcode='P0001';
  end if;
  if TG_OP='DELETE' then return OLD; end if;
  return NEW;
end $$;
create trigger guard_approved_weekly_dossier
before insert or update or delete on public.dossiers
for each row execute function public.guard_approved_weekly_dossier();

create function public.guard_approved_weekly_option()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
  if TG_OP in ('UPDATE','DELETE') and exists (
    select 1 from public.dossiers d
    join public.weekly_releases r on r.week_start=d.available_from
    where d.id=OLD.dossier_id and d.version=OLD.dossier_version
    and d.release_kind='weekly' and r.state='approved'
  ) then
    raise exception 'APPROVED_WEEKLY_CONTENT_IMMUTABLE' using errcode='P0001';
  end if;
  if TG_OP in ('INSERT','UPDATE') and exists (
    select 1 from public.dossiers d
    join public.weekly_releases r on r.week_start=d.available_from
    where d.id=NEW.dossier_id and d.version=NEW.dossier_version
    and d.release_kind='weekly' and r.state='approved'
  ) then
    raise exception 'APPROVED_WEEKLY_CONTENT_IMMUTABLE' using errcode='P0001';
  end if;
  if TG_OP='DELETE' then return OLD; end if;
  return NEW;
end $$;
create trigger guard_approved_weekly_option
before insert or update or delete on public.dossier_options
for each row execute function public.guard_approved_weekly_option();

create function public.guard_approved_weekly_release()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
  if OLD.state='approved' then
    raise exception 'APPROVED_WEEKLY_RELEASE_IMMUTABLE' using errcode='P0001';
  end if;
  if TG_OP='DELETE' then return OLD; end if;
  return NEW;
end $$;
create trigger guard_approved_weekly_release
before update or delete on public.weekly_releases
for each row execute function public.guard_approved_weekly_release();

-- Defense in depth: unapproved weekly dossiers cannot generate events, even
-- through a privileged mutation path; transaction rollback undoes all effects.
create function public.validate_weekly_decision_event()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_kind text; v_monday date;
begin
  select release_kind,available_from into v_kind,v_monday
  from public.dossiers where id=NEW.dossier_id and version=NEW.dossier_version;
  if v_kind='weekly' and not exists (
    select 1 from public.weekly_releases r
    where r.week_start=v_monday and r.state='approved'
  ) then
    raise exception 'WEEKLY_RELEASE_NOT_APPROVED' using errcode='P0001';
  end if;
  return NEW;
end $$;
create trigger validate_weekly_decision_event
before insert on public.decision_events
for each row execute function public.validate_weekly_decision_event();

revoke all on function public.guard_approved_weekly_dossier() from public,anon,authenticated;
revoke all on function public.guard_approved_weekly_option() from public,anon,authenticated;
revoke all on function public.guard_approved_weekly_release() from public,anon,authenticated;
revoke all on function public.validate_weekly_decision_event() from public,anon,authenticated;

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
