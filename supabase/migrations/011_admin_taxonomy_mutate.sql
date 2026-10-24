-- Shared taxonomy (labels, note types, stock locations) is library-wide.
-- Editors may still CREATE entries; only admins may UPDATE or DELETE so one
-- editor cannot wipe/rename the catalog or cascade-null metadata on all notes.

-- ── Labels ────────────────────────────────────────────────────────────────
drop policy if exists "labels_editor_update" on public.labels;
drop policy if exists "labels_editor_delete" on public.labels;
drop policy if exists "labels_admin_update" on public.labels;
drop policy if exists "labels_admin_delete" on public.labels;

create policy "labels_admin_update" on public.labels
  for update using (
    public.is_library_admin() and owner_id = public.library_owner_id()
  )
  with check (
    public.is_library_admin() and owner_id = public.library_owner_id()
  );

create policy "labels_admin_delete" on public.labels
  for delete using (
    public.is_library_admin() and owner_id = public.library_owner_id()
  );

-- ── Stock locations ───────────────────────────────────────────────────────
drop policy if exists "stock_editor_update" on public.stock_locations;
drop policy if exists "stock_editor_delete" on public.stock_locations;
drop policy if exists "stock_admin_update" on public.stock_locations;
drop policy if exists "stock_admin_delete" on public.stock_locations;

create policy "stock_admin_update" on public.stock_locations
  for update using (
    public.is_library_admin() and owner_id = public.library_owner_id()
  )
  with check (
    public.is_library_admin() and owner_id = public.library_owner_id()
  );

create policy "stock_admin_delete" on public.stock_locations
  for delete using (
    public.is_library_admin() and owner_id = public.library_owner_id()
  );

-- ── Note types ────────────────────────────────────────────────────────────
drop policy if exists "note_types_editor_update" on public.note_types;
drop policy if exists "note_types_editor_delete" on public.note_types;
drop policy if exists "note_types_admin_update" on public.note_types;
drop policy if exists "note_types_admin_delete" on public.note_types;

create policy "note_types_admin_update" on public.note_types
  for update using (
    public.is_library_admin() and owner_id = public.library_owner_id()
  )
  with check (
    public.is_library_admin() and owner_id = public.library_owner_id()
  );

create policy "note_types_admin_delete" on public.note_types
  for delete using (
    public.is_library_admin() and owner_id = public.library_owner_id()
  );
