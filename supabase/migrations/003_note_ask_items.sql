-- Admin-curated short Q&A pins on notes (OpenAI answers stored here).
alter table public.notes
  add column if not exists ask_items jsonb not null default '[]'::jsonb;
