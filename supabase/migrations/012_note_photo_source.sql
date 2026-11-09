-- Photo source for the note's main (first) reference image.
-- po = purchase order, pick = pick location, return = customer return.
alter table public.notes
  add column if not exists photo_source text;

alter table public.notes
  drop constraint if exists notes_photo_source_check;

alter table public.notes
  add constraint notes_photo_source_check
  check (
    photo_source is null
    or photo_source in ('po', 'pick', 'return')
  );
