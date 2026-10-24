-- AOS-035: staff RBAC, audit, safe role changes and last publisher defense.
begin;
insert into auth.users
 (id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at)
select ('39000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 '00000000-0000-0000-0000-000000000000','authenticated','authenticated',
 'newsroom-'||n||'@example.invalid','',now(),now(),now()
from generate_series(1,4) n;
insert into public.editorial_members(user_id,role)
values ('39000000-0000-4000-8000-000000000001','publisher');

set local role authenticated;
select set_config('request.jwt.claim.sub','39000000-0000-4000-8000-000000000002',true);
do $$
declare blocked boolean:=false;
begin
 begin perform public.get_editorial_staff();
 exception when sqlstate '42501' then blocked:=true; end;
 if not blocked then raise exception 'OUTSIDER_READ_STAFF'; end if;
 blocked:=false;
 begin perform public.manage_editorial_member('newsroom-3@example.invalid','publisher');
 exception when sqlstate '42501' then blocked:=true; end;
 if not blocked then raise exception 'OUTSIDER_GRANTED_STAFF'; end if;
 blocked:=false;
 begin perform public.get_editorial_review_state((current_date -
   (extract(isodow from current_date)::integer-1))::date);
 exception when sqlstate '42501' then blocked:=true; end;
 if not blocked then raise exception 'OUTSIDER_READ_REVIEWS'; end if;
end $$;

select set_config('request.jwt.claim.sub','39000000-0000-4000-8000-000000000001',true);
do $$
declare staff jsonb; act jsonb; failed boolean:=false;
begin
 if jsonb_array_length(public.get_editorial_staff())<>1 then
  raise exception 'BOOTSTRAP_STAFF_NOT_LISTED'; end if;
 act:=public.manage_editorial_member('NEWSROOM-2@EXAMPLE.INVALID','editor');
 if act->>'role'<>'editor' then raise exception 'EDITOR_ROLE_NOT_ASSIGNED'; end if;
 perform public.manage_editorial_member('newsroom-3@example.invalid','publisher');
 if jsonb_array_length(public.get_editorial_staff())<>3 then
  raise exception 'STAFF_NOT_LISTED_AFTER_GRANTS'; end if;
 perform public.manage_editorial_member('newsroom-3@example.invalid','publisher');
 perform public.manage_editorial_member('newsroom-1@example.invalid',null);
 if (select count(*) from public.editorial_members where role='publisher')<>1 then
  raise exception 'ROLE_REVOKE_DID_NOT_PRESERVE_PUBLISHER'; end if;
end $$;

select set_config('request.jwt.claim.sub','39000000-0000-4000-8000-000000000003',true);
do $$
declare blocked boolean:=false;
begin
 begin perform public.manage_editorial_member('newsroom-3@example.invalid',null);
 exception when sqlstate 'P0001' then blocked:=sqlerrm='EDITORIAL_LAST_PUBLISHER'; end;
 if not blocked then raise exception 'LAST_PUBLISHER_REVOKED'; end if;
 perform public.manage_editorial_member('newsroom-1@example.invalid','publisher');
 perform public.manage_editorial_member('newsroom-2@example.invalid',null);
end $$;

reset role;
do $
begin
 if (select count(*) from public.editorial_staff_audit)<>5 then
  raise exception 'STAFF_AUDIT_MISSING_EVENTS'; end if;
 if has_table_privilege('authenticated','public.editorial_staff_audit','SELECT')
    or has_table_privilege('authenticated','public.editorial_staff_audit','INSERT')
    or has_table_privilege('authenticated','public.editorial_slot_reviews','SELECT')
    or has_function_privilege('anon','public.manage_editorial_member(text,text)','EXECUTE')
    or has_function_privilege('anon','public.review_editorial_slot(date,integer,text,boolean)','EXECUTE')
 then raise exception 'EDITORIAL_STAFF_PRIVILEGES_EXPOSED'; end if;
end $$;
rollback;
