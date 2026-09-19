# Edge functions

## `note-ask`

Admin-only short answers for note Ask questions.

**Input (JSON):** `{ "question": string, "typeName": string }` only — no title/description.

**Auth:** caller JWT must pass `is_library_admin()`.

```bash
supabase secrets set OPENAI_API_KEY=sk-...
supabase functions deploy note-ask
```
