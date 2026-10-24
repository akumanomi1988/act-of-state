-- AOS-035: operational newsroom with publisher accountability and approvals.
-- Existing draft/publication contracts remain compatible except for the
-- intentionally stronger ten-slot publisher review requirement.
create table public.editorial_slot_reviews (
 week_start date not null references public.editorial_weeks(week_start) on delete cascade,
 dossier_id text not null,
 revision integer not null check(revision>0),
 reviewer_id uuid not null references auth.users(id),
 reviewed_at timestamptz not null default now(),
 primary key(week_start,dossier_id)
);
alter table public.editorial_slot_reviews enable row level security;
revoke all on public.editorial_slot_reviews from public,anon,authenticated;

create table public.editorial_staff_audit (
 id bigint generated always as identity primary key,
 actor_id uuid not null references auth.users(id) on delete cascade,
 subject_id uuid not null references auth.users(id) on delete cascade,
 previous_role text,
 next_role text,
 changed_at timestamptz not null default now(),
 check(previous_role is distinct from next_role)
);
alter table public.editorial_staff_audit enable row level security;
revoke all on public.editorial_staff_audit from public,anon,authenticated;

create function public.manage_editorial_member(p_email text,p_role text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v_target uuid; v_old text;
begin
 if v_actor is null or not exists(select 1 from public.editorial_members
     where user_id=v_actor and role='publisher') then
   raise exception 'EDITORIAL_STAFF_FORBIDDEN' using errcode='42501'; end if;
 if p_email is null or length(btrim(p_email)) not between 5 and 320 or
    p_role is not null and p_role not in ('editor','publisher') then
   raise exception 'EDITORIAL_STAFF_INVALID_INPUT' using errcode='P0001'; end if;
 -- A single lock serializes role mutation and last-publisher protection.
 perform pg_catalog.pg_advisory_xact_lock(20261024035);
 select id into v_target from auth.users
 where lower(email)=lower(btrim(p_email)) and email_confirmed_at is not null;
 if v_target is null then
   raise exception 'EDITORIAL_STAFF_ACCOUNT_UNAVAILABLE' using errcode='P0001'; end if;
 select role into v_old from public.editorial_members
 where user_id=v_target for update;
 if v_old='publisher' and p_role is distinct from 'publisher'
   and (select count(*) from public.editorial_members where role='publisher')<=1 then
   raise exception 'EDITORIAL_LAST_PUBLISHER' using errcode='P0001'; end if;
 if v_old is not distinct from p_role then
   return jsonb_build_object('user_id',v_target,'role',p_role); end if;
 if p_role is null then
   delete from public.editorial_members where user_id=v_target;
 else
   if v_old is null and (select count(*) from public.editorial_members)>=25 then
     raise exception 'EDITORIAL_STAFF_LIMIT' using errcode='P0001'; end if;
   insert into public.editorial_members(user_id,role)
   values(v_target,p_role)
   on conflict(user_id) do update set role=excluded.role;
 end if;
 insert into public.editorial_staff_audit(actor_id,subject_id,previous_role,next_role)
 values(v_actor,v_target,v_old,p_role);
 return jsonb_build_object('user_id',v_target,'role',p_role);
end $$;

create function public.get_editorial_staff()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();
begin
 if v_actor is null or not exists(select 1 from public.editorial_members
    where user_id=v_actor and role='publisher') then
   raise exception 'EDITORIAL_STAFF_FORBIDDEN' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object(
   'user_id',m.user_id,'email',u.email,'role',m.role)
   order by m.role desc,u.email)
   from public.editorial_members m
   join auth.users u on u.id=m.user_id),'[]'::jsonb);
end $$;

create function public.get_editorial_review_state(p_week_start date)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();
begin
 if v_actor is null or not exists(select 1 from public.editorial_members
    where user_id=v_actor) then
   raise exception 'EDITORIAL_FORBIDDEN' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object(
  'dossier_id',r.dossier_id,'reviewed_by',r.reviewer_id,
  'reviewed_at',r.reviewed_at) order by r.dossier_id)
  from public.editorial_slot_reviews r join public.editorial_weeks w
    on w.week_start=r.week_start and w.revision=r.revision
  where r.week_start=p_week_start),'[]'::jsonb);
end $$;

