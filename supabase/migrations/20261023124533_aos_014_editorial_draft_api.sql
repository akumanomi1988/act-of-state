-- Persist a whole editorial slate atomically with optimistic concurrency.
-- Drafts never enter playable dossier tables until publication.
create function public.save_editorial_week(
  p_week_start date, p_expected_revision integer, p_draft jsonb
) returns public.editorial_weeks
language plpgsql volatile security definer set search_path=''
as $$
declare
  v_user uuid := auth.uid();
  v_week public.editorial_weeks%rowtype;
  v_today date := (now() at time zone 'UTC')::date;
begin
  if v_user is null or not exists (
    select 1 from public.editorial_members m
    where m.user_id=v_user and m.role in ('editor','publisher')
  ) then raise exception 'EDITORIAL_FORBIDDEN' using errcode='42501'; end if;
  if p_week_start is null or extract(isodow from p_week_start)<>1
    or p_week_start < v_today-(extract(isodow from v_today)::integer-1) then
    raise exception 'EDITORIAL_INVALID_WEEK' using errcode='P0001';
  end if;
  if p_expected_revision is null or p_expected_revision<0 then
    raise exception 'EDITORIAL_INVALID_REVISION' using errcode='P0001';
  end if;
  if p_draft is null or jsonb_typeof(p_draft)<>'array' then
    raise exception 'EDITORIAL_INVALID_DRAFT' using errcode='P0001';
  end if;
  if jsonb_array_length(p_draft)>10 or octet_length(p_draft::text)>150000
    or exists (select 1 from jsonb_array_elements(p_draft) e
               where jsonb_typeof(e.value)<>'object') then
    raise exception 'EDITORIAL_DRAFT_LIMIT_EXCEEDED' using errcode='P0001';
  end if;

  insert into public.editorial_weeks(week_start,created_by,updated_by)
  values(p_week_start,v_user,v_user)
  on conflict(week_start) do nothing;
  select * into strict v_week from public.editorial_weeks
  where week_start=p_week_start for update;
  if v_week.status='published' then
    raise exception 'EDITORIAL_ALREADY_PUBLISHED' using errcode='P0001';
  end if;
  if v_week.revision<>p_expected_revision then
    raise exception 'EDITORIAL_REVISION_CONFLICT' using errcode='P0001';
  end if;
  update public.editorial_weeks
  set draft=p_draft, revision=revision+1, updated_by=v_user,updated_at=now()
  where week_start=p_week_start returning * into strict v_week;
  return v_week;
end $$;
revoke all on function public.save_editorial_week(date,integer,jsonb)
  from public,anon,authenticated;
grant execute on function public.save_editorial_week(date,integer,jsonb)
  to authenticated;
