-- Participant-driven flow:
--   1. open        → people join with the invitation link and fill in their wishes
--   2. exclusions  → the organiser closes the list; everyone privately picks who they do not
--                    want to give a gift to, then validates
--   3. drawn       → names are drawn once everyone has validated (or the organiser forces it)
--
-- Exclusions become personal and directional ("I won't give to X") and are private to their
-- author: nobody, not even the organiser, can read someone else's choices.

-- ---------------------------------------------------------------------------------------------
-- Event phases and participant progress
-- ---------------------------------------------------------------------------------------------

alter table public.events drop constraint events_status_check;
alter table public.events
  add constraint events_status_check check (status in ('open', 'exclusions', 'drawn')),
  add column closed_at timestamptz;

alter table public.participants
  add column profile_completed_at timestamptz,
  add column exclusions_confirmed_at timestamptz;

-- Mark a participant's wishes as completed as soon as they save the questionnaire.
create function public.mark_profile_completed()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.participants
  set profile_completed_at = coalesce(profile_completed_at, now())
  where id = new.participant_id;
  return new;
end;
$$;

create trigger questionnaires_mark_profile_completed
  after insert on public.questionnaires
  for each row execute function public.mark_profile_completed();

-- ---------------------------------------------------------------------------------------------
-- Personal, directional exclusions
-- ---------------------------------------------------------------------------------------------

drop table public.exclusions;

create table public.exclusions (
  event_id uuid not null references public.events (id) on delete cascade,
  giver_id uuid not null,
  excluded_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (giver_id, excluded_id),
  check (giver_id <> excluded_id),
  foreign key (giver_id, event_id) references public.participants (id, event_id) on delete cascade,
  foreign key (excluded_id, event_id) references public.participants (id, event_id) on delete cascade
);
create index exclusions_event_id_idx on public.exclusions (event_id);

alter table public.exclusions enable row level security;
revoke all on public.exclusions from anon, authenticated;
grant select on public.exclusions to authenticated;

create policy "Participants read their own exclusions" on public.exclusions
  for select to authenticated using (public.is_self(giver_id));

-- ---------------------------------------------------------------------------------------------
-- Phase transitions
-- ---------------------------------------------------------------------------------------------

