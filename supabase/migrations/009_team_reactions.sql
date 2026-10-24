-- Phase 4: team-visible reaction counts.
-- Members can SELECT reactions on library notes; writes stay personal.

drop policy if exists "reactions_own" on public.reactions;
drop policy if exists "reactions_owner_all" on public.reactions;
drop policy if exists "reactions_member_select" on public.reactions;
drop policy if exists "reactions_own_insert" on public.reactions;
drop policy if exists "reactions_own_update" on public.reactions;
drop policy if exists "reactions_own_delete" on public.reactions;

create policy "reactions_member_select" on public.reactions
  for select using (
    public.is_library_member()
    and exists (
      select 1
      from public.notes n
      where n.id = note_id
        and n.owner_id = public.library_owner_id()
    )
  );

create policy "reactions_own_insert" on public.reactions
  for insert with check (
    public.is_library_member()
    and auth.uid() = owner_id
    and exists (
      select 1
      from public.notes n
      where n.id = note_id
        and n.owner_id = public.library_owner_id()
    )
  );

create policy "reactions_own_update" on public.reactions
  for update using (
    public.is_library_member() and auth.uid() = owner_id
  )
  with check (
    public.is_library_member() and auth.uid() = owner_id
  );

create policy "reactions_own_delete" on public.reactions
  for delete using (
    public.is_library_member() and auth.uid() = owner_id
  );

-- Live wall: surface reaction changes to other clients.
do $$
begin
  begin
    alter publication supabase_realtime add table public.reactions;
  exception
    when duplicate_object then null;
    when undefined_object then null;
  end;
end $$;
