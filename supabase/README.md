# Supabase setup (phone + PC sync + shared library roles)

1. Create a project at https://supabase.com
2. Copy **Project URL** and **anon public** key from **Project Settings → API**
3. Copy `.env.example` to `.env` and paste those values
4. In Supabase **SQL Editor**, run `supabase/schema.sql`
5. Then run `supabase/migrations/001_workspace_roles.sql` (shared library + viewer/editor/admin)
6. Run `supabase/migrations/002_note_type_parent.sql` (one-level subtypes)
7. Run `supabase/migrations/003_note_ask_items.sql` (admin AI ask Q&A on notes)
8. Run `supabase/migrations/004_note_links.sql` (related notes)
9. (Recommended) **Authentication → Providers → Email**:
   turn **off** “Confirm email” so signup signs you in immediately
10. Restart `npm run dev`, open the app, **Sign up once** with your email  
   - First account becomes **admin** of the shared library  
   - Later accounts join as **viewers** (browse only) until an admin promotes them

### Optional: AI Ask (admin only)

1. Deploy the edge function: `supabase functions deploy note-ask`
2. Set the secret: `supabase secrets set OPENAI_API_KEY=sk-...`
3. Admins see an **Ask** section on notes: 1–3 questions, answered with type + question only (no title/description sent to the model)

Without `.env`, the app still works in **local-only** IndexedDB mode (no login, no phone sync).

Existing local notes are **not** migrated automatically yet — cloud starts empty for your account (unless you already created notes as the first/admin user).
