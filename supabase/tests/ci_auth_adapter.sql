-- CI-only compatibility adapter for plain PostgreSQL.
-- This is NOT Supabase Auth and must never be applied to the cloud project.
-- It preserves the database role/JWT context that game SQL functions use.
create role anon nologin;
create role authenticated nologin;

create schema auth;
create table auth.users (
  id uuid primary key,
  instance_id uuid not null,
  aud text not null,
  role text not null,
  email text not null unique,
  encrypted_password text not null,
  email_confirmed_at timestamptz,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create function auth.uid()
returns uuid
language sql stable
set search_path = ''
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

grant usage on schema auth to authenticated;
grant execute on function auth.uid() to authenticated;
