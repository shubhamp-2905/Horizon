# Horizon

> **Status:** Phase 2 — Task Discovery & Contributor Experience Completed  
> **Concept:** Offline-first, task-driven geospatial community contribution platform feeding verified ground-truth data into downstream geospatial intelligence systems (Loupe).

---

## 1. Product Overview

**Horizon** is a platform enabling distributed community contributors to discover, capture, validate, and verify high-value geospatial data in offline-first environments. Contributor submissions undergo multi-stage automated and peer verification before triggering auditable token rewards and streaming validated datasets into downstream analytics pipelines (such as Loupe).

### Core Product Workflow (Phase 2 Completed)

```text
AUTHENTICATION (Register/Login) ──> CONTRIBUTOR IDENTITY (100 Starter Tokens)
  ──> ADMIN TASK CREATION (PostGIS Spatial Geometries) ──> TASK PUBLISHING
  ──> GEOSPATIAL PROXIMITY DISCOVERY (ST_DWithin / ST_Distance)
  ──> TASK DETAILS & REQUIREMENTS ──> COMMITMENT CLAIM (Row-Locked Escrow)
  ──> AUDIT LEDGER MUTATION (STARTER_GRANT +100, TASK_STAKE_LOCK -20)
  ──> MOBILE CONTRIBUTOR & WEB ADMIN CONSOLES
```

1. **Contributor Onboarding:** Registered contributors receive an authoritative `TokenAccount` automatically seeded with 100 Starter Tokens and an immutable `STARTER_GRANT` audit ledger transaction.
2. **Admin Task Creation & Lifecycle:** Admins create tasks with WGS84 coordinates (`SRID 4326`), reward structures, difficulty factors, and requirements. Tasks transition between `draft` and `published`.
3. **PostGIS Task Discovery:** Non-admin contributors discover published tasks within a specified radius (e.g. 5,000m) ordered by physical proximity to their GPS fix using native PostGIS spatial functions (`ST_DWithin`, `ST_Distance`).
4. **Atomic Commitment Staking:** Claiming a task executes an atomic row-locked transaction (`with_for_update()`), moving the commitment stake (e.g. 20 tokens) from `available_balance` to `locked_balance`, creating an immutable `TASK_STAKE_LOCK` ledger entry. Duplicate active claims and claims with insufficient token balances are rejected.
5. **Multi-Platform Interfaces:** Mobile contributor app (React Native/Expo) with auth, discovery, interactive map, task details, and wallet screens; alongside an administrative Next.js console with real-time task creation and status toggles.

---

## 2. Technology Stack

| Component | Technology | Role & Characteristics |
| :--- | :--- | :--- |
| **Backend API** | **Python 3.12+, FastAPI, SQLAlchemy 2.0, Alembic** | Modular monolith; authoritative source of truth for logic, state, and ledger |
| **Database** | **PostgreSQL 16 + PostGIS 3.4** | Native spatial types (`POINT`, `POLYGON`), spatial indexing (GIST), ACID compliance |
| **Mobile Client** | **React Native, Expo, TypeScript, SQLite** | Cross-platform offline-first mobile client with local caching and sync queue |
| **Web Console** | **Next.js 14, TypeScript, React 18** | Reviewer verification queue, task lifecycle management, and token monitoring |
| **AI Service** | **Python 3.12+, FastAPI, PyTorch** | Decoupled verification microservice emitting non-authoritative signals |
| **Object Storage** | **S3-Compatible (Cloudflare R2 / AWS S3 / MinIO)** | High-resolution photo and media attachment persistence |
| **Containerization**| **Docker, Docker Compose** | Local containerized development and deployment environment |

---

## 3. Monorepo Structure

