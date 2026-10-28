-- Notes bin: soft-delete stays until an admin empties the bin.
-- deleted_by tracks who moved a note to the bin (restored by that user or an admin).

alter table public.notes
  add column if not exists deleted_by uuid references auth.users (id);

create index if not exists notes_deleted_at_idx
  on public.notes (owner_id, deleted_at)
  where deleted_at is not null;

create index if not exists notes_deleted_by_idx
  on public.notes (deleted_by)
  where deleted_by is not null;

-- Hard delete is admin-only. Editors move notes to the bin (UPDATE);
-- blank drafts / import undo use discard_own_notes.
drop policy if exists "notes_editor_delete" on public.notes;
drop policy if exists "notes_admin_delete" on public.notes;
create policy "notes_admin_delete" on public.notes
  for delete using (
    owner_id = public.library_owner_id()
    and public.is_library_admin()
  );

-- ── Minimal audit log (ids + action only; no note bodies / secrets) ───────
create table if not exists public.library_audit_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  actor_id uuid not null references auth.users (id),
  action text not null,
  entity_type text not null default 'note',
  entity_ids uuid[] not null default '{}',
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists library_audit_events_owner_created_idx
  on public.library_audit_events (owner_id, created_at desc);

alter table public.library_audit_events enable row level security;

drop policy if exists "library_audit_admin_select" on public.library_audit_events;
create policy "library_audit_admin_select" on public.library_audit_events
  for select using (
    owner_id = public.library_owner_id()
    and public.is_library_admin()
  );

create or replace function public.log_library_audit(
  p_action text,
  p_entity_type text,
  p_entity_ids uuid[],
  p_meta jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return;
  end if;
  insert into public.library_audit_events (
    owner_id, actor_id, action, entity_type, entity_ids, meta
  ) values (
    public.library_owner_id(),
    auth.uid(),
    p_action,
    coalesce(nullif(p_entity_type, ''), 'note'),
    coalesce(p_entity_ids, '{}'::uuid[]),
    coalesce(p_meta, '{}'::jsonb)
  );
end;
$$;

grant execute on function public.log_library_audit(text, text, uuid[], jsonb) to authenticated;

-- ── Bin note(s) ───────────────────────────────────────────────────────────
create or replace function public.bin_notes(p_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
  v_done uuid[];
begin
  if p_ids is null or cardinality(p_ids) = 0 then
    return 0;
  end if;
  if not public.can_edit_library() then
    raise exception 'Not allowed to bin notes';
  end if;

  with updated as (
    update public.notes n
    set
      deleted_at = now(),
      deleted_by = auth.uid(),
      updated_at = now()
    where n.id = any (p_ids)
      and n.owner_id = public.library_owner_id()
      and n.deleted_at is null
      and public.can_mutate_authored_row(n.created_by)
    returning n.id
  )
  select coalesce(array_agg(id), '{}'::uuid[]) into v_done from updated;

  v_count := coalesce(cardinality(v_done), 0);
  if v_count > 0 then
    perform public.log_library_audit('note.bin', 'note', v_done, '{}'::jsonb);
  end if;
  return v_count;
end;
$$;

grant execute on function public.bin_notes(uuid[]) to authenticated;

-- ── Restore from bin ──────────────────────────────────────────────────────
-- Caller may restore notes they binned; admins may restore any.
create or replace function public.restore_binned_notes(p_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
  v_done uuid[];
begin
  if p_ids is null or cardinality(p_ids) = 0 then
    return 0;
  end if;
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  with updated as (
    update public.notes n
    set
      deleted_at = null,
      deleted_by = null,
      updated_at = now()
    where n.id = any (p_ids)
      and n.owner_id = public.library_owner_id()
      and n.deleted_at is not null
      and (
        public.is_library_admin()
        or n.deleted_by = auth.uid()
      )
    returning n.id
  )
  select coalesce(array_agg(id), '{}'::uuid[]) into v_done from updated;

  v_count := coalesce(cardinality(v_done), 0);
  if v_count > 0 then
    perform public.log_library_audit('note.restore', 'note', v_done, '{}'::jsonb);
  end if;
  return v_count;
end;
$$;

grant execute on function public.restore_binned_notes(uuid[]) to authenticated;

-- ── Empty bin (admin) ─────────────────────────────────────────────────────
-- Returns note ids that were in the bin (caller removes storage, then deletes).
-- Password re-check is client-side; this RPC enforces admin role.
create or replace function public.empty_notes_bin()
returns uuid[]
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ids uuid[];
begin
  if not public.is_library_admin() then
    raise exception 'Only admins can empty the bin';
  end if;

  select coalesce(array_agg(n.id), '{}'::uuid[])
  into v_ids
  from public.notes n
  where n.owner_id = public.library_owner_id()
    and n.deleted_at is not null;

  if cardinality(v_ids) > 0 then
    perform public.log_library_audit(
      'note.empty_bin',
      'note',
      v_ids,
      jsonb_build_object('count', cardinality(v_ids))
    );
  end if;

  return v_ids;
end;
$$;

grant execute on function public.empty_notes_bin() to authenticated;

-- ── Discard own drafts / fresh imports (hard delete) ──────────────────────
create or replace function public.discard_own_notes(p_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
  v_done uuid[];
begin
  if p_ids is null or cardinality(p_ids) = 0 then
    return 0;
  end if;
  if not public.can_edit_library() then
    raise exception 'Not allowed';
  end if;

  with deleted as (
    delete from public.notes n
    where n.id = any (p_ids)
      and n.owner_id = public.library_owner_id()
      and n.created_by = auth.uid()
    returning n.id
  )
  select coalesce(array_agg(id), '{}'::uuid[]) into v_done from deleted;

  v_count := coalesce(cardinality(v_done), 0);
  if v_count > 0 then
    perform public.log_library_audit('note.discard', 'note', v_done, '{}'::jsonb);
  end if;
  return v_count;
end;
$$;

grant execute on function public.discard_own_notes(uuid[]) to authenticated;
