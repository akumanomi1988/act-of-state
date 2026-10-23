-- AOS-019: binding, asynchronous ten-party parliamentary legislation.
-- One sovereign nation, authoritative tally, immutable ballots, no direct table API.
create table public.parliament_bills (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  dossier_id text not null,
  dossier_version integer not null,
  option_id text not null,
  proposed_by uuid not null,
  status text not null default 'open' check (status in ('open','passed','rejected')),
  rule_version text not null default 'parliament-majority-v1',
  created_at timestamptz not null default now(),
  closes_at timestamptz not null default (now() + interval '24 hours'),
  closed_at timestamptz,
  foreign key (dossier_id,dossier_version,option_id)
    references public.dossier_options(dossier_id,dossier_version,id),
  foreign key (match_id,proposed_by)
    references public.match_players(match_id,user_id),
  unique (id,match_id),
  check (closes_at>created_at),
  check ((status='open' and closed_at is null) or
         (status<>'open' and closed_at is not null))
);
create unique index parliament_one_open_bill
  on public.parliament_bills(match_id,dossier_id) where status='open';
create unique index parliament_one_passed_bill
  on public.parliament_bills(match_id,dossier_id) where status='passed';
create index parliament_bill_feed
  on public.parliament_bills(match_id,created_at desc);
create index parliament_bill_option_fk
  on public.parliament_bills(dossier_id,dossier_version,option_id);

create table public.parliament_votes (
  bill_id uuid not null,
  match_id uuid not null,
  user_id uuid not null,
  choice text not null check (choice in ('yes','no','abstain')),
  created_at timestamptz not null default now(),
  primary key (bill_id,user_id),
  foreign key (bill_id,match_id) references public.parliament_bills(id,match_id)
    on delete cascade,
  foreign key (match_id,user_id) references public.match_players(match_id,user_id)
);
create index parliament_vote_member_fk
  on public.parliament_votes(match_id,user_id);
alter table public.parliament_bills enable row level security;
alter table public.parliament_votes enable row level security;
revoke all on public.parliament_bills,public.parliament_votes
  from public,anon,authenticated;

create function public.propose_parliament_bill(
  p_match_id uuid,p_dossier_id text,p_dossier_version integer,p_option_id text)
returns public.parliament_bills language plpgsql security definer
set search_path to '' as $$
declare
  v_user uuid:=auth.uid();
  v_match public.matches%rowtype;
  v_bill public.parliament_bills%rowtype;
  v_day date:=(now() at time zone 'UTC')::date;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  select * into v_match from public.matches where id=p_match_id for update;
  if not found or v_match.host_user_id<>v_user then
    raise exception 'MATCH_FORBIDDEN' using errcode='42501'; end if;
  if v_match.status<>'active' then
    raise exception 'MATCH_NOT_ACTIVE' using errcode='P0001'; end if;
  if exists(select 1 from public.decision_events
            where government_id=v_match.government_id and dossier_id=p_dossier_id) then
    raise exception 'DOSSIER_ALREADY_DECIDED' using errcode='P0001'; end if;
  if not exists (
    select 1 from public.dossiers d join public.dossier_options o
      on o.dossier_id=d.id and o.dossier_version=d.version
    where d.id=p_dossier_id and d.version=p_dossier_version and o.id=p_option_id
      and (d.available_from is null or d.available_from<=v_day)
      and (d.available_until is null or d.available_until>=v_day)
      and (d.release_kind='intro' or (d.release_kind='weekly' and exists(
        select 1 from public.weekly_releases r
        where r.week_start=d.available_from and r.state='approved')))
  ) then raise exception 'DOSSIER_NOT_AVAILABLE' using errcode='P0001'; end if;
  select * into v_bill from public.parliament_bills
    where match_id=p_match_id and dossier_id=p_dossier_id and status='passed';
  if found then raise exception 'PARLIAMENT_ALREADY_APPROVED' using errcode='P0001'; end if;
  select * into v_bill from public.parliament_bills
    where match_id=p_match_id and dossier_id=p_dossier_id and status='open';
  if found then
    if v_bill.dossier_version=p_dossier_version and v_bill.option_id=p_option_id then
      return v_bill;
    end if;
    raise exception 'PARLIAMENT_BILL_OPEN' using errcode='P0001';
  end if;
  insert into public.parliament_bills(match_id,dossier_id,dossier_version,option_id,proposed_by)
  values(p_match_id,p_dossier_id,p_dossier_version,p_option_id,v_user)
  returning * into v_bill;
  return v_bill;
end $$;

