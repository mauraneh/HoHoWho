-- HoHoWho initial schema: tables, constraints, helper functions, RPCs and Row Level Security.
--
-- Security model
-- * Every table has RLS enabled and the default Supabase grants are revoked; access is granted
--   explicitly per table/column to the `authenticated` role only. `anon` gets nothing.
-- * Writes that must be atomic or need elevated rights go through SECURITY DEFINER functions
--   that validate the caller with auth.uid().
-- * Assignments can only be written by the `draw-assignments` Edge Function (service_role)
--   through public.apply_draw(). A participant can only ever read the assignment where they
--   are the giver, so nobody can discover who their own Secret Santa is.
-- * Messages store no sender identity: a thread belongs to a receiver and each message is
--   flagged from_santa = true/false.

-- ---------------------------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 60),
  created_at timestamptz not null default now()
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80),
  description text not null default '' check (char_length(description) <= 1000),
  event_date date,
  budget_min numeric(10, 2) check (budget_min >= 0),
  budget_max numeric(10, 2) check (budget_max >= 0),
  currency text not null default 'EUR' check (currency ~ '^[A-Z]{3}$'),
  status text not null default 'open' check (status in ('open', 'drawn')),
  created_at timestamptz not null default now(),
  drawn_at timestamptz,
  check (budget_min is null or budget_max is null or budget_min <= budget_max)
);
create index events_owner_id_idx on public.events (owner_id);

create table public.participants (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  display_name text not null check (char_length(trim(display_name)) between 1 and 60),
  joined_at timestamptz not null default now(),
  unique (event_id, user_id),
  -- Target for composite foreign keys guaranteeing that referenced participants belong to the event.
  unique (id, event_id)
);
create index participants_user_id_idx on public.participants (user_id);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  -- Only the SHA-256 hash of the token is stored; the plain token is shown once to the owner.
  token_hash bytea not null unique,
  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index invitations_event_id_idx on public.invitations (event_id);

create table public.exclusions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  participant_a uuid not null,
  participant_b uuid not null,
  created_at timestamptz not null default now(),
  check (participant_a <> participant_b),
  foreign key (participant_a, event_id) references public.participants (id, event_id) on delete cascade,
  foreign key (participant_b, event_id) references public.participants (id, event_id) on delete cascade
);
create unique index exclusions_pair_idx
  on public.exclusions (event_id, least(participant_a, participant_b), greatest(participant_a, participant_b));

create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  giver_id uuid not null,
  receiver_id uuid not null,
  created_at timestamptz not null default now(),
  check (giver_id <> receiver_id),
  unique (event_id, giver_id),
  unique (event_id, receiver_id),
  foreign key (giver_id, event_id) references public.participants (id, event_id) on delete cascade,
  foreign key (receiver_id, event_id) references public.participants (id, event_id) on delete cascade
);
create index assignments_giver_id_idx on public.assignments (giver_id);
create index assignments_receiver_id_idx on public.assignments (receiver_id);

create table public.questionnaires (
  participant_id uuid primary key references public.participants (id) on delete cascade,
  interests text[] not null default '{}' check (cardinality(interests) <= 40),
  gift_styles text[] not null default '{}' check (cardinality(gift_styles) <= 20),
  avoid text[] not null default '{}' check (cardinality(avoid) <= 40),
  sizes text not null default '' check (char_length(sizes) <= 200),
  notes text not null default '' check (char_length(notes) <= 1000),
  updated_at timestamptz not null default now()
);

create table public.wishlist_items (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.participants (id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 120),
  url text check (url is null or (url ~* '^https?://' and char_length(url) <= 2000)),
  notes text not null default '' check (char_length(notes) <= 500),
  price numeric(10, 2) check (price >= 0),
  priority smallint not null default 2 check (priority between 1 and 3),
  created_at timestamptz not null default now()
);
create index wishlist_items_participant_id_idx on public.wishlist_items (participant_id);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  -- The thread is identified by its receiver: the Santa and the receiver both write into it.
  receiver_id uuid not null,
  from_santa boolean not null,
  body text not null check (char_length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now(),
  foreign key (receiver_id, event_id) references public.participants (id, event_id) on delete cascade
);
create index messages_receiver_id_idx on public.messages (receiver_id, created_at);

