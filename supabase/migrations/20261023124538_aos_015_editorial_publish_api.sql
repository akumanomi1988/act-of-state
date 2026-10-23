-- Publish exactly ten verified-by-editorial-review dossiers as one transaction.
-- No client may provide outcomes or bypass the existing weekly approval gate.
create function public.publish_editorial_week(
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
revoke all on function public.publish_editorial_week(date,integer)
  from public,anon,authenticated;
grant execute on function public.publish_editorial_week(date,integer)
  to authenticated;