create function public.finalize_parliament_bill(p_bill_id uuid)
returns public.parliament_bills language plpgsql security definer
set search_path to '' as $$
declare
  v_user uuid:=auth.uid();
  v_bill public.parliament_bills%rowtype;
  v_total integer; v_count integer; v_yes integer; v_no integer;
  v_pass boolean;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  select * into v_bill from public.parliament_bills where id=p_bill_id for update;
  if not found or not exists(select 1 from public.match_players
      where match_id=v_bill.match_id and user_id=v_user) then
    raise exception 'MATCH_FORBIDDEN' using errcode='42501'; end if;
  if v_bill.status<>'open' then return v_bill; end if;
  select count(*) into v_total from public.match_players where match_id=v_bill.match_id;
  select count(*),count(*) filter(where choice='yes'),
         count(*) filter(where choice='no')
    into v_count,v_yes,v_no from public.parliament_votes where bill_id=p_bill_id;
  -- An absolute majority can approve immediately. Otherwise, wait for every
  -- ballot or the 24-hour deadline, then require quorum and more yes than no.
  if v_yes>v_total/2 then
    v_pass:=true;
  elsif v_count=v_total or now()>=v_bill.closes_at then
    v_pass:=v_count>=(v_total+1)/2 and v_yes>v_no;
  else
    return v_bill;
  end if;
  update public.parliament_bills
    set status=case when v_pass then 'passed' else 'rejected' end,
        closed_at=now()
    where id=p_bill_id returning * into v_bill;
  return v_bill;
end $$;

create function public.cast_parliament_vote(p_bill_id uuid,p_choice text)
returns public.parliament_bills language plpgsql security definer
set search_path to '' as $$
declare
  v_user uuid:=auth.uid();
  v_bill public.parliament_bills%rowtype;
  v_existing text;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  if p_choice not in ('yes','no','abstain') or p_choice is null then
    raise exception 'PARLIAMENT_INVALID_VOTE' using errcode='P0001'; end if;
  select * into v_bill from public.parliament_bills where id=p_bill_id for update;
  if not found or not exists(select 1 from public.match_players
      where match_id=v_bill.match_id and user_id=v_user) then
    raise exception 'MATCH_FORBIDDEN' using errcode='42501'; end if;
  select choice into v_existing from public.parliament_votes
    where bill_id=p_bill_id and user_id=v_user;
  if found then
    if v_existing=p_choice then return v_bill; end if;
    raise exception 'PARLIAMENT_VOTE_LOCKED' using errcode='P0001';
  end if;
  if v_bill.status<>'open' or now()>=v_bill.closes_at then
    raise exception 'PARLIAMENT_VOTE_CLOSED' using errcode='P0001'; end if;
  insert into public.parliament_votes(bill_id,match_id,user_id,choice)
  values(p_bill_id,v_bill.match_id,v_user,p_choice);
  return public.finalize_parliament_bill(p_bill_id);
end $$;

create function public.get_parliament_state(p_match_id uuid)
returns jsonb language plpgsql stable security definer
set search_path to '' as $$
declare v_user uuid:=auth.uid(); v_result jsonb;
begin
  if v_user is null or not exists(select 1 from public.match_players
      where match_id=p_match_id and user_id=v_user) then
    raise exception 'MATCH_FORBIDDEN' using errcode='42501'; end if;
  select jsonb_build_object(
    'bills',coalesce((select jsonb_agg(to_jsonb(b) order by b.created_at desc,b.id)
      from public.parliament_bills b where b.match_id=p_match_id),'[]'::jsonb),
    'votes',coalesce((select jsonb_agg(to_jsonb(v) order by v.created_at,v.user_id)
      from public.parliament_votes v where v.match_id=p_match_id),'[]'::jsonb),
    'serverNow',now()
  ) into v_result;
  return v_result;
end $$;

-- This trigger is the mandatory security boundary. An authenticated host
-- cannot bypass Parliament through the standalone government UI or direct RPC.
create function public.require_parliament_mandate()
returns trigger language plpgsql set search_path to '' as $$
declare v_match_id uuid;
begin
  select id into v_match_id from public.matches
  where government_id=new.government_id and status='active';
  if v_match_id is not null and not exists(
    select 1 from public.parliament_bills b
    where b.match_id=v_match_id and b.dossier_id=new.dossier_id
      and b.dossier_version=new.dossier_version and b.option_id=new.option_id
      and b.status='passed'
  ) then
    raise exception 'PARLIAMENT_APPROVAL_REQUIRED' using errcode='P0001';
  end if;
  return new;
end $$;
create trigger decision_requires_parliamentary_mandate
before insert on public.decision_events
for each row execute function public.require_parliament_mandate();

revoke all on function public.propose_parliament_bill(uuid,text,integer,text),
  public.finalize_parliament_bill(uuid),public.cast_parliament_vote(uuid,text),
  public.get_parliament_state(uuid),public.require_parliament_mandate()
  from public,anon,authenticated;
grant execute on function public.propose_parliament_bill(uuid,text,integer,text),
  public.finalize_parliament_bill(uuid),public.cast_parliament_vote(uuid,text),
  public.get_parliament_state(uuid) to authenticated;
