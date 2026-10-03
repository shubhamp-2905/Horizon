# Horizon Architecture Specification & Baseline Audit

> **Document:** `HORIZON_ARCHITECTURE.md`  
> **Status:** Baseline Audit Completed (Phase 0)  
> **Role:** Authoritative reference for Project Horizon (Loupe Earth)  
> **Scope:** Architecture, Data Flows, Entities, APIs, Mobile, Web, AI Service, Offline Sync, and Token Ledger.

---

## 1. System Architecture Overview

Horizon is an offline-first, task-driven geospatial community contribution platform. It bridges distributed physical-world contributors with downstream geospatial analytics systems (such as Loupe) through verified, auditable ground-truth observations.

```
                    ┌──────────────────────────────────────────┐
                    │               WEB CONSOLE                │
                    │         Next.js 14 / React 18            │
                    │   Admin Mission Control & Review Queue   │
                    └────────────────────┬─────────────────────┘
                                         │ HTTPS / REST
                                         ▼
                    ┌──────────────────────────────────────────┐
                    │            CORE API GATEWAY              │
                    │         Python 3.12+ / FastAPI           │
                    │  Auth, Tasks, Claims, Tokens, Review     │
                    └──────────┬───────────────────┬───────────┘
                               │                   │
                     SQLAlchemy 2.0                │ Async HTTP / Job
                               │                   │
        ┌──────────────────────▼───────┐           ▼
        │     POSTGRESQL 16 + POSTGIS  │  ┌─────────────────────────────────┐
        │  Spatial Indexes (GIST)      │  │        AI VERIFICATION SERVICE  │
        │  Authoritative Token Ledger  │  │         Python 3.12+ / FastAPI  │
        │  Transactional Row-Locking   │  │   MobileNetV3, MobileCLIP-S0    │
        │  Submissions & Verifications │  │   pHash, DINOv2, LightGBM       │
        └──────────────────────────────┘  └─────────────────────────────────┘
                               ▲
                               │
                       Sync / REST API
                               │
                    ┌──────────┴───────────────┐
                    │        MOBILE APP        │
                    │    React Native / Expo   │
                    │   SQLite Offline Queue   │
                    │   GPS & Camera Capture   │
                    └──────────────────────────┘
```

### Key Architectural Tenets
1. **Authoritative Backend:** The Python/FastAPI backend is the single source of truth for identity, state transitions, task economics, and the token ledger. Client applications never compute authoritative balances or validation decisions.
2. **Decoupled AI Verification:** The AI service runs as an independent FastAPI microservice. It provides non-authoritative advisory signals (scores, perceptual similarity, anomaly flags, vision-language matching) to aid human reviewers without blocking core transaction flows.
3. **Offline-First Resilience:** The mobile client operates autonomously in zero-connectivity environments, buffering drafts and media metadata in SQLite until reliable network connectivity is restored.
4. **PostGIS Spatial Sovereignty:** All spatial indexing, radius queries, and distance calculations occur in PostgreSQL/PostGIS (`SRID 4326`) using `ST_DWithin` and `ST_Distance`.
5. **Immutable Financial Ledger:** Token balances are never modified without a paired, immutable `TokenTransaction` record in an append-only audit log.

---

## 2. End-to-End Data Flow

The full lifecycle of ground-truth data in Horizon progresses across 12 distinct stages:

