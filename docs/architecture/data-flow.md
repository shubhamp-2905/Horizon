# Data Flow & Lifecycle

```
[Contributor App]
       │
       ▼ (1. Discover & Commit Task)
[Backend API] ──► [PostGIS Task Reserve Lock]
       │
       ▼ (2. Field Capture Offline)
[Mobile Local SQLite / Storage]
       │
       ▼ (3. Reconnection & Upload)
[Backend API] ──► [Object Store (Direct Presigned Upload)]
       │
       ├─► (4. Schema Validation & Geofence Check)
       ├─► (5. AI Inference Dispatch) ──► [AI Service (CV & Anti-Spoofing)]
       └─► (6. Peer Verification Queue) ──► [Web Dashboard Reviewers]
       │
       ▼ (7. Consensus Evaluation)
[Authoritative Reward Engine] ──► [Ledger Token Mint / Payout]
       │
       ▼ (8. Export Verified Dataset)
[Loupe Data Pipeline]
```
