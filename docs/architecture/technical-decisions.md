# Technical Decisions (ADRs)

## ADR-001: Monorepo Architecture
- **Status:** Accepted
- **Decision:** Use a single monorepo housing mobile, web, backend API, Python AI service, database scripts, and shared packages (`@horizon/*`).
- **Rationale:** Ensures synchronized typing, atomic cross-package changes, and streamlined CI/CD.

## ADR-002: Spatial Engine Selection
- **Status:** Accepted
- **Decision:** PostgreSQL with PostGIS extension.
- **Rationale:** PostGIS is the industry-standard spatial engine, offering robust geometric operations (ST_DWithin, ST_Contains, ST_Intersects) and spatial indexing.

## ADR-003: AI Service Boundary
- **Status:** Accepted
- **Decision:** Encapsulate all CV/ML pipelines into an isolated Python FastAPI microservice communicating via HTTP/gRPC with the Node API.
- **Rationale:** Keeps Python ML libraries isolated from the primary Node API while enabling independent scaling and GPU acceleration.