-- ---------------------------------------------------------------------------------------------
-- Helper functions used by RLS policies (SECURITY DEFINER avoids recursive policy evaluation)
-- ---------------------------------------------------------------------------------------------

create function public.is_event_member(p_event_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.participants p
    where p.event_id = p_event_id and p.user_id = (select auth.uid())
  );
$$;

create function public.is_event_owner(p_event_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.events e
    where e.id = p_event_id and e.owner_id = (select auth.uid())
  );
$$;

create function public.is_event_open(p_event_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.events e where e.id = p_event_id and e.status = 'open');
$$;

-- True when the given user is the organiser of the event (used to protect the owner's participation).
create function public.is_event_owner_user(p_event_id uuid, p_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.events e where e.id = p_event_id and e.owner_id = p_user_id);
$$;

-- True when the participant row belongs to the current user.
create function public.is_self(p_participant_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.participants p
    where p.id = p_participant_id and p.user_id = (select auth.uid())
  );
$$;

-- True when the current user is the Secret Santa of the given participant.
create function public.is_santa_of(p_participant_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.assignments a
    join public.participants g on g.id = a.giver_id
    where a.receiver_id = p_participant_id and g.user_id = (select auth.uid())
  );
$$;

-- True when someone has drawn the given participant (reveals nothing about who).
create function public.has_santa(p_participant_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.assignments a where a.receiver_id = p_participant_id);
$$;

-- ---------------------------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------------------------

-- Create a profile for every new auth user, using the display name supplied at sign-up.
create function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
                  split_part(coalesce(new.email, 'Santa'), '@', 1)), 60)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create function public.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger questionnaires_touch_updated_at
  before update on public.questionnaires
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------------------------
-- RPCs callable by signed-in users
-- ---------------------------------------------------------------------------------------------

