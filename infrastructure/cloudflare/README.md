# Cloudflare + Vercel for NVR.io
#
# Architecture:
#   Browser → Cloudflare DNS/CDN/WAF → Vercel (Next.js web)
#                                  ↘ Vercel (Nest API) or API subdomain
#   Uploads → Cloudflare R2 (S3 API)
#   Database → Neon Postgres (Vercel Marketplace) or your Postgres
#
# One-time setup (run from repo root):
#   npm run cloud:setup
#
# Requires:
#   - Vercel account (https://vercel.com)
#   - Cloudflare account (https://dash.cloudflare.com)
#   - Neon Postgres (free) OR any Postgres URL for production
#
# After setup, set these in Vercel Project Settings → Environment Variables
# (both Web and API projects), and Cloudflare R2 API tokens.

## DNS (Cloudflare)

| Record | Type | Target |
|--------|------|--------|
| `@` / `www` | CNAME | `cname.vercel-dns.com` (Vercel assigns exact target) |
| `api` | CNAME | Vercel API project DNS target |

Enable Cloudflare proxy (orange cloud) for CDN/WAF. Keep SSL/TLS mode **Full (strict)**.

## R2

Account ID (Wrangler): `5be1df0639fc9310e4a1f27f5da95400`

1. Enable R2 once in the Cloudflare dashboard: https://dash.cloudflare.com/?to=/:account/r2
2. `npx wrangler login`
3. `npx wrangler r2 bucket create nvr-io-uploads`
4. Create R2 API token with Object Read/Write
5. Set `STORAGE_DRIVER=r2` and R2_* env vars on the API project

(As of first cloud setup, step 1 was still required — bucket create fails with code 10042 until R2 is enabled.)

## Auto updates

After the GitHub repo is linked to Vercel, every `git push` to `main` refreshes production.
Point Cloudflare DNS at Vercel so the CDN follows those deploys automatically.

See `docs/DEPLOYMENT.md` for the full auto-ship pipeline (Cursor hook + `npm run ship`).
