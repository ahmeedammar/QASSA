# QASSA — Production Readiness Checklist & Runbook

> [!IMPORTANT]
> This document details the production operational readiness standards for QASSA, encompassing environment variable isolation, CSP nonce hardening, automated backup verification, health monitoring, and edge rate limiting.

---

## 1. Environment Variable Hygiene

- **Public variables (`NEXT_PUBLIC_*`):**
  - Only `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `NEXT_PUBLIC_SITE_URL` are browser-exposed.
  - Browser-visible keys are restricted by PostgreSQL Row Level Security (RLS) on all tables.
- **Server-only variables:**
  - `SUPABASE_SERVICE_ROLE_KEY`: Reserved strictly for maintenance / seeding scripts, never exposed in client bundles.
  - `UPSTASH_REDIS_REST_URL` & `UPSTASH_REDIS_REST_TOKEN`: Configured in Vercel / serverless environment to activate distributed sliding-window rate limiting.
- **Pre-deployment Verification:**
  ```bash
  npm run check:env
  ```

---

## 2. Content Security Policy (CSP) with Nonces

- Cryptographic nonces generated per-request in `src/proxy.ts`.
- `strict-dynamic` directive enforces that only scripts matching the cryptographic nonce or dynamically dispatched by them may execute.
- Direct inline `<script>` injection attacks (XSS) are defeated.
- Clickjacking and framing are blocked via `frame-ancestors 'none'` and `X-Frame-Options: DENY`.
- HTTPS strict transport security is enforced via `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`.

---

## 3. Database Backup & Disaster Recovery

- **Continuous WAL Archiving:** 7-day continuous Point-In-Time-Recovery (PITR).
- **Scheduled Schema & Data Dumps:**
  ```bash
  npm run db:backup
  ```
- **Integrity Validation:** All dumps registered with SHA256 checksums in `backups/manifest.json`.
- Full recovery runbook documented in [`docs/BACKUP_AND_RECOVERY.md`](./BACKUP_AND_RECOVERY.md).

---

## 4. Monitoring & Health Probes

- **Liveness & Readiness Probe:**
  `GET /api/health`
  - Returns HTTP 200 with structured JSON when Supabase is connected.
  - Returns HTTP 503 if primary database connectivity fails.
  - Monitors latency for database and Redis cache probes.
- **Structured Error Logging:**
  - `src/lib/monitoring.ts` formats logs with ISO timestamps, correlation `traceId`, and automatic redaction of sensitive credentials.

---

## 5. Operations Scripts Reference

| Script | Command | Purpose |
|---|---|---|
| Environment check | `npm run check:env` | Verifies required environment keys before deployment |
| Unit & Integration tests | `npm test` | Runs the full Vitest test suite |
| Database checks | `npm run test:db` | Adversarial SQL checks on loopback Postgres |
| Load testing | `npm run test:load` | 30-VU concurrency verification with k6 |
| Database backup | `npm run db:backup` | Generates timestamped, hashed database backup |
| Type check | `npm run typecheck` | Strict TypeScript verification |
| Production build | `npm run build` | Compiles optimized Next.js assets |
