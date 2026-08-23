# Cloudflare Pages — TechLib

## Connect via GitHub (recommended)

1. Push this repo to GitHub (`git push`).
2. Open https://dash.cloudflare.com → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
3. Select the **TechLib** repository.
4. Build settings:
   - Framework preset: Vite
   - Build command: `npm run build`
   - Build output directory: `dist`
5. Environment variables (Production):
   - `VITE_SUPABASE_URL` = your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` = your Supabase anon key
6. Save and deploy. You’ll get a URL like `https://techlib.pages.dev`.

## After first deploy

In Supabase → Authentication → URL configuration:
- Site URL = your Pages URL
- Redirect URLs = include `https://your-project.pages.dev/**`

## Optional: deploy from your PC

```bash
npx wrangler login
npm run deploy
```

Still set the same env vars in the Cloudflare Pages project settings so production builds include them.
