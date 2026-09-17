# Horizon Web Application

> Reviewer, validator, and administrator dashboard for the Horizon platform.

---

## Architecture & Responsibilities

- **Geospatial Task Management:** Map-based visualization of bounding boxes, campaigns, task density, and completion statuses.
- **Reviewer & Verification Console:** Inspection interface for community submissions, comparing ground truth photos, sensor readings, and AI verification confidence scores.
- **Admin & Token Governance:** Campaign creation, token payout monitoring, dispute resolution, and community reputation management.

---

## Directory Structure

```text
web/
└── src/
    ├── app/           # Next.js App Router (pages, layouts, route handlers)
    ├── components/    # Reusable UI components, design system primitives, map viewers
    ├── features/      # Feature modules (tasks, review, map, analytics, ledger)
    ├── services/      # HTTP/GraphQL API client services
    ├── hooks/         # Custom React hooks (useMap, useAuth, useTasks)
    ├── lib/           # Utility libraries (geo calculations, formatting, auth)
    ├── types/         # Web-specific TypeScript type definitions
    └── utils/         # Helper functions and constants
```