```text
horizon/
├── apps/
│   ├── api/             # Authoritative FastAPI backend (Python)
│   ├── mobile/          # Contributor mobile app (React Native / Expo / SQLite)
│   └── web/             # Reviewer & admin dashboard (Next.js / TypeScript)
│
├── services/
│   └── ai/              # Decoupled AI/ML verification service (Python / FastAPI)
│
├── packages/
│   ├── types/           # Shared TypeScript interfaces & DTOs
│   ├── config/          # Shared platform constants & token rules
│   ├── validation/      # Shared domain validation functions
│   └── utils/           # Shared geospatial helpers (Haversine, formatting)
│
├── database/
│   ├── migrations/      # Database migration references
│   ├── seeds/           # Seed datasets for development
│   └── scripts/         # Database backup and utility scripts
│
├── docs/
│   ├── architecture/    # System overview, data flow, ADRs
│   ├── product/         # Product requirements and token economy specs
│   ├── api/             # API contracts & schemas
│   └── ai/              # AI anti-spoofing and verification strategy
│
├── infrastructure/
│   ├── docker/          # Docker compose configurations
│   └── deployment/      # Cloud deployment manifests
│
├── scripts/
│   └── test_all.py      # Monorepo test runner script
│
├── .env.example         # Environment template
├── docker-compose.yml   # Multi-service local dev orchestration
└── README.md
```

---

## 4. Quickstart & Local Development

### Prerequisites
- **Python 3.11+**
- **Node.js 20+** and **npm 10+**
- *(Optional for containers)* **Docker & Docker Compose**

---

### Step 1: Environment Setup
Copy the environment template and initialize `.env`:
```bash
cp .env.example .env
```

---

### Step 2: Running with Docker Compose (Recommended for Full Stack)
Start PostgreSQL with PostGIS, MinIO object storage, FastAPI backend, and AI service:
```bash
docker compose up -d
```
Stop containers:
```bash
docker compose down
```

---

### Step 3: Running Services Natively (Local Dev)

#### A. Run All Automated Tests
Run the monorepo test suite across all Python services (`apps/api` and `services/ai`):
```bash
python scripts/test_all.py
```

#### B. Run 17-Step Phase 2 Acceptance Demo
Executes the comprehensive 17-step end-to-end acceptance flow (admin creation, task creation, publishing, contributor onboarding with 100 Starter Tokens, proximity discovery, atomic commitment stake locking, ledger auditing, duplicate claim rejection, and insufficient token rejection):
```bash
python scripts/demo_phase2.py
```

#### C. Run Database Migrations (Alembic)
```bash
cd apps/api
# Apply migrations to database:
alembic upgrade head

# Or preview generated SQL offline:
alembic upgrade head --sql
```

#### C. Start Authoritative Backend API
```bash
cd apps/api
uvicorn app.main:app --host 0.0.0.0 --port 4000 --reload
```
- API root: `http://localhost:4000`
- Health check: `http://localhost:4000/health` or `http://localhost:4000/api/v1/health`
- Interactive OpenAPI Swagger Docs: `http://localhost:4000/docs`

#### D. Start AI Verification Service
```bash
cd services/ai
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
- Health check: `http://localhost:8000/health`
- Interactive Swagger Docs: `http://localhost:8000/docs`

#### E. Start Reviewer & Admin Web Console (Next.js)
```bash
cd apps/web
npm run dev
```
- Web console URL: `http://localhost:3000`

#### F. Start Contributor Mobile App (Expo)
```bash
cd apps/mobile
npm run start
```
- Press `w` for web preview or scan the QR code with Expo Go.

---

## 5. Architectural Invariants

1. **Python + FastAPI Sole Backend Requirement:** No Node.js/NestJS in the core API.
2. **PostgreSQL + PostGIS Authoritative Source:** Spatial bounds, task polygons, and submission coordinates must use native PostGIS geometry types.
3. **Decoupled AI Boundary:** The AI microservice emits non-authoritative confidence signals; all final verification and token disbursement decisions reside in the backend business engine.
4. **Token Ledger Integrity:** All token movements are server-authoritative and recorded in append-only `TokenTransaction` records. Clients never calculate reward balances.
5. **Offline-First Resilience:** The mobile client operates autonomously in zero-connectivity environments with local SQLite persistence and a resilient sync queue.
