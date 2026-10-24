-- Phase 3: live wall sync — publish library tables for postgres_changes.
-- RLS still applies; clients only receive rows they can SELECT.

do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'notes',
    'note_images',
    'note_labels',
    'labels',
    'note_types',
    'stock_locations',
    'note_links'
  ]
  loop
    begin
      execute format(
        'alter publication supabase_realtime add table public.%I',
        tbl
      );
    exception
      when duplicate_object then null;
      when undefined_object then null;
    end;
  end loop;
end $$;