-- Organiser closes the list: no more joining, everyone moves on to exclusions.
create function public.close_registrations(p_event_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_status text;
begin
  if not public.is_event_owner(p_event_id) then
    raise exception 'Only the organiser can close the list' using errcode = '42501';
  end if;
  select status into v_status from public.events where id = p_event_id for update;
  if v_status <> 'open' then
    raise exception 'The list is already closed' using errcode = 'P0001';
  end if;
  if (select count(*) from public.participants where event_id = p_event_id) < 3 then
    raise exception 'At least 3 participants are required' using errcode = 'P0001';
  end if;
  update public.events set status = 'exclusions', closed_at = now() where id = p_event_id;
end;
$$;

-- Organiser reopens the list (e.g. someone was forgotten). Exclusion choices are reset.
create function public.reopen_registrations(p_event_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_status text;
begin
  if not public.is_event_owner(p_event_id) then
    raise exception 'Only the organiser can reopen the list' using errcode = '42501';
  end if;
  select status into v_status from public.events where id = p_event_id for update;
  if v_status <> 'exclusions' then
    raise exception 'The list can only be reopened before the draw' using errcode = 'P0001';
  end if;
  delete from public.exclusions where event_id = p_event_id;
  update public.participants set exclusions_confirmed_at = null where event_id = p_event_id;
  update public.events set status = 'open', closed_at = null where id = p_event_id;
end;
$$;

-- A participant saves who they do not want to give a gift to, and validates the step.
-- Returns true when every participant of the event has now validated.
create function public.submit_exclusions(p_event_id uuid, p_excluded uuid[])
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid;
  v_status text;
  v_total integer;
  v_excluded uuid[] := coalesce(p_excluded, '{}');
begin
  select id into v_me from public.participants
  where event_id = p_event_id and user_id = auth.uid();
  if v_me is null then
    raise exception 'You are not part of this event' using errcode = '42501';
  end if;
  select status into v_status from public.events where id = p_event_id for share;
  if v_status <> 'exclusions' then
    raise exception 'Exclusions can only be chosen after the list is closed and before the draw'
      using errcode = 'P0001';
  end if;

  select count(*) into v_total from public.participants where event_id = p_event_id;
  if v_me = any (v_excluded) then
    raise exception 'You cannot exclude yourself' using errcode = '22023';
  end if;
  if (select count(distinct x) from unnest(v_excluded) as x) > v_total - 2 then
    raise exception 'Leave at least one person you could give a gift to' using errcode = '22023';
  end if;
  if exists (
    select 1 from unnest(v_excluded) as x
    where not exists (select 1 from public.participants p where p.id = x and p.event_id = p_event_id)
  ) then
    raise exception 'Unknown participant' using errcode = '22023';
  end if;

  delete from public.exclusions where giver_id = v_me;
  insert into public.exclusions (event_id, giver_id, excluded_id)
  select distinct p_event_id, v_me, x from unnest(v_excluded) as x;
  update public.participants set exclusions_confirmed_at = now() where id = v_me;

  return not exists (
    select 1 from public.participants
    where event_id = p_event_id and exclusions_confirmed_at is null
  );
end;
$$;

-- E-mail addresses of the participants, for the organiser's "e-mail everyone" button.
create function public.participant_emails(p_event_id uuid)
returns table (display_name text, email text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_event_owner(p_event_id) then
    raise exception 'Only the organiser can see e-mail addresses' using errcode = '42501';
  end if;
  return query
  select p.display_name, u.email::text
  from public.participants p
  join auth.users u on u.id = p.user_id
  where p.event_id = p_event_id
  order by p.joined_at;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Draw: now requires a closed list and honours directional exclusions
-- ---------------------------------------------------------------------------------------------

create or replace function public.apply_draw(p_event_id uuid, p_pairs jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_status text;
  v_participants integer;
  v_givers uuid[];
  v_receivers uuid[];
begin
  select status into v_status from public.events where id = p_event_id for update;
  if v_status is null then
    raise exception 'Event not found' using errcode = 'P0002';
  end if;
  if v_status = 'drawn' then
    raise exception 'Names have already been drawn for this event' using errcode = 'P0001';
  end if;
  if v_status <> 'exclusions' then
    raise exception 'Close the list before drawing names' using errcode = 'P0001';
  end if;

  select count(*) into v_participants from public.participants where event_id = p_event_id;
  if v_participants < 3 then
    raise exception 'At least 3 participants are required' using errcode = 'P0001';
  end if;

  select coalesce(array_agg((pair ->> 'giverId')::uuid), '{}'),
         coalesce(array_agg((pair ->> 'receiverId')::uuid), '{}')
  into v_givers, v_receivers
  from jsonb_array_elements(p_pairs) as pair;

  if cardinality(v_givers) <> v_participants
     or (select count(distinct g) from unnest(v_givers) as g) <> v_participants
     or (select count(distinct r) from unnest(v_receivers) as r) <> v_participants
     or (select count(*) from public.participants
         where event_id = p_event_id and id = any (v_givers)) <> v_participants
     or (select count(*) from public.participants
         where event_id = p_event_id and id = any (v_receivers)) <> v_participants
     or exists (select 1 from unnest(v_givers, v_receivers) as t (g, r) where g = r)
  then
    raise exception 'Invalid draw' using errcode = '22023';
  end if;

  if exists (
    select 1
    from unnest(v_givers, v_receivers) as t (g, r)
    join public.exclusions x on x.giver_id = t.g and x.excluded_id = t.r
  ) then
    raise exception 'Draw violates an exclusion' using errcode = '22023';
  end if;

  insert into public.assignments (event_id, giver_id, receiver_id)
  select p_event_id, t.g, t.r from unnest(v_givers, v_receivers) as t (g, r);

  update public.events set status = 'drawn', drawn_at = now() where id = p_event_id;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------------------------

revoke execute on function
  public.mark_profile_completed(),
  public.close_registrations(uuid),
  public.reopen_registrations(uuid),
  public.submit_exclusions(uuid, uuid[]),
  public.participant_emails(uuid)
from public, anon, authenticated;

grant execute on function
  public.close_registrations(uuid),
  public.reopen_registrations(uuid),
  public.submit_exclusions(uuid, uuid[]),
  public.participant_emails(uuid)
to authenticated;

revoke execute on function public.apply_draw(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.apply_draw(uuid, jsonb) to service_role;

-- ---------------------------------------------------------------------------------------------
-- Invitation preview is readable without an account, so the invitation page can show the event
-- before asking for an e-mail. Holding the secret token is what grants access.
-- ---------------------------------------------------------------------------------------------

create or replace function public.preview_invitation(p_token text)
returns table (event_id uuid, event_name text, owner_name text, event_date date, already_member boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  return query
  select e.id, e.name, o.display_name, e.event_date,
         auth.uid() is not null and public.is_event_member(e.id)
  from public.invitations i
  join public.events e on e.id = i.event_id
  join public.profiles o on o.id = e.owner_id
  where i.token_hash = sha256(convert_to(coalesce(p_token, ''), 'UTF8'))
    and i.expires_at > now()
    and e.status = 'open';

  if not found then
    raise exception 'This invitation is invalid, has expired, or the list is already closed'
      using errcode = 'P0002';
  end if;
end;
$$;

grant execute on function public.preview_invitation(text) to anon, authenticated;
