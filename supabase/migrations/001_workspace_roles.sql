-- TechLib: one shared library with viewer / editor / admin roles
-- Run in Supabase SQL Editor after the base schema.sql (existing projects).

-- Roles
do $$ begin
  create type public.workspace_role as enum ('viewer', 'editor', 'admin');
exception
  when duplicate_object then null;
end $$;

-- Workspace + membership
create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'TechLib',
  owner_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.workspace_role not null default 'viewer',
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create index if not exists workspace_members_user_idx
  on public.workspace_members (user_id);

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;

-- Helpers (security definer so RLS can call them without recursion)
create or replace function public.current_workspace_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select workspace_id
  from public.workspace_members
  where user_id = auth.uid()
  limit 1;
$$;

create or replace function public.library_owner_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select w.owner_id
  from public.workspaces w
  join public.workspace_members m on m.workspace_id = w.id
  where m.user_id = auth.uid()
  limit 1;
$$;

create or replace function public.is_library_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from public.workspace_members where user_id = auth.uid()
  );
$$;

create or replace function public.can_edit_library()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1
    from public.workspace_members
    where user_id = auth.uid()
      and role in ('editor', 'admin')
  );
$$;

create or replace function public.is_library_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1
    from public.workspace_members
    where user_id = auth.uid()
      and role = 'admin'
  );
$$;

