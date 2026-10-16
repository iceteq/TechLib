-- Author-scoped note/image edits: editors mutate only what they created;
-- admins can mutate any library content.

-- ── Columns ───────────────────────────────────────────────────────────────
alter table public.notes
  add column if not exists created_by uuid references auth.users (id);

alter table public.note_images
  add column if not exists created_by uuid references auth.users (id);

-- Existing rows: treat as authored by the library owner (workspace owner_id).
update public.notes
set created_by = owner_id
where created_by is null;

update public.note_images
set created_by = owner_id
where created_by is null;

alter table public.notes
  alter column created_by set not null;

alter table public.note_images
  alter column created_by set not null;

alter table public.notes
  alter column created_by set default auth.uid();

alter table public.note_images
  alter column created_by set default auth.uid();

create index if not exists notes_created_by_idx on public.notes (created_by);
create index if not exists note_images_created_by_idx on public.note_images (created_by);

-- ── Helper ────────────────────────────────────────────────────────────────
create or replace function public.can_mutate_authored_row(p_created_by uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_library_admin()
    or (
      public.can_edit_library()
      and p_created_by is not null
      and p_created_by = auth.uid()
    );
$$;

grant execute on function public.can_mutate_authored_row(uuid) to authenticated;

-- True when the current user may change images / labels / storage for this note.
create or replace function public.can_mutate_note_id(p_note_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.notes n
    where n.id = p_note_id
      and n.owner_id = public.library_owner_id()
      and public.can_mutate_authored_row(n.created_by)
  );
$$;

grant execute on function public.can_mutate_note_id(uuid) to authenticated;

-- ── Notes policies ────────────────────────────────────────────────────────
drop policy if exists "notes_editor_insert" on public.notes;
drop policy if exists "notes_editor_update" on public.notes;
drop policy if exists "notes_editor_delete" on public.notes;

create policy "notes_editor_insert" on public.notes
  for insert with check (
    public.can_edit_library()
    and owner_id = public.library_owner_id()
    and created_by = auth.uid()
  );

create policy "notes_editor_update" on public.notes
  for update using (
    owner_id = public.library_owner_id()
    and public.can_mutate_authored_row(created_by)
  )
  with check (
    owner_id = public.library_owner_id()
    and (
      public.is_library_admin()
      or (public.can_edit_library() and created_by = auth.uid())
    )
  );

create policy "notes_editor_delete" on public.notes
  for delete using (
    owner_id = public.library_owner_id()
    and public.can_mutate_authored_row(created_by)
  );

-- ── Note images policies ──────────────────────────────────────────────────
drop policy if exists "note_images_editor_insert" on public.note_images;
drop policy if exists "note_images_editor_update" on public.note_images;
drop policy if exists "note_images_editor_delete" on public.note_images;

create policy "note_images_editor_insert" on public.note_images
  for insert with check (
    owner_id = public.library_owner_id()
    and created_by = auth.uid()
    and public.can_mutate_note_id(note_id)
  );

create policy "note_images_editor_update" on public.note_images
  for update using (
    owner_id = public.library_owner_id()
    and public.can_mutate_note_id(note_id)
  )
  with check (
    owner_id = public.library_owner_id()
    and public.can_mutate_note_id(note_id)
  );

create policy "note_images_editor_delete" on public.note_images
  for delete using (
    owner_id = public.library_owner_id()
    and public.can_mutate_note_id(note_id)
  );

-- ── Note labels: only mutate when the note is mutable ─────────────────────
drop policy if exists "note_labels_editor_insert" on public.note_labels;
drop policy if exists "note_labels_editor_update" on public.note_labels;
drop policy if exists "note_labels_editor_delete" on public.note_labels;

create policy "note_labels_editor_insert" on public.note_labels
  for insert with check (public.can_mutate_note_id(note_id));

create policy "note_labels_editor_update" on public.note_labels
  for update using (public.can_mutate_note_id(note_id))
  with check (public.can_mutate_note_id(note_id));

create policy "note_labels_editor_delete" on public.note_labels
  for delete using (public.can_mutate_note_id(note_id));

-- ── Note links: editor must be able to mutate at least one endpoint ───────
drop policy if exists "note_links_editor_insert" on public.note_links;
drop policy if exists "note_links_editor_update" on public.note_links;
drop policy if exists "note_links_editor_delete" on public.note_links;

create policy "note_links_editor_insert" on public.note_links
  for insert with check (
    public.can_edit_library()
    and exists (
      select 1 from public.notes n
      where n.id = note_id_a and n.owner_id = public.library_owner_id()
    )
    and exists (
      select 1 from public.notes n
      where n.id = note_id_b and n.owner_id = public.library_owner_id()
    )
    and (
      public.is_library_admin()
      or public.can_mutate_note_id(note_id_a)
      or public.can_mutate_note_id(note_id_b)
    )
  );

create policy "note_links_editor_update" on public.note_links
  for update using (
    public.is_library_admin()
    or public.can_mutate_note_id(note_id_a)
    or public.can_mutate_note_id(note_id_b)
  )
  with check (
    public.is_library_admin()
    or public.can_mutate_note_id(note_id_a)
    or public.can_mutate_note_id(note_id_b)
  );

create policy "note_links_editor_delete" on public.note_links
  for delete using (
    public.is_library_admin()
    or public.can_mutate_note_id(note_id_a)
    or public.can_mutate_note_id(note_id_b)
  );

-- ── Storage: path is {libraryOwner}/{noteId}/{imageId} ────────────────────
drop policy if exists "note_images_storage_insert" on storage.objects;
drop policy if exists "note_images_storage_update" on storage.objects;
drop policy if exists "note_images_storage_delete" on storage.objects;

create policy "note_images_storage_insert"
  on storage.objects for insert
  with check (
    bucket_id = 'note-images'
    and (storage.foldername(name))[1] = public.library_owner_id()::text
    and public.can_mutate_note_id(((storage.foldername(name))[2])::uuid)
  );

create policy "note_images_storage_update"
  on storage.objects for update
  using (
    bucket_id = 'note-images'
    and (storage.foldername(name))[1] = public.library_owner_id()::text
    and public.can_mutate_note_id(((storage.foldername(name))[2])::uuid)
  );

create policy "note_images_storage_delete"
  on storage.objects for delete
  using (
    bucket_id = 'note-images'
    and (storage.foldername(name))[1] = public.library_owner_id()::text
    and public.can_mutate_note_id(((storage.foldername(name))[2])::uuid)
  );
