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

