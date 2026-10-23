-- ACT OF STATE | Editorial draft persistence and role isolation.
-- Membership is provisioned out of band by a trusted Supabase operator.
create table public.editorial_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('editor','publisher')),
  created_at timestamptz not null default now()
);
create table public.editorial_weeks (
  week_start date primary key check (extract(isodow from week_start)=1),
  schema_version smallint not null default 1 check (schema_version=1),
  revision integer not null default 0 check (revision>=0),
  status text not null default 'draft' check (status in ('draft','published')),
  draft jsonb not null default '[]'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  published_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  constraint editorial_draft_shape check (
    case when jsonb_typeof(draft)='array'
      then jsonb_array_length(draft)<=10 and octet_length(draft::text)<=150000
      else false end
  ),
  constraint editorial_publication_shape check (
    (status='draft' and published_at is null and published_by is null)
    or (status='published' and published_at is not null and published_by is not null)
  )
);
alter table public.editorial_members enable row level security;
alter table public.editorial_weeks enable row level security;
revoke all on public.editorial_members, public.editorial_weeks
  from public,anon,authenticated;
grant select on public.editorial_members, public.editorial_weeks to authenticated;
create policy editorial_members_self_read on public.editorial_members
  for select to authenticated
  using (user_id=(select auth.uid()));
create policy editorial_weeks_staff_read on public.editorial_weeks
  for select to authenticated
  using (exists (
    select 1 from public.editorial_members m
    where m.user_id=(select auth.uid())
  ));