```
[1. DATA NEED] 
      │ 
      ▼
[2. TASK CREATION] (Admin defines WGS84 coordinates, bounty, difficulty, evidence requirements)
      │
      ▼
[3. TASK DISCOVERY] (PostGIS ST_DWithin / ST_Distance query from Contributor GPS fix)
      │
      ▼
[4. TASK CLAIM] (Atomic row-locked token escrow: available_balance -> locked_balance)
      │
      ▼
[5. FIELD COLLECTION] (GPS geotagging, multi-angle photos, condition telemetry)
      │
      ▼
[6. OFFLINE STORAGE] (Buffered in SQLite queue if network is unavailable)
      │
      ▼
[7. SUBMISSION & SYNC] (Payload & media metadata transmitted to FastAPI backend)
      │
      ▼
[8. DETERMINISTIC VALIDATION] (Boundary check, timestamp check, required fields check)
      │
      ▼
[9. AI-ASSISTED EVALUATION] (MobileNet quality, MobileCLIP relevance, pHash duplicates, DINOv2)
      │
      ▼
[10. HUMAN REVIEW] (Admin/Reviewer reviews evidence package with AI advisory signals)
      │
      ▼
[11. OUTCOME & REWARD] (Approved: stake unlocked + reward minted; Rejected: stake handled)
      │
      ▼
[12. DOWNSTREAM DATASET] (Clean ground-truth observation published to Loupe data pipeline)
```

---

## 3. Database Entities & Schemas

The database schema is managed via **Alembic** migrations (`0001_initial_core_schema.py` and `0002_phase2_auth_and_task_fields.py`) targeting PostgreSQL 16 + PostGIS 3.4.

### Core Entity Relationship Graph

```
  ┌───────────────┐          1:1          ┌──────────────────┐
  │     User      ├──────────────────────►│   TokenAccount   │
  └───┬───────┬───┘                       └───┬──────────────┘
      │       │                               │ 1:N
      │ 1:N   │ 1:N                           ▼
      │       │                       ┌──────────────────┐
      │       │                       │ TokenTransaction │
      │       │                       └──────────────────┘
      │       ▼
      │  ┌───────────────┐   N:1  ┌───────────────┐
      │  │   TaskClaim   ├───────►│     Task      │
      │  └───┬───────────┘        └───┬───────────┘
      │      │ 1:N                    │ 1:N
      ▼      ▼                        ▼
  ┌───────────────┐              ┌──────────────────┐
  │  Submission   ├─────────────►│  TaskFormSchema  │
  └───┬───────┬───┘              └──────────────────┘
      │ 1:N   │ 1:1
      │       ▼
      │  ┌───────────────┐
      │  │ Verification  │
      │  └───────────────┘
      ▼
  ┌──────────────────┐
  │ SubmissionMedia  │
  └──────────────────┘
```

### Table Definitions
* **`users`:** Identity records with `role` (`contributor`, `reviewer`, `admin`), hashed password (`bcrypt`), and profile metadata.
* **`token_accounts`:** Authoritative balance tracker with `available_balance` and `locked_balance`.
* **`token_transactions`:** Append-only ledger recording `starter_grant`, `task_stake_lock`, `stake_return`, `reward`, and `adjustment`.
* **`tasks`:** Geospatial tasks containing `location_point` (`GEOMETRY(Point, 4326)`), `boundary_polygon`, `artifact_type`, `difficulty`, `scarcity`, `base_reward`, `commitment_stake`, `status` (`draft`, `published`, `completed`, `archived`), and `requirements` JSON.
* **`task_claims`:** Escrow link between a contributor and a task with `status` (`claimed`, `in_progress`, `submitted`, `released`, `forfeited`).
* **`submissions`:** Field observation package including `gps_latitude`, `gps_longitude`, `gps_accuracy`, `observation_data` JSON, `status` (`draft`, `submitted`, `validating`, `under_review`, `approved`, `rejected`), and submission timestamps.
* **`submission_media`:** Metadata and storage keys for media evidence attached to submissions (MIME type, size, hash, storage key).
* **`verifications`:** Final verification decisions and audits (`auto_checks`, `ai_evaluation`, `decision`, `reviewer_id`, `notes`).
* **`reputations`:** Contributor track record and reliability metrics.

---

## 4. API Boundaries & Endpoints

All endpoints are hosted on the modular FastAPI monolith under `/api/v1`:

