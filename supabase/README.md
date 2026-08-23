# Supabase setup (phone + PC sync)

1. Create a project at https://supabase.com
2. Copy **Project URL** and **anon public** key from **Project Settings → API**
3. Copy `.env.example` to `.env` and paste those values
4. In Supabase **SQL Editor**, run the contents of `supabase/schema.sql`
5. (Recommended for solo use) **Authentication → Providers → Email**:
   turn **off** “Confirm email” so signup signs you in immediately
6. Restart `npm run dev`, open the app, **Sign up once** with your email

Without `.env`, the app still works in **local-only** IndexedDB mode (no login, no phone sync).

Existing local notes are **not** migrated automatically yet — cloud starts empty for your account.
