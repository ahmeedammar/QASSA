# QASSA (قصّة)

Multi-tenant SaaS platform for Tunisian barbershops: public marketplace (Discover),
generated shop websites, owner dashboard (Studio) and platform administration (Control).

**Stack:** Next.js App Router · TypeScript · Tailwind CSS v4 · Supabase (Postgres + Auth + Storage) · Vercel

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in placeholders
npm run dev
```

## Environment variables

See [.env.example](.env.example). Rules:

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — browser-visible, anon key only.
- `SUPABASE_SERVICE_ROLE_KEY` — server-only, never `NEXT_PUBLIC_`, never commit.
- `UPSTASH_REDIS_*` — production rate limiting (dev works without it, as a no-op).

## Database

Ordered migrations live in [`supabase/migrations/`](supabase/migrations). Apply them
with `supabase db push` (CLI linked project) or paste into the SQL editor in order.
The initial platform owner is bootstrapped once via
[`supabase/seed_platform_owner.sql`](supabase/seed_platform_owner.sql) — there is no
self-promotion path in the application.

## Security model (summary)

- RLS on every table; tenant access resolved through security-definer membership
  functions, never browser-supplied `shop_id`.
- Admin operations verified server-side per request in `requireAdmin()`
  (session → active `platform_admins` record → role permission → MFA AAL2),
  with step-up checks for sensitive actions. Middleware and layouts are UX only.
- Audit trail is append-only through a security-definer RPC.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run typecheck` | TypeScript, no emit |
| `npm run lint` | ESLint |
| `npm test` | Vitest unit tests |

## Milestones

1. **Foundation** (this branch) — design system, i18n (ar/fr/en + RTL), auth, migrations, RLS, admin authorization, audit, rate limiting.
2. Discover marketplace + five shop website templates.
3. Booking engine with database-level double-booking prevention.
4. QASSA Studio owner dashboard.
5. QASSA Control platform administration.
6. Security verification (adversarial tests against Part 18 checklist).
7. k6 load test — 30 concurrent users, measured results.
8. Production readiness (env, CSP nonce hardening, backups, monitoring).
