# Security

## Controls implemented in Phase 1

- HTTPS termination expected at reverse proxy in production
- Helmet HTTP headers on API
- JWT access tokens + rotating refresh tokens
- Argon2id password hashing
- Role-based access control on every route
- API rate limiting (Throttler)
- AES-256-GCM encryption for passport and Aadhaar fields
- Private document storage (not public gallery / not public CDN)
- Audit logging for auth, customer access, repayments, documents
- Validation pipes; whitelist DTOs
- Image upload MIME + size limits
- Path-traversal protection on document keys

## Explicitly not implemented

- Hidden / stealth application
- Secret dial-pad activation
- Silent native install from a website
- VPN-gated access (removed by product request)

## Never log

- Passwords
- Access / refresh tokens
- Passport numbers
- Aadhaar numbers
- Private document URLs with long-lived secrets

## Roles

| Role | Capabilities |
|------|----------------|
| SUPER_ADMIN | Full access including user management |
| ADMIN | Customers, loans, reports, audit |
| COLLECTOR | Register customers, collect assigned repayments |

Collectors do not receive full identity numbers in list views; detail unmasking is limited to admin roles.
