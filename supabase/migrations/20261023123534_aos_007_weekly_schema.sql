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