-- Bootstrap: first user creates the library as admin; later users join as viewers
create or replace function public.ensure_workspace_membership()
returns table (
  workspace_id uuid,
  role public.workspace_role,
  library_owner_id uuid,
  user_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  ws_id uuid;
  ws_owner uuid;
  member_role public.workspace_role;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  select m.workspace_id, m.role, w.owner_id
    into ws_id, member_role, ws_owner
  from public.workspace_members m
  join public.workspaces w on w.id = m.workspace_id
  where m.user_id = uid
  limit 1;

  if ws_id is not null then
    return query select ws_id, member_role, ws_owner, uid;
    return;
  end if;

  select w.id, w.owner_id
    into ws_id, ws_owner
  from public.workspaces w
  order by w.created_at asc
  limit 1;

  if ws_id is null then
    insert into public.workspaces (name, owner_id)
    values ('TechLib', uid)
    returning id, owner_id into ws_id, ws_owner;

    insert into public.workspace_members (workspace_id, user_id, role)
    values (ws_id, uid, 'admin');

    return query select ws_id, 'admin'::public.workspace_role, ws_owner, uid;
    return;
  end if;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (ws_id, uid, 'viewer')
  on conflict do nothing;

  select m.role into member_role
  from public.workspace_members m
  where m.workspace_id = ws_id and m.user_id = uid;

  return query select ws_id, member_role, ws_owner, uid;
end;
$$;

create or replace function public.list_workspace_members()
returns table (
  user_id uuid,
  email text,
  role public.workspace_role,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  ws uuid := public.current_workspace_id();
begin
  if ws is null then
    raise exception 'Not a library member';
  end if;
  if not public.is_library_admin() then
    raise exception 'Only admins can list members';
  end if;

  return query
  select m.user_id, u.email::text, m.role, m.created_at
  from public.workspace_members m
  join auth.users u on u.id = m.user_id
  where m.workspace_id = ws
  order by m.created_at asc;
end;
$$;

create or replace function public.set_member_role(
  target_user_id uuid,
  new_role public.workspace_role
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  ws uuid := public.current_workspace_id();
  admin_count int;
begin
  if ws is null then
    raise exception 'Not a library member';
  end if;
  if not public.is_library_admin() then
    raise exception 'Only admins can change roles';
  end if;

  if new_role is distinct from 'admin' then
    select count(*) into admin_count
    from public.workspace_members
    where workspace_id = ws and role = 'admin' and user_id <> target_user_id;
    if admin_count < 1 then
      -- Demoting the last remaining admin is blocked when this user is currently admin
      if exists (
        select 1 from public.workspace_members
        where workspace_id = ws and user_id = target_user_id and role = 'admin'
      ) then
        raise exception 'Cannot remove the last admin';
      end if;
    end if;
  end if;

  update public.workspace_members
  set role = new_role
  where workspace_id = ws and user_id = target_user_id;

  if not found then
    raise exception 'Member not found';
  end if;
end;
$$;

grant execute on function public.ensure_workspace_membership() to authenticated;
grant execute on function public.library_owner_id() to authenticated;
grant execute on function public.can_edit_library() to authenticated;
grant execute on function public.is_library_admin() to authenticated;
grant execute on function public.is_library_member() to authenticated;
grant execute on function public.current_workspace_id() to authenticated;
grant execute on function public.list_workspace_members() to authenticated;
grant execute on function public.set_member_role(uuid, public.workspace_role) to authenticated;

-- Workspace policies
drop policy if exists "workspaces_member_select" on public.workspaces;
create policy "workspaces_member_select" on public.workspaces
  for select using (
    exists (
      select 1 from public.workspace_members m
      where m.workspace_id = id and m.user_id = auth.uid()
    )
  );

drop policy if exists "workspace_members_select" on public.workspace_members;
create policy "workspace_members_select" on public.workspace_members
  for select using (
    workspace_id = public.current_workspace_id()
  );

-- Replace owner-only library policies with member read / editor write
drop policy if exists "notes_owner_all" on public.notes;
drop policy if exists "notes_member_select" on public.notes;
drop policy if exists "notes_editor_insert" on public.notes;
drop policy if exists "notes_editor_update" on public.notes;
drop policy if exists "notes_editor_delete" on public.notes;

create policy "notes_member_select" on public.notes
  for select using (owner_id = public.library_owner_id());
create policy "notes_editor_insert" on public.notes
  for insert with check (
    public.can_edit_library() and owner_id = public.library_owner_id()
  );
create policy "notes_editor_update" on public.notes
  for update using (
    public.can_edit_library() and owner_id = public.library_owner_id()
  )
  with check (
    public.can_edit_library() and owner_id = public.library_owner_id()
  );
create policy "notes_editor_delete" on public.notes
  for delete using (
    public.can_edit_library() and owner_id = public.library_owner_id()
  );

drop policy if exists "labels_owner_all" on public.labels;
drop policy if exists "labels_member_select" on public.labels;
drop policy if exists "labels_editor_insert" on public.labels;
drop policy if exists "labels_editor_update" on public.labels;
drop policy if exists "labels_editor_delete" on public.labels;

create policy "labels_member_select" on public.labels
  for select using (owner_id = public.library_owner_id());
create policy "labels_editor_insert" on public.labels
  for insert with check (
    public.can_edit_library() and owner_id = public.library_owner_id()
  );
create policy "labels_editor_update" on public.labels
  for update using (
    public.can_edit_library() and owner_id = public.library_owner_id()
  )
  with check (
    public.can_edit_library() and owner_id = public.library_owner_id()
  );
create policy "labels_editor_delete" on public.labels
  for delete using (
    public.can_edit_library() and owner_id = public.library_owner_id()
  );

drop policy if exists "stock_locations_owner_all" on public.stock_locations;
drop policy if exists "stock_member_select" on public.stock_locations;
drop policy if exists "stock_editor_insert" on public.stock_locations;
drop policy if exists "stock_editor_update" on public.stock_locations;
drop policy if exists "stock_editor_delete" on public.stock_locations;

create policy "stock_member_select" on public.stock_locations
  for select using (owner_id = public.library_owner_id());
create policy "stock_editor_insert" on public.stock_locations
  for insert with check (
    public.can_edit_library() and owner_id = public.library_owner_id()
  );
create policy "stock_editor_update" on public.stock_locations
  for update using (
    public.can_edit_library() and owner_id = public.library_owner_id()
  )
  with check (
    public.can_edit_library() and owner_id = public.library_owner_id()
  );
create policy "stock_editor_delete" on public.stock_locations
  for delete using (
    public.can_edit_library() and owner_id = public.library_owner_id()
  );

drop policy if exists "note_types_owner_all" on public.note_types;
drop policy if exists "note_types_member_select" on public.note_types;
drop policy if exists "note_types_editor_insert" on public.note_types;
drop policy if exists "note_types_editor_update" on public.note_types;
drop policy if exists "note_types_editor_delete" on public.note_types;

create policy "note_types_member_select" on public.note_types
  for select using (owner_id = public.library_owner_id());
create policy "note_types_editor_insert" on public.note_types
  for insert with check (
    public.can_edit_library() and owner_id = public.library_owner_id()
  );
create policy "note_types_editor_update" on public.note_types
  for update using (
    public.can_edit_library() and owner_id = public.library_owner_id()
  )
  with check (
    public.can_edit_library() and owner_id = public.library_owner_id()
  );
create policy "note_types_editor_delete" on public.note_types
  for delete using (
    public.can_edit_library() and owner_id = public.library_owner_id()
  );

drop policy if exists "note_labels_owner_all" on public.note_labels;
drop policy if exists "note_labels_member_select" on public.note_labels;
drop policy if exists "note_labels_editor_write" on public.note_labels;

create policy "note_labels_member_select" on public.note_labels
  for select using (
    exists (
      select 1 from public.notes n
      where n.id = note_id and n.owner_id = public.library_owner_id()
    )
  );
create policy "note_labels_editor_insert" on public.note_labels
  for insert with check (
    public.can_edit_library()
    and exists (
      select 1 from public.notes n
      where n.id = note_id and n.owner_id = public.library_owner_id()
    )
  );
create policy "note_labels_editor_update" on public.note_labels
  for update using (
    public.can_edit_library()
    and exists (
      select 1 from public.notes n
      where n.id = note_id and n.owner_id = public.library_owner_id()
    )
  )
  with check (
    public.can_edit_library()
    and exists (
      select 1 from public.notes n
      where n.id = note_id and n.owner_id = public.library_owner_id()
    )
  );
create policy "note_labels_editor_delete" on public.note_labels
  for delete using (
    public.can_edit_library()
    and exists (
      select 1 from public.notes n
      where n.id = note_id and n.owner_id = public.library_owner_id()
    )
  );

drop policy if exists "note_images_owner_all" on public.note_images;
drop policy if exists "note_images_member_select" on public.note_images;
drop policy if exists "note_images_editor_insert" on public.note_images;
drop policy if exists "note_images_editor_update" on public.note_images;
drop policy if exists "note_images_editor_delete" on public.note_images;

create policy "note_images_member_select" on public.note_images
  for select using (owner_id = public.library_owner_id());
create policy "note_images_editor_insert" on public.note_images
  for insert with check (
    public.can_edit_library() and owner_id = public.library_owner_id()
  );
create policy "note_images_editor_update" on public.note_images
  for update using (
    public.can_edit_library() and owner_id = public.library_owner_id()
  )
  with check (
    public.can_edit_library() and owner_id = public.library_owner_id()
  );
create policy "note_images_editor_delete" on public.note_images
  for delete using (
    public.can_edit_library() and owner_id = public.library_owner_id()
  );

-- Cart + reactions stay personal (per signed-in user), but only for library members
drop policy if exists "cart_items_owner_all" on public.cart_items;
drop policy if exists "cart_items_own" on public.cart_items;
create policy "cart_items_own" on public.cart_items
  for all using (
    public.is_library_member() and auth.uid() = owner_id
  )
  with check (
    public.is_library_member() and auth.uid() = owner_id
  );

drop policy if exists "reactions_owner_all" on public.reactions;
drop policy if exists "reactions_own" on public.reactions;
create policy "reactions_own" on public.reactions
  for all using (
    public.is_library_member() and auth.uid() = owner_id
  )
  with check (
    public.is_library_member() and auth.uid() = owner_id
  );

-- Storage: first path segment is library owner id; members can read, editors write
drop policy if exists "note_images_storage_select" on storage.objects;
drop policy if exists "note_images_storage_insert" on storage.objects;
drop policy if exists "note_images_storage_update" on storage.objects;
drop policy if exists "note_images_storage_delete" on storage.objects;

create policy "note_images_storage_select"
  on storage.objects for select
  using (
    bucket_id = 'note-images'
    and (storage.foldername(name))[1] = public.library_owner_id()::text
  );

create policy "note_images_storage_insert"
  on storage.objects for insert
  with check (
    bucket_id = 'note-images'
    and public.can_edit_library()
    and (storage.foldername(name))[1] = public.library_owner_id()::text
  );

create policy "note_images_storage_update"
  on storage.objects for update
  using (
    bucket_id = 'note-images'
    and public.can_edit_library()
    and (storage.foldername(name))[1] = public.library_owner_id()::text
  );

create policy "note_images_storage_delete"
  on storage.objects for delete
  using (
    bucket_id = 'note-images'
    and public.can_edit_library()
    and (storage.foldername(name))[1] = public.library_owner_id()::text
  );
