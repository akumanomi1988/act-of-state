-- AOS-039: immutable daily snapshots of the same synthetic electoral model
-- that determines national elections; never presented as real-world polling.
create table public.match_opinion_polls (
 match_id uuid not null references public.matches(id) on delete cascade,
 poll_day date not null,
 captured_at timestamptz not null default now(),
 model_version text not null check(model_version in
  ('electoral-cohorts-v1','electoral-cohorts-v2','electoral-households-v1',
   'electoral-districts-v1')),
 projection jsonb not null check (
  jsonb_typeof(projection)='object' and
  jsonb_typeof(projection->'parties')='array'),
 primary key(match_id,poll_day)
);
alter table public.match_opinion_polls enable row level security;
revoke all on public.match_opinion_polls from public,anon,authenticated;

create function game_internal.guard_opinion_poll_immutable()
returns trigger language plpgsql set search_path='' as $$
begin
 raise exception 'OPINION_POLL_IMMUTABLE' using errcode='23514';
end $$;
create trigger opinion_poll_immutable before update or delete
 on public.match_opinion_polls for each row
 execute function game_internal.guard_opinion_poll_immutable();

create table game_internal.opinion_poll_failures (
 match_id uuid not null references public.matches(id) on delete cascade,
 poll_day date not null,
 last_error text not null,
 attempted_at timestamptz not null default now(),
 attempts integer not null default 1,
 primary key(match_id,poll_day)
);
revoke all on game_internal.opinion_poll_failures from public,anon,authenticated;

-- Only the trusted calendar worker calls this. Lock matches before reading
-- state so policy, campaigns and election certification cannot race capture.
create function game_internal.capture_match_opinion_poll(p_match_id uuid)
returns boolean language plpgsql set search_path='' as $$
declare
 v_match public.matches%rowtype;
 v_day date:=(now() at time zone 'UTC')::date;
 v_projection jsonb;
begin
 select * into v_match from public.matches where id=p_match_id for update;
 if not found or v_match.status<>'active' or v_match.started_at is null or
   (v_match.started_at at time zone 'UTC')::date>v_day then
   return false;
 end if;
 if exists(select 1 from public.match_opinion_polls
   where match_id=p_match_id and poll_day=v_day) then
   return false;
 end if;
 v_projection:=public._calculate_election_projection(p_match_id);
 if jsonb_typeof(v_projection->'parties')<>'array' or
    jsonb_array_length(v_projection->'parties')<2 then
   raise exception 'OPINION_POLL_INVALID_MODEL' using errcode='P0001';
 end if;
 insert into public.match_opinion_polls(
  match_id,poll_day,model_version,projection
 ) values(p_match_id,v_day,v_projection->>'modelVersion',v_projection);
 return true;
end $$;
revoke all on function game_internal.capture_match_opinion_poll(uuid),
 game_internal.guard_opinion_poll_immutable() from public,anon,authenticated;

-- Keep the existing calendar/fiscal engine as a single trusted scheduler.
-- Capture only today's state: never reconstruct past days from today's voters.
alter function game_internal.process_calendar()
 rename to process_calendar_before_opinion_polls;

create function game_internal.process_calendar()
returns jsonb language plpgsql set search_path='' as $$
declare
 v_base jsonb;
 v_day date:=(now() at time zone 'UTC')::date;
 v_match record;
 v_captured integer:=0;
 v_errors integer:=0;
begin
 v_base:=game_internal.process_calendar_before_opinion_polls();
 for v_match in
  select m.id from public.matches m
   where m.status='active' and m.started_at is not null
    and (m.started_at at time zone 'UTC')::date<=v_day
    and not exists(select 1 from public.match_opinion_polls p
      where p.match_id=m.id and p.poll_day=v_day)
    and not exists(select 1 from game_internal.opinion_poll_failures f
      where f.match_id=m.id and f.poll_day=v_day
       and f.attempted_at>now()-interval '15 minutes')
   order by m.started_at,m.id limit 200
 loop
  begin
   if game_internal.capture_match_opinion_poll(v_match.id) then
    v_captured:=v_captured+1;
   end if;
   delete from game_internal.opinion_poll_failures
    where match_id=v_match.id and poll_day=v_day;
  exception when others then
   v_errors:=v_errors+1;
   insert into game_internal.opinion_poll_failures(
    match_id,poll_day,last_error
   ) values(v_match.id,v_day,left(sqlerrm,1000))
   on conflict(match_id,poll_day) do update
    set last_error=excluded.last_error,attempted_at=now(),
     attempts=game_internal.opinion_poll_failures.attempts+1;
  end;
 end loop;
 return v_base||jsonb_build_object('opinionPollsCaptured',v_captured,
  'opinionPollErrors',v_errors);
end $$;
revoke all on function game_internal.process_calendar(),
 game_internal.process_calendar_before_opinion_polls()
 from public,anon,authenticated;

-- Narrow, member-only historical projection; no direct access to poll rows.
create function public.get_match_opinion_history(
 p_match_id uuid,p_days integer default 30
) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
 v_user uuid:=auth.uid();
 v_day date:=(now() at time zone 'UTC')::date;
 v_from date;
 v_first date;
 v_polls jsonb;
 v_count integer;
begin
 if v_user is null or not exists(select 1 from public.match_players
  where match_id=p_match_id and user_id=v_user) then
  raise exception 'MATCH_FORBIDDEN' using errcode='42501';
 end if;
 if p_days is null or p_days not between 7 and 90 then
  raise exception 'OPINION_HISTORY_INVALID_WINDOW' using errcode='P0001';
 end if;
 select (m.started_at at time zone 'UTC')::date into v_first
  from public.matches m where m.id=p_match_id;
 v_from:=greatest(v_day-(p_days-1),coalesce(v_first,v_day));
 select coalesce(jsonb_agg(jsonb_build_object(
   'day',p.poll_day,'capturedAt',p.captured_at,
   'modelVersion',p.model_version,
   'householdSampleSize',p.projection->'householdSampleSize',
   'parties',p.projection->'parties',
   'districts',coalesce(p.projection->'districts','[]'::jsonb)
  ) order by p.poll_day),'[]'::jsonb),count(*)
 into v_polls,v_count
 from public.match_opinion_polls p where p.match_id=p_match_id
  and p.poll_day between v_from and v_day;
 return jsonb_build_object('matchId',p_match_id,'serverDay',v_day,
   'fromDay',v_from,'days',p_days,'recordedDays',v_count,
   'expectedDays',greatest(0,v_day-v_from+1),
   'polls',v_polls);
end $$;
revoke all on function public.get_match_opinion_history(uuid,integer)
 from public,anon,authenticated;
grant execute on function public.get_match_opinion_history(uuid,integer)
 to authenticated;
