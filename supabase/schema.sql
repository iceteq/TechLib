-- TechLib Supabase schema (solo owner now; ready for later sharing)
-- Run this once in: Supabase Dashboard → SQL Editor → New query

-- Stock locations (bay / shelf codes) — before notes so notes.stock_id can FK
create table if not exists public.stock_locations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (owner_id, name)
);

-- Notes
create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  title text not null default '',
  description text not null default '',
  background text not null default 'default',
  disposition text not null default 'none',
  category text not null default 'none',
  special_case text not null default '',
  stock_id uuid references public.stock_locations (id) on delete set null,
  pinned boolean not null default false,
  archived boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists notes_owner_updated_idx
  on public.notes (owner_id, updated_at desc);

-- For databases created before stock_id existed
alter table public.notes
  add column if not exists stock_id uuid references public.stock_locations (id) on delete set null;

-- Labels
create table if not exists public.labels (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (owner_id, name)
);

-- Note ↔ label
create table if not exists public.note_labels (
  note_id uuid not null references public.notes (id) on delete cascade,
  label_id uuid not null references public.labels (id) on delete cascade,
  primary key (note_id, label_id)
);

-- Image metadata (files live in Storage bucket note-images)
create table if not exists public.note_images (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references public.notes (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  storage_path text not null,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists note_images_note_idx
  on public.note_images (note_id, position);

-- Cart
create table if not exists public.cart_items (
  owner_id uuid not null references auth.users (id) on delete cascade,
  note_id uuid not null references public.notes (id) on delete cascade,
  quantity integer not null default 1 check (quantity > 0),
  primary key (owner_id, note_id)
);

-- Reactions (kept for parity with local mode)
create table if not exists public.reactions (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references public.notes (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  emoji text not null,
  count integer not null default 1 check (count > 0),
  unique (note_id, owner_id, emoji)
);

-- RLS
alter table public.notes enable row level security;
alter table public.labels enable row level security;
alter table public.stock_locations enable row level security;
alter table public.note_labels enable row level security;
alter table public.note_images enable row level security;
alter table public.cart_items enable row level security;
alter table public.reactions enable row level security;

create policy "notes_owner_all" on public.notes
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "labels_owner_all" on public.labels
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "stock_locations_owner_all" on public.stock_locations
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "note_labels_owner_all" on public.note_labels
  for all using (
    exists (
      select 1 from public.notes n
      where n.id = note_id and n.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.notes n
      where n.id = note_id and n.owner_id = auth.uid()
    )
  );

create policy "note_images_owner_all" on public.note_images
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "cart_items_owner_all" on public.cart_items
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "reactions_owner_all" on public.reactions
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- Storage bucket for note photos
insert into storage.buckets (id, name, public)
values ('note-images', 'note-images', false)
on conflict (id) do nothing;

create policy "note_images_storage_select"
  on storage.objects for select
  using (bucket_id = 'note-images' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "note_images_storage_insert"
  on storage.objects for insert
  with check (bucket_id = 'note-images' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "note_images_storage_update"
  on storage.objects for update
  using (bucket_id = 'note-images' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "note_images_storage_delete"
  on storage.objects for delete
  using (bucket_id = 'note-images' and auth.uid()::text = (storage.foldername(name))[1]);
