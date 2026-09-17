# Horizon — Architectural Decision Records (ADRs)

---

## ADR-001: Python + FastAPI for Authoritative Backend (Replacing Node.js/NestJS)
- **Status:** Accepted
- **Context:** An earlier scaffold template introduced a Node.js/NestJS placeholder for `apps/api`. However, geospatial data engineering, scientific GIS libraries (GDAL, Shapely, PyProj, GeoAlchemy), and Python AI service interoperability are central to Horizon's mission.
- **Decision:** Mandate **Python 3.12+ and FastAPI with SQLAlchemy 2.0 and Alembic** as the backend framework. Prohibit Node.js/NestJS for backend services.
- **Consequences:** Provides native alignment with Python GIS ecosystems, high-performance async request handling, auto-generated OpenAPI documentation, and strict schema validation with Pydantic v2.

---

## ADR-002: PostgreSQL + PostGIS as the Single Source of Truth
- **Status:** Accepted
- **Context:** Horizon requires native spatial indexing, containment queries (checking if a submission is within a task's geographic polygon), distance calculations, and coordinate transformations.
- **Decision:** Use PostgreSQL 16 with the PostGIS 3.4 extension as the authoritative relational and spatial database.
- **Consequences:** Enables standard OGC geometry storage (`Geometry('POINT', 4326)` and `Geometry('POLYGON', 4326)`), R-Tree / GiST indexing, and high-performance spatial SQL operations (`ST_Contains`, `ST_DWithin`, `ST_Area`).

---

## ADR-003: React Native + Expo with TypeScript for Contributor Mobile
- **Status:** Accepted
- **Context:** Contributors operate across diverse Android and iOS devices in the field.
- **Decision:** Use React Native managed through the Expo ecosystem with TypeScript.
- **Consequences:** Accelerated cross-platform release velocity, unified hardware APIs (camera, geolocation, background sync, file system), and seamless OTA deployment capabilities.

---

## ADR-004: SQLite for Offline-First Edge Collection
- **Status:** Accepted
- **Context:** Ground-truth data collection frequently occurs in remote, rural, or disaster-affected areas with zero network connectivity.
- **Decision:** Adopt an offline-first architecture on mobile using local SQLite storage and a resilient synchronization queue.
- **Consequences:** Contributors can claim tasks, capture telemetry, and fill structured schemas offline. Submissions are queued and batch-synchronized when connectivity is reestablished.

---

## ADR-005: Decoupled AI Verification Microservice
- **Status:** Accepted
- **Context:** Future verification pipelines will utilize deep learning models (MobileNetV3, MobileCLIP, DINOv2, pHash) requiring heavy dependencies (PyTorch, TorchVision) and potential GPU acceleration.
- **Decision:** Isolate all computer vision and machine learning logic in a dedicated microservice (`services/ai`) communicating over HTTP/gRPC.
- **Consequences:** Prevents heavy ML runtimes and GPU drivers from coupling to or degrading the main application API. Keeps AI models strictly non-authoritative: AI provides confidence signals; the backend makes business decisions.

---

## ADR-006: Modular Monolith Architecture for Main Backend
- **Status:** Accepted
- **Context:** Prematurely splitting the backend into numerous microservices introduces distributed transaction overhead, network latency, and operational fragility.
- **Decision:** Implement the authoritative backend as a modular monolith in `apps/api`. Domain modules (`users`, `tasks`, `submissions`, `verification`, `rewards`, `tokens`, `reputation`, `media`) maintain clean internal boundaries while sharing an ACID PostgreSQL database.
- **Consequences:** Simplifies local development, eliminates distributed commit failure modes, and allows future microservice extraction if high-throughput modules demand independent scaling.

---

## ADR-007: Internal Token Economy & Server-Authoritative Ledger
- **Status:** Accepted
- **Context:** Contributor incentives require accountability (staking against abandonment) and prompt reward distribution without the volatility, regulatory friction, or latency of public blockchains.
- **Decision:** Establish an internal, server-authoritative token economy with Starter Grants, Task Commitment Stakes, and an append-only transaction ledger (`TokenTransaction`).
- **Consequences:** Complete auditability, predictable reward economics, zero gas fees, and server-enforced invariants. Client applications never directly determine reward payouts or balances.

---

## ADR-008: S3-Compatible Object Storage for Raw Media
- **Status:** Accepted
- **Context:** High-resolution ground photos and sensor datasets would quickly bloat the PostgreSQL database if stored as binary blobs (`BYTEA`).
- **Decision:** Store media files in S3-compatible object storage (Cloudflare R2, AWS S3, or local MinIO), storing only object keys, content types, and metadata hashes in PostgreSQL.
- **Consequences:** Unlimited scalable media capacity, direct presigned upload support from mobile clients, and minimal database backup footprints.

---

## ADR-009: JWT Bearer Authentication & Role Separation
- **Status:** Accepted
- **Context:** Mobile contributors and web administrators require stateless, secure authentication across distributed networks.
- **Decision:** Implement OAuth2 password bearer tokens with HMAC-SHA256 JWTs using `python-jose` and direct `bcrypt` password hashing. Enforce role separation (`admin` vs `contributor`) at the API route dependency layer via `require_role(...)`.
- **Consequences:** Stateless auth eliminates server session storage bottlenecks, while standard `Authorization: Bearer <token>` headers seamlessly support both Expo mobile clients and Next.js admin dashboards.

---

## ADR-010: Idempotent Starter Token Grant Initialization
- **Status:** Accepted
- **Context:** New contributors need initial stake tokens (100 Starter Tokens) to participate in task discovery without friction, while ensuring malicious users cannot game registration or duplicate accounts to siphon tokens.
- **Decision:** Initialize a server-authoritative `TokenAccount` with 100 available tokens upon contributor registration, accompanied by an immutable `starter_grant` entry in `TokenTransaction`. Check for existing ledger grants before allocating to enforce strict idempotency.
- **Consequences:** Contributor identity is paired with an authoritative token wallet on day one. Contributor mobile clients display the server-derived balance without client-side calculation.

---

## ADR-011: Row-Level Locking for Concurrent Commitment Stake Escrow
- **Status:** Accepted
- **Context:** Multiple contributors or simultaneous requests could attempt to commit to tasks or double-spend available tokens.
- **Decision:** Enforce atomic task claiming wrapped in an ACID transaction using SQLAlchemy's `with_for_update()` row-level locking on `TokenAccount`. If available balance is less than `commitment_stake`, immediately abort and raise HTTP 409 Conflict (`INSUFFICIENT_TOKENS`). Record an append-only `task_stake_lock` audit record in `TokenTransaction`.
- **Consequences:** Prevents race conditions, negative token balances, and duplicate claims. Eliminates distributed lock service overhead while leveraging PostgreSQL's native MVCC row locks.

---

## ADR-012: PostGIS Native Proximity Discovery with Test Dialect Support
- **Status:** Accepted
- **Context:** Mobile contributors discover collection tasks based on physical proximity to their GPS fix, filtered by maximum search radius and artifact categories.
- **Decision:** Leverage PostGIS `ST_DWithin` and `ST_Distance` on WGS84 coordinates (`SRID 4326`) cast to `Geography` for accurate spherical earth distance calculations in meters. Provide an automated Haversine math fallback during in-memory SQLite unit test execution.
- **Consequences:** High-performance spatial indexing via PostGIS GiST indexes on PostgreSQL production, paired with zero-dependency fast test runs in local and CI SQLite environments.

