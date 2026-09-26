# NVR.io

Personal records and payment tracking app.

**App name:** NVR.io · **Personal use only**  
**Phase 1:** API + database + web app  
**Phase 2:** Flutter mobile (see `apps/mobile`)

Install with user permission: [/app](http://localhost:3000/app)

## Cloud (Vercel + Cloudflare)

```bash
npm run cloud:setup      # login + link projects + create R2 bucket
npm run cloud:deploy:web
npm run cloud:deploy:api
```

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

> Demo / development software. Obtain UAE legal and CBUAE compliance review before using for real lending, identity collection, or commercial collections.

## Stack

| Layer | Tech |
|-------|------|
| Web | Next.js 15, TypeScript, Tailwind |
| API | NestJS, JWT, Argon2id, RBAC |
| DB | PostgreSQL + Prisma |
| Storage | Private local uploads (S3-ready env) |

## Quick start

### 1. Environment

```bash
cp .env.example .env
cp .env.example backend/.env
```

Generate a real 32-byte field key:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Put the output in `FIELD_ENCRYPTION_KEY` in both `.env` files.

### 2. Database

**Local (default):** SQLite — no Postgres password needed. Schema creates `backend/prisma/dev.db` on first push.

```bash
npm run db:generate
cd backend && npx prisma db push && npx prisma db seed
```

**Production:** use PostgreSQL via Docker Compose (`infrastructure/docker/docker-compose.yml`) and switch Prisma `provider` to `postgresql`.

### 3. Install & migrate

```bash
npm install
npm run db:generate
npm run db:migrate
npm run db:seed
```

### 4. Run

```bash
npm run dev:api
# other terminal
npm run dev:web
```

- Web: http://localhost:3000  
- API: http://localhost:4000/api/health  

### Seed logins

| Role | Email | Password |
|------|-------|----------|
| Super Admin | `admin@jithubuy.local` | `ChangeMeAdmin123!` |
| Collector | `collector@jithubuy.local` | `Collector123!` |

## Security posture (Phase 1)

- No stealth / dial-code hidden app
- No silent website install (PWA + store distribution only)
- Passport / Aadhaar encrypted at rest (AES-256-GCM)
- Sensitive IDs excluded from logs, URLs, list search, and notifications
- Server-side repayment math inside DB transactions
- Audit trail for login, customer access, repayments, documents

## Docs

- [API](docs/API.md)
- [Database](docs/DATABASE.md)
- [Security](docs/SECURITY.md)
- [Deployment](docs/DEPLOYMENT.md)
- [Privacy](docs/PRIVACY.md)
