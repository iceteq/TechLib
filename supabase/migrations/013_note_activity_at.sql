-- Wall order timestamp: advances only on part-number (title) or stock changes.
-- updated_at remains the concurrency / live-sync version clock.
alter table public.notes
  add column if not exists activity_at timestamptz;

-- Preserve current wall order for existing rows.
update public.notes
set activity_at = coalesce(activity_at, updated_at, created_at, now())
where activity_at is null;

alter table public.notes
  alter column activity_at set default now();

alter table public.notes
  alter column activity_at set not null;

create index if not exists notes_owner_activity_idx
  on public.notes (owner_id, activity_at desc);
