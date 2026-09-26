# Deployment — auto GitHub → Vercel → Cloudflare

## How updates ship (automatic)

```text
Edit code (Cursor / locally)
  → git commit + git push origin main
      → GitHub repo ameenruks33-cyber/nvr-io
          → Vercel Git Integration auto-builds production
                • nvr-io-web  → https://nvr-io-web.vercel.app
                • nvr-io-api  → https://nvr-io-api.vercel.app
          → Cloudflare (when your domain CNAMEs to Vercel) serves the new CDN edge
```

In this workspace:

- Cursor rule `.cursor/rules/auto-ship.mdc` — agent pushes after meaningful changes  
- Cursor stop hook `.cursor/hooks/` — reminds the agent to ship if the tree is dirty  
- `npm run ship` — commit (if needed) + push in one command  

You do **not** need a manual `vercel deploy` for routine updates once Git is linked.

## One-time links (already done for this project)

| Service | Status |
|---------|--------|
| GitHub `ameenruks33-cyber/nvr-io` | Connected |
| Vercel `nvr-io-web` | Git-connected |
| Vercel `nvr-io-api` | Git-connected (`rootDirectory=backend`) |
| Neon `nvr-io-db` | Attached to API |
| Cloudflare Wrangler | Logged in; enable R2 in dashboard for uploads |

## Optional GitHub Actions backup

Add repo secrets if you want Actions to deploy as a second path:

- `VERCEL_TOKEN` (from https://vercel.com/account/tokens)
- `VERCEL_ORG_ID` = `team_JSFALASfsTpSVJhhfE3PLgxz`
- `VERCEL_WEB_PROJECT_ID` = `prj_Ob7gOci2u1c1GzuA3BBbjbI6otzk`
- `VERCEL_API_PROJECT_ID` = `prj_6oEGaCXH2PSJniLepXMkEv2Hm6bd`

Workflow: `.github/workflows/deploy.yml`

## Cloudflare

See `infrastructure/cloudflare/README.md`:

1. Point domain nameservers to Cloudflare  
2. CNAME `@` / `www` / `api` → Vercel DNS targets (orange cloud)  
3. SSL/TLS **Full (strict)**  
4. Enable R2 once, create `nvr-io-uploads`, set `R2_*` on the API project  

CDN content refreshes automatically when Vercel publishes a new deployment.

## App updates (installed devices)

Update file: `apps/web/public/app-update.json` (served as `/app-update.json`)

- Every `npm run ship` / `npm run build:web` bumps the version automatically  
- Installed PWAs check the file every minute (and on app open)  
- Banner appears at the top → **Update now**  
- Optional system notification if the user allowed notifications on `/app` or `/updates`  

Manual bump:

```bash
npm run bump:update -- "Fixed gallery upload"
npm run ship
```
