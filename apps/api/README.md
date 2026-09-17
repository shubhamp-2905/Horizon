# Horizon Backend API

> Authoritative core backend API and business logic engine for the Horizon platform.

---

## Architecture & Responsibilities

- **Single Source of Truth:** Business logic, task lifecycles, and verification consensus run here.
- **Authoritative Ledger & Tokens:** Calculates and issues token rewards upon successful multi-stage verification. Clients cannot update balances directly.
- **Geospatial Processing:** Native spatial queries (PostGIS), task bounding box indexing, and spatial conflict detection.
- **Media Ingestion & Presigning:** Direct upload pre-signing and validation for object storage (S3 / MinIO).
- **Asynchronous Jobs:** BullMQ / Redis job queues for background processing (AI inference dispatch, batch exports, Loupe data pipeline streaming).

---

## Directory Structure

```text
api/
└── src/
    ├── modules/           # Domain feature modules
    │   ├── auth/          # Contributor & reviewer authentication, JWTs, API keys
    │   ├── users/         # User profiles, preferences, device registration
    │   ├── tasks/         # Geospatial tasks, discovery, reservations, lifecycle
    │   ├── submissions/   # Contributor submissions, photo & telemetry ingestion
    │   ├── verification/  # Multi-stage validation, peer review consensus, AI signal evaluation
    │   ├── rewards/       # Reward calculation engine and distribution logic
    │   ├── tokens/        # Token balances, transactions, and auditable ledger operations
    │   ├── reputation/    # Contributor and reviewer trust scoring & staking
    │   ├── media/         # Object storage presigning, EXIF extraction, hash validation
    │   └── admin/         # Platform administration, campaign management, moderation
    │
    ├── common/            # Shared exceptions, interceptors, decorators, filters
    ├── config/            # Environment and application configuration loaders
    ├── database/          # Database client, repository base classes, PostGIS helpers
    ├── guards/            # Authentication, role-based, and rate-limiting guards
    ├── middleware/        # Request logging, telemetry, security headers, correlation IDs
    ├── jobs/              # Background workers (AI dispatch, sync jobs, Loupe streaming)
    ├── utils/             # API-specific utilities (spatial math, hashing, signatures)
    └── types/             # API request/response DTOs and internal types
```
