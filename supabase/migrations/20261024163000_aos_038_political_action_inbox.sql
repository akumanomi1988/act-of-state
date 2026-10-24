-- AOS-038. Server-owned, authenticated political activity inbox.
-- Tasks are a projection of authoritative game records, never client supplied.
create table public.match_inbox_reads (
 match_id uuid not null,
 user_id uuid not null,
 task_key text not null check(length(task_key) between 3 and 160),
 read_at timestamptz not null default now(),
 primary key(match_id,user_id,task_key),
 foreign key(match_id,user_id) references public.match_players(match_id,user_id) on delete cascade
);
create index match_inbox_user_idx on public.match_inbox_reads(user_id,match_id,read_at desc);
alter table public.match_inbox_reads enable row level security;
revoke all on public.match_inbox_reads from public,anon,authenticated;

create function public.get_match_action_inbox(p_match_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
 v_user uuid:=auth.uid();
 v_match public.matches%rowtype;
 v_me public.match_players%rowtype;
 v_day date:=(now() at time zone 'UTC')::date;
 v_week date;
 v_row record;
 v_items jsonb:='[]'::jsonb;
 v_key text;
 v_unread integer:=0;
 v_seen boolean;
begin
 if v_user is null then raise exception 'MATCH_FORBIDDEN' using errcode='42501'; end if;
 select * into v_match from public.matches where id=p_match_id;
 select * into v_me from public.match_players where match_id=p_match_id and user_id=v_user;
 if v_match.id is null or v_me.user_id is null then
  raise exception 'MATCH_FORBIDDEN' using errcode='42501'; end if;
 v_week:=v_day-(extract(isodow from v_day)::integer-1);

 -- Never send host-only activation to opposition, or ready check to active games.
 if v_match.status='lobby' then
  if not v_me.is_ready then
   v_key:='ready:'||p_match_id::text;
   select exists(select 1 from public.match_inbox_reads r
     where r.match_id=p_match_id and r.user_id=v_user and r.task_key=v_key) into v_seen;
   v_items:=v_items||jsonb_build_array(jsonb_build_object(
     'key',v_key,'kind','action','section','lobby','title','Confirma la preparación de tu partido',
     'detail','Tu partido todavía no ha confirmado que está listo para comenzar.',
     'read',v_seen,'dossierId',null));
   if not v_seen then v_unread:=v_unread+1; end if;
  end if;
  if v_match.host_user_id=v_user and (select count(*) from public.match_players
    where match_id=p_match_id)>=2 and (not v_match.readiness_required or
    not exists(select 1 from public.match_players where match_id=p_match_id
      and not is_ready)) then
   v_key:='start:'||p_match_id::text;
   select exists(select 1 from public.match_inbox_reads r
     where r.match_id=p_match_id and r.user_id=v_user and r.task_key=v_key) into v_seen;
   v_items:=v_items||jsonb_build_array(jsonb_build_object(
     'key',v_key,'kind','action','section','lobby','title','La legislatura puede comenzar',
     'detail','Los requisitos para activar la asamblea están cumplidos.',
     'read',v_seen,'dossierId',null));
   if not v_seen then v_unread:=v_unread+1; end if;
  end if;
 else
  -- Every party gets its own pending parliamentary and confidence ballots.
  for v_row in select b.id,b.dossier_id,d.title,b.closes_at
    from public.parliament_bills b
    join public.dossiers d on d.id=b.dossier_id and d.version=b.dossier_version
    where b.match_id=p_match_id and b.status='open' and b.closes_at>now()
      and not exists(select 1 from public.parliament_votes v
        where v.bill_id=b.id and v.user_id=v_user)
    order by b.closes_at,b.id limit 10
  loop
   v_key:='parliament:'||v_row.id;
   select exists(select 1 from public.match_inbox_reads r
     where r.match_id=p_match_id and r.user_id=v_user and r.task_key=v_key) into v_seen;
   v_items:=v_items||jsonb_build_array(jsonb_build_object(
     'key',v_key,'kind','action','section','parliament',
     'title','Votación parlamentaria pendiente',
     'detail',v_row.title,'dossierId',v_row.dossier_id,'read',v_seen));
   if not v_seen then v_unread:=v_unread+1; end if;
  end loop;

  for v_row in select m.id,m.closes_at
   from public.match_confidence_motions m where m.match_id=p_match_id
    and m.status='open' and m.closes_at>now()
    and not exists(select 1 from public.match_confidence_votes v
      where v.motion_id=m.id and v.user_id=v_user)
   order by m.closes_at limit 2
  loop
   v_key:='confidence:'||v_row.id;
   select exists(select 1 from public.match_inbox_reads r
    where r.match_id=p_match_id and r.user_id=v_user and r.task_key=v_key) into v_seen;
   v_items:=v_items||jsonb_build_array(jsonb_build_object(
    'key',v_key,'kind','action','section','governance',
    'title','Voto de confianza pendiente',
    'detail','Existe una moción de confianza que requiere el voto de tu partido.',
    'dossierId',null,'read',v_seen));
   if not v_seen then v_unread:=v_unread+1; end if;
  end loop;

  for v_row in select p.party_name
   from public.match_coalition_members c
   join public.match_players p on p.match_id=c.match_id and p.user_id=c.leader_id
   where c.match_id=p_match_id and c.user_id=v_user and c.status='invited'
   limit 1
  loop
   v_key:='coalition:'||p_match_id::text;
   select exists(select 1 from public.match_inbox_reads r
    where r.match_id=p_match_id and r.user_id=v_user and r.task_key=v_key) into v_seen;
   v_items:=v_items||jsonb_build_array(jsonb_build_object(
    'key',v_key,'kind','action','section','governance',
    'title','Invitación de coalición pendiente','detail','Invitación recibida de '||v_row.party_name,
    'dossierId',null,'read',v_seen));
   if not v_seen then v_unread:=v_unread+1; end if;
  end loop;

  -- Pending party stance: only live, approved dossiers, never editorial drafts.
  for v_row in select d.id,d.title
   from public.dossiers d
   where (d.available_from is null or d.available_from<=v_day)
    and (d.available_until is null or d.available_until>=v_day)
    and (d.release_kind='intro' or exists(select 1 from public.weekly_releases r
      where r.week_start=d.available_from and r.state='approved'
        and r.week_start<=v_day))
    and not exists(select 1 from public.match_stances s
      where s.match_id=p_match_id and s.user_id=v_user and s.dossier_id=d.id)
   order by d.available_from desc nulls last,d.id limit 10
  loop
   v_key:='stance:'||v_row.id;
   select exists(select 1 from public.match_inbox_reads r
    where r.match_id=p_match_id and r.user_id=v_user and r.task_key=v_key) into v_seen;
   v_items:=v_items||jsonb_build_array(jsonb_build_object(
    'key',v_key,'kind','action','section','dossiers',
    'title','Posición política pendiente','detail',v_row.title,
    'dossierId',v_row.id,'read',v_seen));
   if not v_seen then v_unread:=v_unread+1; end if;
  end loop;

  if not exists(select 1 from public.match_campaign_events e
     where e.match_id=p_match_id and e.user_id=v_user and e.week_start=v_week) then
   v_key:='campaign:'||v_week::text;
   select exists(select 1 from public.match_inbox_reads r
     where r.match_id=p_match_id and r.user_id=v_user and r.task_key=v_key) into v_seen;
   v_items:=v_items||jsonb_build_array(jsonb_build_object(
    'key',v_key,'kind','action','section','campaign',
    'title','Planifica la actividad de campaña semanal',
    'detail','Tu partido aún no ha registrado una acción territorial esta semana.',
    'dossierId',null,'read',v_seen));
   if not v_seen then v_unread:=v_unread+1; end if;
  end if;

  -- Government-only enactment notice after a *passed* parliamentary mandate.
  if v_match.host_user_id=v_user then
   for v_row in select b.id,b.dossier_id,d.title
     from public.parliament_bills b
     join public.dossiers d on d.id=b.dossier_id and d.version=b.dossier_version
     where b.match_id=p_match_id and b.status='passed'
      and (d.available_from is null or d.available_from<=v_day)
      and (d.available_until is null or d.available_until>=v_day)
      and not exists(select 1 from public.decision_events e
       where e.government_id=v_match.government_id and e.dossier_id=b.dossier_id)
     order by b.closed_at desc,b.id limit 10
   loop
    v_key:='cabinet:'||v_row.id;
    select exists(select 1 from public.match_inbox_reads r
     where r.match_id=p_match_id and r.user_id=v_user and r.task_key=v_key) into v_seen;
    v_items:=v_items||jsonb_build_array(jsonb_build_object(
     'key',v_key,'kind','action','section','dossiers',
     'title','Medida parlamentaria lista para su ejecución',
     'detail',v_row.title,'dossierId',v_row.dossier_id,'read',v_seen));
    if not v_seen then v_unread:=v_unread+1; end if;
   end loop;
  end if;

  for v_row in select c.week_start,c.decisions_resolved
    from public.match_weekly_closures c where c.match_id=p_match_id
    order by c.week_start desc limit 2
  loop
   v_key:='friday:'||v_row.week_start::text;
   select exists(select 1 from public.match_inbox_reads r
     where r.match_id=p_match_id and r.user_id=v_user and r.task_key=v_key) into v_seen;
   v_items:=v_items||jsonb_build_array(jsonb_build_object(
    'key',v_key,'kind','news','section','history','title','Acta semanal certificada',
    'detail','Cierre del '||(v_row.week_start+4)::text||': '||
      v_row.decisions_resolved||' decisiones.',
    'dossierId',null,'read',v_seen));
   if not v_seen then v_unread:=v_unread+1; end if;
  end loop;

  for v_row in select e.election_no,e.certified_on
    from public.match_elections e where e.match_id=p_match_id
    order by e.election_no desc limit 1
  loop
   v_key:='election:'||v_row.election_no::text;
   select exists(select 1 from public.match_inbox_reads r
     where r.match_id=p_match_id and r.user_id=v_user and r.task_key=v_key) into v_seen;
   v_items:=v_items||jsonb_build_array(jsonb_build_object(
    'key',v_key,'kind','news','section','election','title','Elección certificada',
    'detail','Resultado institucional del '||v_row.certified_on::text,
    'dossierId',null,'read',v_seen));
   if not v_seen then v_unread:=v_unread+1; end if;
  end loop;
 end if;
 return jsonb_build_object('matchId',p_match_id,'serverDay',v_day,
  'unreadCount',v_unread,'items',v_items);
end $$;

create function public.mark_match_inbox_read(p_match_id uuid,p_task_key text)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid();v_inbox jsonb;
begin
 if v_user is null then raise exception 'MATCH_FORBIDDEN' using errcode='42501'; end if;
 if p_task_key is null or length(p_task_key) not between 3 and 160 then
   raise exception 'INBOX_INVALID_KEY' using errcode='P0001'; end if;
 v_inbox:=public.get_match_action_inbox(p_match_id);
 if not exists(select 1 from jsonb_array_elements(v_inbox->'items') n
   where n->>'key'=p_task_key) then
   raise exception 'INBOX_TASK_NOT_FOUND' using errcode='P0001'; end if;
 insert into public.match_inbox_reads(match_id,user_id,task_key)
 values(p_match_id,v_user,p_task_key)
 on conflict(match_id,user_id,task_key) do nothing;
 return true;
end $$;
revoke all on function public.get_match_action_inbox(uuid),
 public.mark_match_inbox_read(uuid,text) from public,anon,authenticated;
grant execute on function public.get_match_action_inbox(uuid),
 public.mark_match_inbox_read(uuid,text) to authenticated;
