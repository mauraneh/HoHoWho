-- Organiser role: only the e-mail addresses listed in public.organizers can create a Secret Santa.
-- Everyone else takes part through invitation links. While the list is empty, anyone can
-- organise (so a fresh project works before it is configured).
--
-- The list is synced from the ORGANIZER_EMAILS GitHub variable by the deploy workflow
-- (scripts/sync-organizers.mjs), so addresses are never committed to the repository.

create table public.organizers (
  email text primary key check (email = lower(email) and email like '%@%'),
  created_at timestamptz not null default now()
);

-- No client access at all: read through can_organize(), written by the service role / CI only.
alter table public.organizers enable row level security;
revoke all on public.organizers from anon, authenticated;

create function public.can_organize()
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and (
    not exists (select 1 from public.organizers)
    or exists (
      select 1
      from public.organizers o
      join auth.users u on lower(u.email) = o.email
      where u.id = auth.uid()
    )
  );
$$;

create or replace function public.create_event(
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
  if not public.can_organize() then
    raise exception 'Only organisers can create a Secret Santa' using errcode = '42501';
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

revoke execute on function public.can_organize() from public, anon;
grant execute on function public.can_organize() to authenticated;
