# Deployment — Vercel + Cloudflare

## Automatic setup

From the repo root (browser login windows will open):

```bash
npm run cloud:setup
```

This will:
1. Log in to **Vercel**
2. Link the **web** app (`apps/web`) and **API** (`backend`)
3. Log in to **Cloudflare** (Wrangler)
4. Create the **R2** bucket `nvr-io-uploads`

## After setup (you must do once)

1. Create a **Neon Postgres** database (https://neon.tech or Vercel → Storage → Neon).
2. Before cloud DB push, set Prisma to Postgres temporarily:
   - In `backend/prisma/schema.prisma` set `provider = "postgresql"`
   - Set `DATABASE_URL` to your Neon URL
   - Run `cd backend && npx prisma db push && npx prisma db seed`
3. In **both** Vercel projects → Settings → Environment Variables, paste values from `.env.production.example`.
4. Create Cloudflare R2 API tokens; set `R2_*` on the API project.
5. In Cloudflare DNS, CNAME your domain to Vercel; add the domain in Vercel → Domains.
6. Deploy:

```bash
npm run cloud:deploy:web
npm run cloud:deploy:api
```

## GitHub Actions

Add repository secrets:
- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_WEB_PROJECT_ID`
- `VERCEL_API_PROJECT_ID`

Push to `main` deploys automatically (see `.github/workflows/deploy.yml`).

## Local vs cloud

| | Local | Cloud |
|--|-------|-------|
| Web | `npm run dev:web` | Vercel |
| API | `npm run dev:api` | Vercel serverless |
| DB | SQLite `file:./dev.db` | Neon Postgres |
| Files | `./uploads` | Cloudflare R2 |
