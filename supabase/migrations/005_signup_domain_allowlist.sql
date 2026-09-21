-- Restrict new auth signups to @onitio.com (exact domain).
-- Grandfathered exception: anton.liampa@outlook.com (existing admin).
-- Sign-in for existing users is unaffected (trigger is BEFORE INSERT only).

create or replace function public.enforce_signup_email_domain()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  email_norm text := lower(trim(coalesce(new.email, '')));
  local_part text := split_part(email_norm, '@', 1);
  domain text := split_part(email_norm, '@', 2);
begin
  if email_norm = 'anton.liampa@outlook.com' then
    return new;
  end if;

  -- Exact domain only (rejects mail.onitio.com and multi-@ addresses).
  if local_part <> ''
     and domain = 'onitio.com'
     and split_part(email_norm, '@', 3) = '' then
    return new;
  end if;

  raise exception 'Signups are limited to @onitio.com email addresses.'
    using errcode = 'check_violation';
end;
$$;

drop trigger if exists enforce_signup_email_domain on auth.users;
create trigger enforce_signup_email_domain
  before insert on auth.users
  for each row
  execute function public.enforce_signup_email_domain();
