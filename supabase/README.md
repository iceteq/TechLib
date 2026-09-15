# Supabase setup (phone + PC sync + shared library roles)

1. Create a project at https://supabase.com
2. Copy **Project URL** and **anon public** key from **Project Settings → API**
3. Copy `.env.example` to `.env` and paste those values
4. In Supabase **SQL Editor**, run `supabase/schema.sql`
5. Then run `supabase/migrations/001_workspace_roles.sql` (shared library + viewer/editor/admin)
6. (Recommended) **Authentication → Providers → Email**:
   turn **off** “Confirm email” so signup signs you in immediately
7. Restart `npm run dev`, open the app, **Sign up once** with your email  
   - First account becomes **admin** of the shared library  
   - Later accounts join as **viewers** (browse only) until an admin promotes them

Without `.env`, the app still works in **local-only** IndexedDB mode (no login, no phone sync).

Existing local notes are **not** migrated automatically yet — cloud starts empty for your account (unless you already created notes as the first/admin user).
