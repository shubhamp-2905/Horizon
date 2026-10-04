# Project Horizon — Production Deployment & Cloud Infrastructure Guide

## 1. Cloud Architecture Overview

Project Horizon is structured into decoupled, independently scalable components:

```
                            +-----------------------------+
                            |       Next.js Web Admin     |
                            |       (Vercel / Render)     |
                            +--------------+--------------+
                                           |
                                           v
+------------------------+      +----------+----------+      +-----------------------+
|  Expo Mobile Client    | ---> |  Horizon FastAPI    | ---> | AI Microservice       |
|  (EAS Android / iOS)   |      |  (Render / ECS)     |      | (Render / Cloud Run)  |
+------------------------+      +----------+----------+      +-----------------------+
                                           |
                 +-------------------------+-------------------------+
                 |                                                   |
                 v                                                   v
    +------------+-------------+                        +------------+------------+
    | PostgreSQL 16 (PostGIS)  |                        | S3 / Supabase Storage   |
    | (Supabase / Render)      |                        | (Presigned Direct)      |
    +--------------------------+                        +-------------------------+
```

---

## 2. Infrastructure Platform Audit & Free-Tier Limitations

### A. Render (Web & API Services)
- **Free-Tier Spin Down**: Free instances spin down after 15 minutes of inactivity. When a request arrives, cold-starts introduce a **30–50 second delay**.
- **Ephemeral Filesystem**: Any media or files written to container disk are wiped upon restart.
- **Production Recommendation**:
  - Deploy `horizon-api` and `horizon-ai` on at least the **Starter ($7/mo)** plan to keep services warm and avoid cold-start timeouts.
  - Offload media uploads directly to S3 / Supabase Storage via `POST /api/v1/submissions/{id}/upload-url`.
  - Configure `healthCheckPath: /healthz`.

### B. Vercel (Next.js Web Console)
- **Edge / Serverless Constraints**: Serverless functions have 10-second default execution timeouts.
- **Production Recommendation**:
  - Use `npm run build:web` with standalone Next.js build.
  - Proxy `/api/v1` routes to the authoritative `horizon-api` origin using `vercel.json` rewrites or direct `NEXT_PUBLIC_API_URL` environment binding.
  - Enforce CSP, HSTS, and Frame-Options via Vercel security headers.

### C. Supabase (Managed PostgreSQL & PostGIS)
- **Free-Tier Limits**: Pauses inactive databases after 7 days without queries. Max 500MB database storage.
- **Production Recommendation**:
  - Use Connection Pooling (`port 6543` / PgBouncer mode) with `DATABASE_POOL_SIZE=10` and `DATABASE_POOL_RECYCLE=1800` to prevent connection exhaustion.
  - In production mode, Horizon API enforces hard failure if PostgreSQL is unreachable (`is_production` check) instead of silently falling back to ephemeral SQLite.

### D. AI Quality Evaluation Service
- **Cold-Start Resilience**: The AI service (`services/ai`) provides deterministic multi-attribute visual scoring (blur, exposure, contrast, resolution, artifact detection).
- **Fallback Architecture**: If the HTTP microservice experiences cold-start latency or network timeouts:
  1. Primary: HTTP client retries with configurable timeout (`AI_SERVICE_TIMEOUT_SECONDS=3.0` - `5.0`).
  2. Secondary: Direct in-process fallback to `ImageQualityEvaluator.evaluate_submission`.
  3. Tertiary: Fail-safe warning status that flags the submission for manual peer review rather than blocking user progress.

---

## 3. Production Environment Variables Reference

