-- Lightweight member directory for note author labels on the wall.
-- Any library member may read user_id + email (no roles). Admins still use
-- list_workspace_members for role management.

create or replace function public.list_library_member_labels()
returns table (
  user_id uuid,
  email text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  ws uuid := public.current_workspace_id();
begin
  if ws is null then
    raise exception 'Not a library member';
  end if;

  return query
  select m.user_id, u.email::text
  from public.workspace_members m
  join auth.users u on u.id = m.user_id
  where m.workspace_id = ws
  order by u.email asc;
end;
$$;

grant execute on function public.list_library_member_labels() to authenticated;
