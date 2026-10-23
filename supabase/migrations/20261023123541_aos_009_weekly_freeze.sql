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