create function public.create_event(
  p_name text,
  p_description text default '',
  p_event_date date default null,
  p_budget_min numeric default null,
  p_budget_max numeric default null,
  p_currency text default 'EUR'
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_event_id uuid;
  v_display_name text;
begin
  if v_user is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  select display_name into v_display_name from public.profiles where id = v_user;
  if v_display_name is null then
    raise exception 'Profile not found' using errcode = 'P0002';
  end if;

  insert into public.events (owner_id, name, description, event_date, budget_min, budget_max, currency)
  values (v_user, trim(p_name), coalesce(p_description, ''), p_event_date, p_budget_min, p_budget_max,
          upper(coalesce(p_currency, 'EUR')))
  returning id into v_event_id;

  insert into public.participants (event_id, user_id, display_name)
  values (v_event_id, v_user, v_display_name);

  return v_event_id;
end;
$$;

-- Creates a single-event invitation and returns the plain token once.
create function public.create_invitation(p_event_id uuid, p_valid_days integer default 14)
returns table (token text, expires_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare
  v_token text;
  v_expires timestamptz;
begin
  if not public.is_event_owner(p_event_id) then
    raise exception 'Only the organiser can invite participants' using errcode = '42501';
  end if;
  if not public.is_event_open(p_event_id) then
    raise exception 'Invitations are closed once names have been drawn' using errcode = 'P0001';
  end if;
  if p_valid_days is null or p_valid_days < 1 or p_valid_days > 60 then
    raise exception 'Validity must be between 1 and 60 days' using errcode = '22023';
  end if;

  -- Two v4 UUIDs = 244 bits of randomness from the server's CSPRNG.
  v_token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  v_expires := now() + make_interval(days => p_valid_days);

  insert into public.invitations (event_id, token_hash, created_by, expires_at)
  values (p_event_id, sha256(convert_to(v_token, 'UTF8')), auth.uid(), v_expires);

  return query select v_token, v_expires;
end;
$$;

create function public.preview_invitation(p_token text)
returns table (event_id uuid, event_name text, owner_name text, event_date date, already_member boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  return query
  select e.id, e.name, o.display_name, e.event_date, public.is_event_member(e.id)
  from public.invitations i
  join public.events e on e.id = i.event_id
  join public.profiles o on o.id = e.owner_id
  where i.token_hash = sha256(convert_to(coalesce(p_token, ''), 'UTF8'))
    and i.expires_at > now()
    and e.status = 'open';

  if not found then
    raise exception 'This invitation is invalid or has expired' using errcode = 'P0002';
  end if;
end;
$$;

create function public.accept_invitation(p_token text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_event_id uuid;
  v_display_name text;
begin
  if v_user is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  select i.event_id into v_event_id
  from public.invitations i
  join public.events e on e.id = i.event_id
  where i.token_hash = sha256(convert_to(coalesce(p_token, ''), 'UTF8'))
    and i.expires_at > now()
    and e.status = 'open'
  for share of e;

  if v_event_id is null then
    raise exception 'This invitation is invalid or has expired' using errcode = 'P0002';
  end if;

  select display_name into v_display_name from public.profiles where id = v_user;

  insert into public.participants (event_id, user_id, display_name)
  values (v_event_id, v_user, v_display_name)
  on conflict (event_id, user_id) do nothing;

  return v_event_id;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Draw persistence: only callable with the service role (from the draw-assignments Edge Function)
-- ---------------------------------------------------------------------------------------------

create function public.apply_draw(p_event_id uuid, p_pairs jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_status text;
  v_participants integer;
  v_givers uuid[];
  v_receivers uuid[];
begin
  -- Lock the event so concurrent draws are serialized.
  select status into v_status from public.events where id = p_event_id for update;
  if v_status is null then
    raise exception 'Event not found' using errcode = 'P0002';
  end if;
  if v_status <> 'open' then
    raise exception 'Names have already been drawn for this event' using errcode = 'P0001';
  end if;

  select count(*) into v_participants from public.participants where event_id = p_event_id;
  if v_participants < 3 then
    raise exception 'At least 3 participants are required' using errcode = 'P0001';
  end if;

  select coalesce(array_agg((pair ->> 'giverId')::uuid), '{}'),
         coalesce(array_agg((pair ->> 'receiverId')::uuid), '{}')
  into v_givers, v_receivers
  from jsonb_array_elements(p_pairs) as pair;

  -- Every participant must give exactly once and receive exactly once, never to themselves.
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
    join public.exclusions x on x.event_id = p_event_id
      and ((x.participant_a = t.g and x.participant_b = t.r)
        or (x.participant_b = t.g and x.participant_a = t.r))
  ) then
    raise exception 'Draw violates an exclusion' using errcode = '22023';
  end if;

  insert into public.assignments (event_id, giver_id, receiver_id)
  select p_event_id, t.g, t.r from unnest(v_givers, v_receivers) as t (g, r);

  update public.events set status = 'drawn', drawn_at = now() where id = p_event_id;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Privileges: start from nothing, then grant the minimum.
-- ---------------------------------------------------------------------------------------------

revoke all on all tables in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;

grant select, update (display_name) on public.profiles to authenticated;
grant select, delete, update (name, description, event_date, budget_min, budget_max, currency)
  on public.events to authenticated;
grant select, delete, update (display_name) on public.participants to authenticated;
grant select, delete on public.invitations to authenticated;
grant select, delete, insert (event_id, participant_a, participant_b) on public.exclusions to authenticated;
grant select on public.assignments to authenticated;
-- participant_id is updatable only because PostgREST upserts set every supplied column;
-- the RLS check still pins it to the caller's own participation.
grant select, insert (participant_id, interests, gift_styles, avoid, sizes, notes),
  update (participant_id, interests, gift_styles, avoid, sizes, notes) on public.questionnaires to authenticated;
grant select, delete, insert (participant_id, title, url, notes, price, priority),
  update (title, url, notes, price, priority) on public.wishlist_items to authenticated;
grant select, insert (event_id, receiver_id, from_santa, body) on public.messages to authenticated;

grant execute on function
  public.is_event_member(uuid), public.is_event_owner(uuid), public.is_event_open(uuid),
  public.is_event_owner_user(uuid, uuid),
  public.is_self(uuid), public.is_santa_of(uuid), public.has_santa(uuid),
  public.create_event(text, text, date, numeric, numeric, text),
  public.create_invitation(uuid, integer),
  public.preview_invitation(text),
  public.accept_invitation(text)
to authenticated;

grant execute on function public.apply_draw(uuid, jsonb) to service_role;

-- ---------------------------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.participants enable row level security;
alter table public.invitations enable row level security;
alter table public.exclusions enable row level security;
alter table public.assignments enable row level security;
alter table public.questionnaires enable row level security;
alter table public.wishlist_items enable row level security;
alter table public.messages enable row level security;

-- profiles
create policy "Users read their own profile" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "Users update their own profile" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- events
create policy "Members read their events" on public.events
  for select to authenticated using (public.is_event_member(id));
create policy "Owners update their events" on public.events
  for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "Owners delete their events" on public.events
  for delete to authenticated using (owner_id = (select auth.uid()));

-- participants
create policy "Members read fellow participants" on public.participants
  for select to authenticated using (public.is_event_member(event_id));
create policy "Participants rename themselves" on public.participants
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Owner removes others, participants leave, before the draw" on public.participants
  for delete to authenticated using (
    public.is_event_open(event_id)
    and not public.is_event_owner_user(event_id, user_id)
    and (public.is_event_owner(event_id) or user_id = (select auth.uid()))
  );

-- invitations (created only through create_invitation)
create policy "Owners read invitations" on public.invitations
  for select to authenticated using (public.is_event_owner(event_id));
create policy "Owners revoke invitations" on public.invitations
  for delete to authenticated using (public.is_event_owner(event_id));

-- exclusions
create policy "Owners read exclusions" on public.exclusions
  for select to authenticated using (public.is_event_owner(event_id));
create policy "Owners add exclusions before the draw" on public.exclusions
  for insert to authenticated
  with check (public.is_event_owner(event_id) and public.is_event_open(event_id));
create policy "Owners remove exclusions before the draw" on public.exclusions
  for delete to authenticated
  using (public.is_event_owner(event_id) and public.is_event_open(event_id));

-- assignments: a giver only sees their own assignment. No write access for clients.
create policy "Givers read their own assignment" on public.assignments
  for select to authenticated using (public.is_self(giver_id));

-- questionnaires: owner of the answers and their Secret Santa.
create policy "Participants and their Santa read questionnaires" on public.questionnaires
  for select to authenticated
  using (public.is_self(participant_id) or public.is_santa_of(participant_id));
create policy "Participants write their questionnaire" on public.questionnaires
  for insert to authenticated with check (public.is_self(participant_id));
create policy "Participants update their questionnaire" on public.questionnaires
  for update to authenticated
  using (public.is_self(participant_id)) with check (public.is_self(participant_id));

-- wishlist items: owner of the list and their Secret Santa.
create policy "Participants and their Santa read wishlists" on public.wishlist_items
  for select to authenticated
  using (public.is_self(participant_id) or public.is_santa_of(participant_id));
create policy "Participants add wishlist items" on public.wishlist_items
  for insert to authenticated with check (public.is_self(participant_id));
create policy "Participants update wishlist items" on public.wishlist_items
  for update to authenticated
  using (public.is_self(participant_id)) with check (public.is_self(participant_id));
create policy "Participants delete wishlist items" on public.wishlist_items
  for delete to authenticated using (public.is_self(participant_id));

-- messages: anonymous thread between a receiver and their Santa.
create policy "Thread members read messages" on public.messages
  for select to authenticated
  using (public.is_self(receiver_id) or public.is_santa_of(receiver_id));
create policy "Thread members send messages" on public.messages
  for insert to authenticated with check (
    (from_santa and public.is_santa_of(receiver_id))
    or (not from_santa and public.is_self(receiver_id) and public.has_santa(receiver_id))
  );
