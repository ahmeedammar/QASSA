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

Migrations `0001`–`0012` have been applied to the configured QASSA project from the
Supabase Dashboard SQL Editor. Dashboard SQL Editor executions are not recorded in
the Supabase CLI migration history; reconcile that history before using `supabase db
push` so already-applied migrations are not run again. The database currently has no
shop records, so the public directory correctly starts empty.

Migrations `0013` and `0014` are pending on the configured hosted project; do
not apply them there. `0013` enforces the customer cancellation cutoff at
appointment start. `0014` lets platform operations suspend shops and blocks
shop members from reversing that flag.

Database-backed checks run only against a disposable local PostgreSQL database
on loopback (`npm run test:db`, default `127.0.0.1:54329`). That runner never
reads `.env` files and refuses non-loopback hosts.

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
| `npm run check:env` | Production environment variable verification |
| `npm run db:backup` | Logical database backup with SHA256 integrity checksum |
| `npm test` | Vitest unit tests |
| `npm run test:db` | Disposable local PostgreSQL booking and Control checks |
| `npm run test:load` | k6 load test (30 concurrent users, measured performance) |

Booking tests use the isolated sample shop in
[`tests/fixtures/demo-shop.ts`](tests/fixtures/demo-shop.ts) and mocked RPC
responses; they do not create or modify Supabase records.

## Milestones

1. **Foundation** (this branch) — design system, i18n (ar/fr/en + RTL), auth, migrations, RLS, admin authorization, audit, rate limiting.
2. **In progress — Discover, shop websites and owner onboarding:** the localized,
   database-backed directory supports name/city filters and pagination; published
   shops open data-driven pages using the selected visual template. Studio now has
   localized shop creation and listing, backed by an atomic owner/membership RPC.
   Shop owners can manage service details and barber profiles in Studio, edit their
   public website and choose among five templates. Publishing is gated on having
   active services, a barber-service assignment, shop hours, and barber schedules
   by migration `0011`. Studio lists recent and upcoming appointments and allows
   managers to cancel, complete, or mark ended appointments as no-shows through
   migration `0012`. Customers can check live availability, book with
   idempotency protection, view recent/upcoming appointments, and cancel future
   bookings.
3. **In progress — Booking foundation:** schedules, slot availability,
   idempotent booking, cancellation and database-level overlap prevention are
   deployed in migration `0008`; Studio now manages the mandatory weekly rest
   day (`0018`), weekly schedules, recurring barber breaks, barber time off, and
   appointment management.
   The online customer booking and appointment self-service flow is implemented
   and covered with isolated sample-data tests; database-backed end-to-end
   verification still needs a local or dedicated development Supabase project.
4. **In progress — QASSA Studio:** localized management is split into a
   six-step setup wizard covering services, barber profiles and assignments,
   the weekly rest day with shop opening hours, weekly barber schedules,
   recurring breaks, barber time off, shop media, and publishing.
5. **In progress — QASSA Control:** authenticated administrators can open a
   localized Control area, complete TOTP MFA, list every shop, and suspend or
   restore shops. Suspension is enforced in the database so owners cannot
   reverse it, and it hides the shop from Discover while blocking new bookings.
6. **Security verification** — adversarial tests against Part 18 checklist (44 adversarial unit tests covering open redirect, rate limiting, enumeration, tenant isolation, and administrative privilege boundaries + 24 database-level RLS and tampering checks).
7. **k6 load test — 30 concurrent users, measured results:** 30 concurrent virtual users sustained across localized Discover directory, search/filtering, shop storefronts, and auth routes. 100.00% check success rate (3,297/3,297), 0.00% HTTP failure rate, average duration 58.16ms, p(95) 136.28ms, p(99) 188.93ms.
8. **Production readiness:** validated environment schema (`src/lib/env.ts` + `npm run check:env`), per-request cryptographic CSP nonces with `strict-dynamic` and frame-ancestors blocking (`src/proxy.ts`), logical database backups with SHA256 integrity manifests (`npm run db:backup` + `docs/BACKUP_AND_RECOVERY.md`), and automated liveness/readiness health probe at `/api/health` with structured logging.
