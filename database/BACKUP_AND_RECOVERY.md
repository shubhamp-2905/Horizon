# Database Backup, Disaster Recovery & Ledger Integrity Runbook

## Overview
Project Horizon relies on PostgreSQL for its system-of-record, including user accounts, task assignments, field observations, peer consensus verdicts, and the immutable token ledger. This document details backup cadence, disaster recovery procedures, point-in-time recovery (PITR), and double-spend ledger integrity audits.

---

## 1. Backup Strategies & Cadence

| Tier | Backup Type | Frequency | Retention | Target Destination |
| :--- | :--- | :--- | :--- | :--- |
| **L1 Continuous** | WAL Archiving / PITR | Continuous | 7 to 30 Days | S3/GCS Object Storage (`horizon-db-wal/`) |
| **L2 Daily** | Logical `pg_dump` snapshot | Daily @ 02:00 UTC | 90 Days | Encrypted multi-region S3 bucket |
| **L3 Pre-Deployment** | Schema + Data dump | Before migrations | Indefinite | Deployment archive |

### Automated Daily Dump Script
```bash
#!/usr/bin/env bash
set -euo pipefail

BACKUP_DATE=$(date -u +"%Y%m%d_%H%M%SZ")
BACKUP_FILE="/tmp/horizon_backup_${BACKUP_DATE}.sql.gz"
S3_TARGET="s3://horizon-backups-production/postgres/horizon_backup_${BACKUP_DATE}.sql.gz"

echo "[$(date -u)] Starting Horizon PostgreSQL logical backup..."

PGPASSWORD="${PGPASSWORD}" pg_dump \
  -h "${PGHOST}" \
  -U "${PGUSER}" \
  -d "${PGDATABASE}" \
  -F c \
  -b \
  -v \
  | gzip -9 > "${BACKUP_FILE}"

echo "[$(date -u)] Uploading backup to S3 storage..."
aws s3 cp "${BACKUP_FILE}" "${S3_TARGET}" --sse aws:kms

rm -f "${BACKUP_FILE}"
echo "[$(date -u)] Backup completed successfully."
```

---

## 2. Disaster Recovery & Restoration Procedures

### Scenario A: Full Database Restoration from Logical Backup
```bash
# 1. Terminate active application connections
psql -h "${PGHOST}" -U "${PGUSER}" -d postgres -c \
  "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'horizon_db' AND pid <> pg_backend_pid();"

# 2. Drop and recreate database
psql -h "${PGHOST}" -U "${PGUSER}" -d postgres -c "DROP DATABASE IF EXISTS horizon_db;"
psql -h "${PGHOST}" -U "${PGUSER}" -d postgres -c "CREATE DATABASE horizon_db OWNER horizon_user;"

# 3. Download snapshot
aws s3 cp s3://horizon-backups-production/postgres/horizon_backup_YYYYMMDD_HHMMSSZ.sql.gz /tmp/restore.sql.gz

# 4. Restore database using pg_restore
gunzip -c /tmp/restore.sql.gz | pg_restore \
  -h "${PGHOST}" \
  -U "${PGUSER}" \
  -d horizon_db \
  --clean \
  --if-exists \
  --no-owner \
  --role=horizon_user

# 5. Run Alembic upgrade check to verify schema alignment
cd apps/api
alembic upgrade head
```

### Scenario B: Cloud Managed DB (Supabase / Render) Restore
1. **Supabase**:
   - Access **Project Settings** > **Database** > **Backups**.
   - Select point-in-time recovery timestamp or latest physical daily snapshot.
   - Click **Restore backup to project**.
2. **Render Managed PostgreSQL**:
   - Access the PostgreSQL instance dashboard.
   - Click **Recovery** tab and select the recovery target time.
   - Update `DATABASE_URL` in `horizon-api` if a new instance was provisioned.

---

## 3. Immutable Token Ledger Integrity Audit

Project Horizon employs an immutable append-only ledger for token accounting. To guarantee zero double-spends and total mathematical invariant adherence, run the automated ledger audit:

### Command Line / Programmatic Audit
```bash
# Execute ledger audit against production database
python -c "
from app.database.session import SessionLocal
from app.modules.tokens.service import audit_token_ledger_integrity

with SessionLocal() as db:
    result = audit_token_ledger_integrity(db)
    print(f'Status: {result[\"status\"]}')
    print(f'Total Accounts: {result[\"total_accounts_audited\"]}')
    print(f'Circulating Available: {result[\"total_circulating_available\"]}')
    print(f'Circulating Locked: {result[\"total_circulating_locked\"]}')
    print(f'Anomalies: {len(result[\"anomalies\"])}')
    assert result['is_healthy'], 'Ledger integrity violation!'
"
```

### Admin REST API Audit Endpoint
- Method: `GET /api/v1/admin/tokens/audit` (or `GET /api/v1/wallet/admin/audit`)
- Role Requirement: `admin`
- Returns: Real-time circulation summary, per-account anomaly checks, and mathematical audit verification.
