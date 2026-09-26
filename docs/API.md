# API

Base URL: `http://localhost:4000/api`

All endpoints except `/health` and `/auth/login` + `/auth/refresh` require  
`Authorization: Bearer <accessToken>`.

## Auth

| Method | Path | Notes |
|--------|------|-------|
| POST | `/auth/login` | `{ email, password }` |
| POST | `/auth/refresh` | `{ refreshToken }` |
| POST | `/auth/logout` | Auth required |

## Customers

| Method | Path | Roles |
|--------|------|-------|
| POST | `/customers` | SUPER_ADMIN, ADMIN, COLLECTOR |
| GET | `/customers?q=` | search code/name/phone |
| GET | `/customers/:id` | detail (sensitive IDs for admin roles) |
| POST | `/customers/:id/photo` | multipart `photo` |

## Loans & repayments

| Method | Path | Notes |
|--------|------|-------|
| GET | `/loans` | optional `?status=ACTIVE` |
| GET | `/loans/:id` | |
| POST | `/loans/:id/repayments` | body `{ amount, notes?, latitude?, longitude?, idempotencyKey? }` or header `Idempotency-Key` |
| GET | `/loans/:id/repayments` | |
| GET | `/repayments` | recent |

Completion when `amountCollected >= principalAmount` (default 1800).

## Other

| Method | Path |
|--------|------|
| GET | `/dashboard` |
| GET | `/notifications` |
| GET | `/users` |
| POST | `/users` | SUPER_ADMIN |
| GET | `/audit` | SUPER_ADMIN, ADMIN |
| GET | `/documents/by-storage/:key` | private photo stream |
| GET | `/health` | public |
