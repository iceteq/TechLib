-- Undirected related-note links (canonical note_id_a < note_id_b).
-- Shared-library RLS mirrors note_labels (member read / editor write).

create table if not exists public.note_links (
  note_id_a uuid not null references public.notes (id) on delete cascade,
  note_id_b uuid not null references public.notes (id) on delete cascade,
  primary key (note_id_a, note_id_b),
  check (note_id_a < note_id_b)
);

create index if not exists note_links_b_idx on public.note_links (note_id_b);

alter table public.note_links enable row level security;

drop policy if exists "note_links_owner_all" on public.note_links;
drop policy if exists "note_links_member_select" on public.note_links;
drop policy if exists "note_links_editor_insert" on public.note_links;
drop policy if exists "note_links_editor_update" on public.note_links;
drop policy if exists "note_links_editor_delete" on public.note_links;

create policy "note_links_member_select" on public.note_links
  for select using (
    exists (
      select 1 from public.notes n
      where n.id = note_id_a and n.owner_id = public.library_owner_id()
    )
    and exists (
      select 1 from public.notes n
      where n.id = note_id_b and n.owner_id = public.library_owner_id()
    )
  );

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
  );

create policy "note_links_editor_update" on public.note_links
  for update using (
    public.can_edit_library()
    and exists (
      select 1 from public.notes n
      where n.id = note_id_a and n.owner_id = public.library_owner_id()
    )
    and exists (
      select 1 from public.notes n
      where n.id = note_id_b and n.owner_id = public.library_owner_id()
    )
  )
  with check (
    public.can_edit_library()
    and exists (
      select 1 from public.notes n
      where n.id = note_id_a and n.owner_id = public.library_owner_id()
    )
    and exists (
      select 1 from public.notes n
      where n.id = note_id_b and n.owner_id = public.library_owner_id()
    )
  );

create policy "note_links_editor_delete" on public.note_links
  for delete using (
    public.can_edit_library()
    and exists (
      select 1 from public.notes n
      where n.id = note_id_a and n.owner_id = public.library_owner_id()
    )
    and exists (
      select 1 from public.notes n
      where n.id = note_id_b and n.owner_id = public.library_owner_id()
    )
  );
