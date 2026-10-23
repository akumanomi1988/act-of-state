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

