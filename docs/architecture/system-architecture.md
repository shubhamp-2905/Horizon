# System Architecture

## Architectural Blueprint

Horizon is designed around a decoupled, offline-first, event-driven topology:

```
+-------------------------------------------------------------+
|                  Contributor Mobile App                     |
|           (Offline SQLite + Background Sync Engine)         |
+------------------------------+------------------------------+
                               | HTTPS / WSS
                               v
+-------------------------------------------------------------+
|                    Core Backend API Engine                  |
|             (Authoritative Business Logic & Auth)           |
+------+-----------------------+-----------------------+------+
       |                       |                       |
       v                       v                       v
+---------------+      +---------------+      +---------------+
| PostgreSQL +  |      | Object Store  |      | AI Inference  |
|    PostGIS    |      | (S3 / MinIO)  |      |    Service    |
+---------------+      +---------------+      +-------+-------+
       ^                                              |
       |             Authoritative Signals            |
       +----------------------------------------------+
                               | Verified Datasets
                               v
                      +------------------+
                      | Loupe Pipeline   |
                      +------------------+
```

## Key Invariants
1. **API as Single Source of Truth:** Business logic, task reservation expirations, and reward payouts are centrally governed.
2. **Offline Resilience:** The mobile client operates autonomously in zero-connectivity environments with local spatial caching.
3. **AI Isolation:** The Python AI service produces non-authoritative confidence signals that the API consumes.