### Authentication & Identity (`app/modules/auth`)
* `POST /api/v1/auth/register` — Registers new contributor/admin, generates JWT, and triggers initial token account bootstrapping.
* `POST /api/v1/auth/login` — Authenticates credentials and returns access token.
* `POST /api/v1/auth/logout` — Client session invalidation.
* `GET  /api/v1/auth/me` — Retrieves current user profile, role, and permissions.

### Token Economy & Wallet (`app/modules/tokens`)
* `GET  /api/v1/me/wallet` — Authoritative contributor wallet balances (`available`, `locked`, `total`) and immutable ledger history.

### Tasks & Geospatial Discovery (`app/modules/tasks`)
* `GET  /api/v1/tasks` — Spatial discovery query. Filters by `lat`, `lng`, `radius` (meters), `artifact_type`, `difficulty`, and reward thresholds. Sorted by PostGIS `ST_Distance`.
* `GET  /api/v1/tasks/{task_id}` — Detailed task specifications, requirements, and economic parameters.
* `POST /api/v1/tasks/{task_id}/claim` — Atomic row-locked task claim and commitment stake lock (`with_for_update()`).
* `GET  /api/v1/me/tasks` — Retrieves tasks actively claimed or completed by the authenticated contributor.

### Admin Task Management (`app/modules/admin`)
* `POST /api/v1/admin/tasks` — Creates new geospatial tasks with point geometry (`SRID 4326`), reward formula inputs, and requirements.
* `PATCH /api/v1/admin/tasks/{task_id}/status` — Transitions task lifecycle (`draft` ↔ `published` ↔ `archived`).

### Field Submissions & Verification (`app/modules/submissions`)
* `POST /api/v1/tasks/{task_id}/submission` — Creates a field observation submission draft.
* `GET  /api/v1/submissions/{submission_id}` — Fetches submission detail, evidence metadata, and media items.
* `POST /api/v1/submissions/{submission_id}/media` — Attaches evidence photos/media records with client hashes.
* `POST /api/v1/submissions/{submission_id}/submit` — Finalizes and transitions submission to `submitted` / `validating`.
* `GET  /api/v1/me/submissions` — Contributor's past and pending submissions.
* `GET  /api/v1/admin/submissions` — Admin review queue for incoming field submissions.
* `POST /api/v1/admin/submissions/{submission_id}/review` — Human reviewer decision (`approve` / `reject`) with notes and audit logging.

---

## 5. Mobile Contributor Flow

The mobile app (`apps/mobile`) is built with React Native, Expo, and TypeScript.

```
       [AuthScreen] ── Login / Register (Automatic 100 Starter Tokens)
            │
            ▼
       [HomeScreen] ── Balance, Active Claims, Nearby Quick Peek
            │
      ┌─────┴─────────────────────────┐
      ▼                               ▼
[DiscoverScreen]              [TaskDetailScreen]
  - Map View (GPS fix)          - Reward & Stake Breakdown
  - PostGIS Nearby Radius       - Evidence Requirements
  - Filter by Difficulty        - [COMMIT TO TASK] (Escrow 20 Stake)
      │                               │
      └──────────────┬────────────────┘
                     ▼
              [MyTasksScreen]
                - Active Commitments
                - Offline Cached Evidence Drafts
                - Status Badges (Claimed, Submitted)
                     │
                     ▼
              [WalletScreen]
                - Total / Available / Locked Breakdown
                - Immutable Audit Ledger Cards
```

---

## 6. Web Admin Console Flow

The web admin dashboard (`apps/web`) is built with Next.js 14 (App Router) and React 18:

* **Overview Tab:** System-wide mission control metrics (active tasks, claims, submissions, circulating token supply).
* **Tasks Tab:** Task authoring, interactive map placement, coordinate configuration, requirement definitions, and publish/unpublish toggles.
* **Submissions Tab:** Incoming review queue displaying field evidence packages, GPS proximity, and approval/rejection controls.
* **Contributors Tab:** Contributor registry, reputation scores, and verification histories.
* **Token Activity Tab:** Real-time stream of all ledger movements (`STARTER_GRANT`, `TASK_STAKE_LOCK`, rewards).

