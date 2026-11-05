# QASSA — Database Backup and Disaster Recovery Runbook

> [!IMPORTANT]
> This runbook defines the Recovery Point Objective (RPO) and Recovery Time Objective (RTO) for the QASSA multi-tenant platform, detailing daily logical backups, Supabase automated WAL archiving, and disaster recovery procedures.

---

## 1. Objectives & SLAs

| Metric | Target | Description |
|---|---|---|
| **RPO (Recovery Point Objective)** | `< 1 Hour` | Maximum acceptable data loss window during a disaster |
| **RTO (Recovery Time Objective)** | `< 30 Minutes` | Maximum acceptable downtime to restore service |
| **Integrity Verification** | 100% SHA256 | All backup artifacts are hashed and registered in `manifest.json` |
| **Retention Policy** | 30 Days | Rolling 30-day retention for daily snapshots |

---

## 2. Backup Architecture

QASSA utilizes a multi-tiered backup defense:

1. **Automated Continuous WAL Archiving (PITR):**
   - Managed directly by Supabase / PostgreSQL.
   - Permits point-in-time recovery down to any specific second within the last 7 days.
2. **Scheduled Logical Backups:**
   - Scripted via `npm run db:backup` (`scripts/backup.mjs`).
   - Generates non-owner schema and table dumps.
   - Stores snapshots in `backups/qassa_backup_<timestamp>.sql`.
   - Records checksums in `backups/manifest.json`.

---

## 3. Creating a Backup

Execute via npm or automated cron job:

```bash
# Set DATABASE_URL to your direct connection string (e.g. Supabase pooler / direct host)
export DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres"

# Run backup script
npm run db:backup
```

Output:
```
✅ Backup file created: backups/qassa_backup_2026-11-05T15-00-29-574Z.sql
   Size:    53.41 KB
   SHA256:  fc4783b6686344ca70623c1c37c7ebddc96a293353667c1beefd560bdef05244
   Manifest updated with integrity checksum.
```

---

## 4. Disaster Recovery & Restoration Drill

### Step 1: Verify Backup Integrity
Verify that the file on disk matches the checksum in `backups/manifest.json`:

```bash
# On Linux/macOS:
sha256sum backups/qassa_backup_<timestamp>.sql

# On Windows PowerShell:
Get-FileHash backups/qassa_backup_<timestamp>.sql -Algorithm SHA256
```

### Step 2: Restore to a Clean Target Database
```bash
# 1. Connect using psql as superuser / postgres admin
psql "$TARGET_DATABASE_URL" -v ON_ERROR_STOP=1 -f backups/qassa_backup_<timestamp>.sql
```

### Step 3: Post-Restore Verification
Run the database test suite against loopback to verify tenant isolation, RLS policies, and RPC function grants:

```bash
npm run test:db
```
All tests must report `NOTICE: ok - ...`.