-- Publisher must explicitly review a complete saved dossier. A save changes
-- the weekly revision, invalidating every previous review automatically.
create function public.review_editorial_slot(
 p_week_start date,p_expected_revision integer,p_dossier_id text,p_approved boolean
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v_week public.editorial_weeks%rowtype; v_item jsonb;
begin
 if v_actor is null or not exists(select 1 from public.editorial_members
   where user_id=v_actor and role='publisher') then
   raise exception 'EDITORIAL_PUBLISH_FORBIDDEN' using errcode='42501'; end if;
 if p_dossier_id is null or p_approved is null then
   raise exception 'EDITORIAL_INVALID_REVIEW' using errcode='P0001'; end if;
 select * into v_week from public.editorial_weeks
 where week_start=p_week_start for update;
 if not found or v_week.status<>'draft' then
   raise exception 'EDITORIAL_REVIEW_WEEK_CLOSED' using errcode='P0001'; end if;
 if v_week.revision<>p_expected_revision then
   raise exception 'EDITORIAL_REVISION_CONFLICT' using errcode='P0001'; end if;
 select d.value into v_item from jsonb_array_elements(v_week.draft) d
 where d.value->>'id'=p_dossier_id;
 if v_item is null then
   raise exception 'EDITORIAL_REVIEW_SLOT_MISSING' using errcode='P0001'; end if;
 if p_approved then
   if length(btrim(coalesce(v_item->>'title','')))<8 or
      length(btrim(coalesce(v_item->>'context','')))<40 or
      coalesce(jsonb_array_length(v_item->'options'),0)<2 or
      length(coalesce(v_item->>'source_url',''))<12 or
      coalesce(v_item->>'source_published_at','')='' then
     raise exception 'EDITORIAL_REVIEW_INCOMPLETE' using errcode='P0001'; end if;
   insert into public.editorial_slot_reviews(
      week_start,dossier_id,revision,reviewer_id)
   values(p_week_start,p_dossier_id,p_expected_revision,v_actor)
   on conflict(week_start,dossier_id) do update
    set revision=excluded.revision,reviewer_id=excluded.reviewer_id,
      reviewed_at=now();
 else
   delete from public.editorial_slot_reviews where week_start=p_week_start
    and dossier_id=p_dossier_id;
 end if;
 return jsonb_build_object('dossier_id',p_dossier_id,
   'approved',p_approved,'revision',p_expected_revision);
end $$;

revoke all on function public.manage_editorial_member(text,text),
 public.get_editorial_staff(),public.get_editorial_review_state(date),
 public.review_editorial_slot(date,integer,text,boolean)
 from public,anon,authenticated;
grant execute on function public.manage_editorial_member(text,text),
 public.get_editorial_staff(),public.get_editorial_review_state(date),
 public.review_editorial_slot(date,integer,text,boolean)
 to authenticated;

-- Ten same-revision publisher attestations are now an atomic release gate.
create or replace function public.publish_editorial_week(
  p_week_start date, p_expected_revision integer
) returns public.editorial_weeks
language plpgsql volatile security definer set search_path=''
as $$
declare
  v_user uuid := auth.uid();
  v_week public.editorial_weeks%rowtype;
  v_d jsonb; v_o jsonb; v_options jsonb;
  v_id text; v_oid text;
  v_source_at timestamptz;
  v_delta integer; v_target integer; v_intensity integer; v_trust integer;
begin
  if v_user is null or not exists (
    select 1 from public.editorial_members m
    where m.user_id=v_user and m.role='publisher'
  ) then raise exception 'EDITORIAL_PUBLISH_FORBIDDEN' using errcode='42501'; end if;
  if p_week_start is null or extract(isodow from p_week_start)<>1 or
    p_week_start < (now() at time zone 'UTC')::date -
      (extract(isodow from (now() at time zone 'UTC')::date)::integer-1) then
    raise exception 'EDITORIAL_INVALID_WEEK' using errcode='P0001';
  end if;
  select * into v_week from public.editorial_weeks
  where week_start=p_week_start for update;
  if not found then raise exception 'EDITORIAL_WEEK_NOT_FOUND' using errcode='P0001'; end if;
  if v_week.status='published' then return v_week; end if;
  if p_expected_revision is null or v_week.revision<>p_expected_revision then
    raise exception 'EDITORIAL_REVISION_CONFLICT' using errcode='P0001';
  end if;
  if jsonb_array_length(v_week.draft)<>10 or
    (select count(distinct e.value->>'id')
     from jsonb_array_elements(v_week.draft) e)<>10 then
    raise exception 'EDITORIAL_REQUIRES_TEN_DISTINCT_DOSSIERS' using errcode='P0001';
  end if;
  if (select count(*) from public.editorial_slot_reviews r
      where r.week_start=p_week_start and r.revision=v_week.revision
       and exists(select 1 from jsonb_array_elements(v_week.draft) d
                  where d.value->>'id'=r.dossier_id))<>10 then
    raise exception 'EDITORIAL_REQUIRES_TEN_REVIEWS' using errcode='P0001'; end if;
  if exists(select 1 from public.weekly_releases where week_start=p_week_start) then
    raise exception 'EDITORIAL_RELEASE_ALREADY_EXISTS' using errcode='P0001';
  end if;

  insert into public.weekly_releases(week_start) values(p_week_start);
  for v_d in select value from jsonb_array_elements(v_week.draft) loop
    v_id := v_d->>'id';
    if v_id is null or length(v_id)>100 or
      v_id !~ '^[a-z0-9-]+$' or
      left(v_id,length('weekly-'||p_week_start::text||'-')) <>
        'weekly-'||p_week_start::text||'-' then
      raise exception 'EDITORIAL_INVALID_DOSSIER_ID' using errcode='P0001';
    end if;
    if length(coalesce(v_d->>'title','')) not between 8 and 160
      or length(coalesce(v_d->>'context','')) not between 40 and 3000
      or length(coalesce(v_d->>'category','')) not between 3 and 80
      or length(coalesce(v_d->>'source_title','')) not between 5 and 300
      or length(coalesce(v_d->>'source_url',''))>2048
      or coalesce(v_d->>'source_url','') !~ '^https://[^[:space:]]+$' then
      raise exception 'EDITORIAL_INVALID_DOSSIER_CONTENT' using errcode='P0001';
    end if;
    begin
      v_source_at := (v_d->>'source_published_at')::timestamptz;
    exception when others then
      raise exception 'EDITORIAL_INVALID_SOURCE_DATE' using errcode='P0001';
    end;
    if v_source_at is null or v_source_at>now() then
      raise exception 'EDITORIAL_INVALID_SOURCE_DATE' using errcode='P0001';
    end if;
    v_options := v_d->'options';
    if coalesce(jsonb_typeof(v_options),'')<>'array' then
      raise exception 'EDITORIAL_INVALID_OPTIONS' using errcode='P0001';
    end if;
    if jsonb_array_length(v_options) not between 2 and 4 or
      (select count(distinct e.value->>'id')
       from jsonb_array_elements(v_options) e)<>jsonb_array_length(v_options) then
      raise exception 'EDITORIAL_INVALID_OPTIONS' using errcode='P0001';
    end if;

    insert into public.dossiers(
      id,version,title,context,category,release_kind,available_from,
      source_url,source_title,source_published_at
    ) values (
      v_id,1,v_d->>'title',v_d->>'context',v_d->>'category','weekly',p_week_start,
      v_d->>'source_url',v_d->>'source_title',v_source_at
    );
    for v_o in select value from jsonb_array_elements(v_options) loop
      v_oid := v_o->>'id';
      if v_oid is null or length(v_oid)>80 or
        v_oid !~ '^[a-z0-9-]+$' or
        length(coalesce(v_o->>'title','')) not between 4 and 160 or
        length(coalesce(v_o->>'description','')) not between 12 and 1500 then
        raise exception 'EDITORIAL_INVALID_OPTION_CONTENT' using errcode='P0001';
      end if;
      if coalesce(jsonb_typeof(v_o->'treasury_delta_m_eur'),'')<>'number'
        or coalesce(jsonb_typeof(v_o->'policy_target'),'')<>'number'
        or coalesce(jsonb_typeof(v_o->'response_intensity'),'')<>'number'
        or coalesce(jsonb_typeof(v_o->'trust_base_delta'),'')<>'number' then
        raise exception 'EDITORIAL_INVALID_OPTION_PARAMETERS' using errcode='P0001';
      end if;
      begin
        v_delta := (v_o->>'treasury_delta_m_eur')::integer;
        v_target := (v_o->>'policy_target')::integer;
        v_intensity := (v_o->>'response_intensity')::integer;
        v_trust := (v_o->>'trust_base_delta')::integer;
      exception when others then
        raise exception 'EDITORIAL_INVALID_OPTION_PARAMETERS' using errcode='P0001';
      end;
      if v_delta not between -12000 and 12000 or
        v_target not between 0 and 100 or
        v_intensity not between 0 and 100 or
        v_trust not between -20 and 20 then
        raise exception 'EDITORIAL_INVALID_OPTION_PARAMETERS' using errcode='P0001';
      end if;
      insert into public.dossier_options(
        dossier_id,dossier_version,id,title,description,
        treasury_delta_m_eur,policy_target,response_intensity,trust_base_delta
      ) values (
        v_id,1,v_oid,v_o->>'title',v_o->>'description',
        v_delta,v_target,v_intensity,v_trust
      );
    end loop;
  end loop;
  perform public.approve_weekly_release(p_week_start);
  update public.editorial_weeks
  set status='published',revision=revision+1,published_by=v_user,
      published_at=now(),updated_by=v_user,updated_at=now()
  where week_start=p_week_start returning * into strict v_week;
  return v_week;
end $$;