### Backend Core API (`apps/api`)
| Variable | Required | Default / Example | Purpose |
| :--- | :--- | :--- | :--- |
| `ENVIRONMENT` | Yes | `production` | Enables strict production guards, disables mock data |
| `SECRET_KEY` | Yes | *64-character high-entropy hex* | JWT signing and HMAC token generation |
| `DATABASE_URL` | Yes | `postgresql://user:pass@host:5432/db` | Production PostgreSQL connection string |
| `DATABASE_POOL_SIZE` | No | `10` | SQLAlchemy connection pool size |
| `DATABASE_MAX_OVERFLOW` | No | `20` | Max overflow connections |
| `DATABASE_POOL_RECYCLE` | No | `1800` | Recycle connection every 30 mins |
| `LOG_LEVEL` | No | `INFO` | Logging verbosity |
| `LOG_FORMAT` | No | `json` | Structured JSON log output for Datadog / CloudWatch |
| `RATE_LIMIT_ENABLED` | No | `true` | Rate limits auth endpoints (10 req/min) and pipeline (5 req/min) |
| `API_CORS_ORIGINS` | Yes | `["https://admin.earthlens.org", "https://app.earthlens.org"]` | Whitelisted frontend origins |
| `AI_SERVICE_URL` | Yes | `https://horizon-ai.onrender.com` | Microservice URL for visual verification |
| `AI_SERVICE_API_KEY` | Yes | *shared secret key* | Authenticates requests between API and AI service |
| `AI_SERVICE_TIMEOUT_SECONDS` | No | `5.0` | Max wait time per AI evaluation attempt |
| `AI_SERVICE_MAX_RETRIES` | No | `2` | Retry attempts before falling back |
| `S3_BUCKET` | Yes | `horizon-media-production` | Target object storage bucket |
| `S3_REGION` | Yes | `us-east-1` | AWS S3 / Cloudflare R2 region |
| `S3_ACCESS_KEY` | Yes | *IAM Access Key* | AWS S3 credentials |
| `S3_SECRET_KEY` | Yes | *IAM Secret Key* | AWS S3 credentials |

### Web Admin Console (`apps/web`)
| Variable | Required | Default / Example | Purpose |
| :--- | :--- | :--- | :--- |
| `NEXT_PUBLIC_API_URL` | Yes | `https://horizon-api.onrender.com/api/v1` | Backend API base endpoint |
| `NODE_ENV` | Yes | `production` | Optimized Next.js production bundle |

### AI Microservice (`services/ai`)
| Variable | Required | Default / Example | Purpose |
| :--- | :--- | :--- | :--- |
| `ENVIRONMENT` | Yes | `production` | Production mode |
| `AI_SERVICE_API_KEY` | Yes | *shared secret key* | Shared authorization secret |
| `PORT` | No | `8000` | Port assigned by container host |

### Mobile Application (`apps/mobile`)
| Variable | Required | Default / Example | Purpose |
| :--- | :--- | :--- | :--- |
| `EXPO_PUBLIC_API_URL` | Yes | `https://horizon-api.onrender.com/api/v1` | Public API endpoint for mobile devices |

---

## 4. Step-by-Step Deployment Runbook

### Step 1: Database Provisioning & Migration
```bash
# 1. Export production PostgreSQL URL
export DATABASE_URL="postgresql://user:pass@host:5432/horizon_prod"

# 2. Run Alembic schema migrations
cd apps/api
alembic upgrade head

# 3. Seed administrative roles if new environment
python -m database.seeds.dev_tasks
```

### Step 2: Deploy AI Microservice
```bash
# Build and test container locally
docker build -t horizon-ai services/ai
docker run -p 8000:8000 -e ENVIRONMENT=production horizon-ai

# Or push to Render / Cloud Run using render.yaml
```

### Step 3: Deploy Backend API
```bash
# Verify healthz and readyz probes
curl -f https://horizon-api.onrender.com/healthz
curl -f https://horizon-api.onrender.com/readyz
```

### Step 4: Deploy Next.js Web Console
```bash
cd apps/web
npm ci
npm run build:web
# Deploy via Vercel CLI or Git push:
vercel --prod
```

### Step 5: Build & Release Mobile App (Expo EAS)
```bash
cd apps/mobile
npm install -g eas-cli
eas login
eas build --platform all --profile production
```

---

## 5. Security Checklist Before Going Live
- [x] Change all default `SECRET_KEY` and passwords.
- [x] Ensure `ENVIRONMENT=production` is set across all services.
- [x] Restrict `API_CORS_ORIGINS` to exact production domain names.
- [x] Verify `/readyz` probe reports database connected and healthy.
- [x] Run `GET /api/v1/admin/tokens/audit` to confirm token ledger invariant check.
- [x] Ensure media uploads use presigned direct object storage (`POST /upload-url`).