---

## 7. AI Service Architecture & Multimodal Pipeline

The AI Service (`services/ai`) is an isolated Python/FastAPI microservice running asynchronously from core transactional operations:

```
  Field Submission Package
  (Photo + Form Data + GPS + Timestamp + Task Requirements)
             │
             ▼
  ┌────────────────────────────────────────────────────────┐
  │                 AI VERIFICATION PIPELINE                │
  │                                                        │
  │  1. MobileNetV3-Small: Image resolution & blur check   │
  │  2. MobileCLIP-S0:     Vision-Language task relevance  │
  │  3. pHash:             Perceptual hash collision check │
  │  4. DINOv2:            Deep visual representation      │
  │  5. LightGBM:          Heuristic / quality scoring     │
  └──────────────────────────┬─────────────────────────────┘
                             │
                             ▼
  ┌────────────────────────────────────────────────────────┐
  │ AI Evaluation Object:                                  │
  │  - image_quality_score: float                          │
  │  - task_relevance_score: float                         │
  │  - duplicate_score: float                              │
  │  - form_consistency_score: float                       │
  │  - overall_quality_score: float                        │
  │  - review_recommended: bool                            │
  │  - explanations: list[str]                             │
  │  - model_versions: dict[str, str]                      │
  └────────────────────────────────────────────────────────┘
```

*All AI scores provide deterministic explanations and explicit model versions. AI outputs remain strictly advisory.*

---

## 8. Offline Synchronization Flow

The mobile offline engine utilizes **SQLite** and an asynchronous queue (`apps/mobile/src/offline/queue.ts`):

```
[FIELD OPERATION] ── Contributor captures photo & form observations
         │
    [ONLINE?]
      ├── YES ──► Direct API Submission ──► Server Confirmation
      └── NO  ──► Enqueue in SQLite Local Storage
                     │
                     ▼
             [QueuedSubmission]
               Status: 'queued'
               RetryCount: 0
               Media Attachments: Local File URIs
                     │
            (Network Restored)
                     │
                     ▼
             [Sync Engine Worker]
               1. Status -> 'syncing'
               2. Upload media binary to object storage
               3. POST /tasks/{id}/submission draft
               4. POST /submissions/{id}/media metadata
               5. POST /submissions/{id}/submit
               6. Status -> 'synced' (or 'failed' with retry backoff)
```

---

## 9. Token & Ledger Accounting Rules

1. **Starter Grant:** Contributor registration automatically credits 100 tokens:
   $$\text{Available} = 100, \quad \text{Locked} = 0$$
   Transaction: `starter_grant (+100)`
2. **Task Staking (Row-Locked Escrow):**
   Claiming a task moves commitment stake $S$ (e.g., 20 tokens):
   $$\text{Available} = \text{Available} - S, \quad \text{Locked} = \text{Locked} + S$$
   Transaction: `task_stake_lock (-S)`
3. **Reward Formula on Approved Submission:**
   $$\text{Reward} = \text{Base} \times \text{Difficulty} \times \text{Scarcity} \times \text{Quality}$$
   Upon approval, the locked stake $S$ is unlocked, and the calculated reward is minted to the contributor's `available_balance`.
4. **Authoritative Consistency:** Balances cannot be directly overwritten; every balance transition requires a validated database transaction and a ledger record.

---

## 10. Baseline Audit Verification Status

| Verification Target | Command / Test | Outcome |
| :--- | :--- | :--- |
| **API Automated Tests** | `python -m pytest apps/api/tests` | **15/15 Passed** |
| **End-to-End Acceptance Flow** | `python scripts/demo_phase2.py` | **17/17 Steps Verified** |
| **Web Console Build** | `npm run build:web` | **0 Errors (Clean Static Generation)** |
| **Mobile TypeScript Compilation** | `npx tsc --project apps/mobile/tsconfig.json` | **0 Errors** |
