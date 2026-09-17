# Horizon Mobile Application

> Offline-first mobile application for geospatial field contributors.

---

## Architecture & Responsibilities

- **Offline-First Data Storage:** Local SQLite / WatermelonDB for storing downloaded tasks, geographic bounding boxes, and pending submissions.
- **Geospatial & Sensor Capture:** High-precision GPS capture, camera integration with EXIF metadata preservation, and sensor telemetry.
- **Resilient Sync Engine:** Background synchronization worker handling task reservation, offline submission queues, retry backoff, and chunked media uploads.
- **Local Wallet / Profile View:** Read-only view of token balances and task verification progress (actual transactions and ledger updates are processed authoritatively by the backend API).

---

## Directory Structure

```text
mobile/
└── src/
    ├── screens/       # Top-level screen components (Discovery, TaskDetails, Capture, Submissions, Wallet)
    ├── components/    # Reusable mobile UI primitives and map widgets
    ├── navigation/    # React Navigation stacks, tabs, and routing configuration
    ├── features/      # Feature modules (tasks, capture, sync, wallet)
    ├── services/      # Network clients, API clients, location services, device sensors
    ├── hooks/         # Custom React hooks (useLocation, useOfflineSync, useTask)
    ├── store/         # Global client state management (Zustand / Redux)
    ├── database/      # Local offline database schema, models, and migrations
    ├── offline/       # Offline queue management, conflict resolution, and sync worker
    ├── utils/         # Mobile-specific helper utilities (geometry, permissions, formatting)
    ├── types/         # Mobile-specific TypeScript types and navigation params
    └── assets/        # Static assets, vector icons, offline map tiles
```
