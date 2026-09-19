-- One-level subtypes for product types (e.g. Cables → Network cable).
-- parent_id is null for top-level types; subtypes reference a top-level type.

alter table public.note_types
  add column if not exists parent_id text references public.note_types (id) on delete cascade;

create index if not exists note_types_owner_parent_idx
  on public.note_types (owner_id, parent_id);
