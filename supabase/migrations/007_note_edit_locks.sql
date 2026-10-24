-- Soft edit locks: advertise who is editing a note so others open read-only
-- (or confirm take-over). Leases expire quickly if the holder crashes.

create table if not exists public.note_edit_locks (
  note_id uuid primary key references public.notes (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  user_email text not null default '',
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);

create index if not exists note_edit_locks_expires_idx
  on public.note_edit_locks (expires_at);

create index if not exists note_edit_locks_user_idx
  on public.note_edit_locks (user_id);

alter table public.note_edit_locks enable row level security;

drop policy if exists "note_edit_locks_member_select" on public.note_edit_locks;
create policy "note_edit_locks_member_select" on public.note_edit_locks
  for select using (
    public.is_library_member()
    and exists (
      select 1
      from public.notes n
      where n.id = note_id
        and n.owner_id = public.library_owner_id()
    )
  );

-- Clients mutate locks only through security-definer RPCs below.

create or replace function public.current_user_email()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select u.email::text from auth.users u where u.id = auth.uid()),
    ''
  );
$$;

grant execute on function public.current_user_email() to authenticated;

-- Lease length used by claim + heartbeat (seconds).
create or replace function public.note_edit_lock_ttl_seconds()
returns int
language sql
immutable
as $$
  select 45;
$$;

create or replace function public.claim_note_edit_lock(
  p_note_id uuid,
  p_take_over boolean default false
)
returns table (
  held boolean,
  mine boolean,
  user_id uuid,
  user_email text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  email text;
  ttl interval := make_interval(secs => public.note_edit_lock_ttl_seconds());
  existing public.note_edit_locks%rowtype;
  new_expires timestamptz;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;
  if not public.is_library_member() then
    raise exception 'Not a library member';
  end if;
  if not exists (
    select 1 from public.notes n
    where n.id = p_note_id
      and n.owner_id = public.library_owner_id()
  ) then
    raise exception 'Note not found';
  end if;
  -- Only people who may mutate the note can hold an edit lease.
  if not public.can_mutate_note_id(p_note_id) then
    raise exception 'Not allowed to edit this note';
  end if;

  email := public.current_user_email();
  new_expires := now() + ttl;

  select * into existing
  from public.note_edit_locks
  where note_id = p_note_id
  for update;

  if existing.note_id is null or existing.expires_at <= now() then
    insert into public.note_edit_locks as l (note_id, user_id, user_email, expires_at, updated_at)
    values (p_note_id, uid, email, new_expires, now())
    on conflict (note_id) do update
      set user_id = excluded.user_id,
          user_email = excluded.user_email,
          expires_at = excluded.expires_at,
          updated_at = excluded.updated_at;
    return query
      select true, true, uid, email, new_expires;
    return;
  end if;

  if existing.user_id = uid then
    update public.note_edit_locks
    set user_email = email,
        expires_at = new_expires,
        updated_at = now()
    where note_id = p_note_id;
    return query
      select true, true, uid, email, new_expires;
    return;
  end if;

  if not p_take_over then
    return query
      select true, false, existing.user_id, existing.user_email, existing.expires_at;
    return;
  end if;

  update public.note_edit_locks
  set user_id = uid,
      user_email = email,
      expires_at = new_expires,
      updated_at = now()
  where note_id = p_note_id;

  return query
    select true, true, uid, email, new_expires;
end;
$$;

create or replace function public.heartbeat_note_edit_lock(p_note_id uuid)
returns table (
  held boolean,
  mine boolean,
  user_id uuid,
  user_email text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  email text;
  ttl interval := make_interval(secs => public.note_edit_lock_ttl_seconds());
  existing public.note_edit_locks%rowtype;
  new_expires timestamptz;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  email := public.current_user_email();
  new_expires := now() + ttl;

  select * into existing
  from public.note_edit_locks
  where note_id = p_note_id
  for update;

  if existing.note_id is null or existing.expires_at <= now() then
    return query select false, false, null::uuid, ''::text, null::timestamptz;
    return;
  end if;

  if existing.user_id <> uid then
    return query
      select true, false, existing.user_id, existing.user_email, existing.expires_at;
    return;
  end if;

  update public.note_edit_locks
  set user_email = email,
      expires_at = new_expires,
      updated_at = now()
  where note_id = p_note_id;

  return query
    select true, true, uid, email, new_expires;
end;
$$;

create or replace function public.release_note_edit_lock(p_note_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    return;
  end if;
  delete from public.note_edit_locks
  where note_id = p_note_id
    and user_id = uid;
end;
$$;

create or replace function public.get_note_edit_lock(p_note_id uuid)
returns table (
  held boolean,
  mine boolean,
  user_id uuid,
  user_email text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  existing public.note_edit_locks%rowtype;
begin
  if uid is null or not public.is_library_member() then
    return query select false, false, null::uuid, ''::text, null::timestamptz;
    return;
  end if;

  select * into existing
  from public.note_edit_locks
  where note_id = p_note_id;

  if existing.note_id is null or existing.expires_at <= now() then
    return query select false, false, null::uuid, ''::text, null::timestamptz;
    return;
  end if;

  return query
    select true,
           existing.user_id = uid,
           existing.user_id,
           existing.user_email,
           existing.expires_at;
end;
$$;

grant execute on function public.claim_note_edit_lock(uuid, boolean) to authenticated;
grant execute on function public.heartbeat_note_edit_lock(uuid) to authenticated;
grant execute on function public.release_note_edit_lock(uuid) to authenticated;
grant execute on function public.get_note_edit_lock(uuid) to authenticated;

-- Realtime: allow clients to subscribe to lock row changes.
do $$
begin
  begin
    alter publication supabase_realtime add table public.note_edit_locks;
  exception
    when duplicate_object then null;
    when undefined_object then null;
  end;
end $$;
