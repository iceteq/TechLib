# Cloudflare — TechLib

TechLib is a static Vite app. With Cloudflare’s current UI, the simplest path is a **Worker that serves static assets** (not a separate Pages project name).

## Build settings (dashboard)

Use these exactly:

| Field | Value |
|--------|--------|
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy` |
| Version command | *(empty, or leave default)* |
| Root directory | `/` |

### Variables and secrets

Add (Production):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

(same values as your local `.env`)

## Why `pages deploy` failed

`npx wrangler pages deploy … --project-name techlib` needs an existing **Pages** project named `techlib`.

Your Git build is set up as a **Workers** pipeline. So use:

```bash
npx wrangler deploy
```

`wrangler.toml` points at `./dist` as static assets (SPA via `not_found_handling`).

Do **not** add a `public/_redirects` rule of `/* /index.html` — that conflicts with Workers assets and fails deploy with “Infinite loop detected”.

## After it deploys

You’ll get a `*.workers.dev` URL (or a custom domain).

In Supabase → Authentication → URL configuration:

- Site URL = that URL  
- Redirect URLs = `https://your-subdomain.workers.dev/**`

## Optional: deploy from your PC

```bash
npx wrangler login
npm run deploy
```
