# Database

PostgreSQL via Prisma. Schema: `backend/prisma/schema.prisma`.

## Tables

- `users` — staff with RBAC
- `refresh_tokens` — hashed refresh tokens
- `customers` — borrower profile; passport/aadhaar encrypted columns
- `loans` — principal, collected, remaining, status
- `repayments` — receipt + optional idempotency key
- `documents` — private storage keys
- `notifications` — completion / repayment messages (no identity numbers)
- `audit_logs` — security/compliance trail

## Commands

```bash
npm run db:generate
npm run db:migrate
npm run db:seed
```

## Retention note

CBUAE-oriented deployments should retain customer records securely for at least five years. Configure backup retention in production accordingly (see DEPLOYMENT.md).
