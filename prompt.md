You are a senior software architect helping me initialize a new project called "Horizon".

Horizon is an offline-first, task-driven geospatial community contribution platform.

The core workflow is:

JOIN
→ STARTER TOKENS
→ DISCOVER TASK
→ COMMIT TO TASK
→ DOCUMENT
→ SUBMIT
→ VALIDATE
→ VERIFY
→ REWARD
→ VERIFIED DATA
→ LOUPE DATA PIPELINE

The platform will eventually have:
- A contributor mobile application
- A backend API
- PostgreSQL + PostGIS database
- Object/media storage
- AI/ML verification services
- Token/reward engine
- Token ledger
- Reviewer/admin dashboard
- Integration with Loupe's downstream data pipeline

For now, DO NOT implement application logic, APIs, database schemas, authentication, AI models, or UI components.

I only want you to create a clean, scalable, production-oriented PROJECT FOLDER STRUCTURE.

Use a monorepo architecture.

Create the following high-level structure:

horizon/
├── apps/
│   ├── mobile/
│   ├── web/
│   └── api/
│
├── services/
│   └── ai/
│
├── packages/
│   ├── types/
│   ├── config/
│   ├── validation/
│   └── utils/
│
├── database/
│   ├── migrations/
│   ├── seeds/
│   └── scripts/
│
├── docs/
│   ├── architecture/
│   ├── product/
│   ├── api/
│   └── ai/
│
├── infrastructure/
│   ├── docker/
│   └── deployment/
│
├── scripts/
├── tests/
├── .github/
│   └── workflows/
├── .env.example
├── .gitignore
├── README.md
└── package.json

Then create sensible placeholder subfolders inside each application/service.

For example:

MOBILE:
- src/
  - screens/
  - components/
  - navigation/
  - features/
  - services/
  - hooks/
  - store/
  - database/
  - offline/
  - utils/
  - types/
  - assets/

WEB:
- src/
  - app/
  - components/
  - features/
  - services/
  - hooks/
  - lib/
  - types/
  - utils/

API:
- src/
  - modules/
  - common/
  - config/
  - database/
  - guards/
  - middleware/
  - jobs/
  - utils/
  - types/

Inside API modules, create placeholder module folders for:
- auth
- users
- tasks
- submissions
- verification
- rewards
- tokens
- reputation
- media
- admin

AI SERVICE:
- app/
  - models/
  - pipelines/
  - inference/
  - preprocessing/
  - postprocessing/
  - schemas/
  - services/
  - utils/
  - config/
- tests/

DOCUMENTATION:
Include placeholders for:
- product requirements
- user flows
- system architecture
- data flow
- token economy
- verification strategy
- AI/ML strategy
- API documentation
- technical decisions

IMPORTANT ARCHITECTURE PRINCIPLES:

1. Keep the project modular and easy to scale.
2. Do not over-engineer it with unnecessary microservices.
3. The API should remain the source of truth for business logic.
4. Token balances must never be controlled by the client.
5. The token system should eventually use an auditable ledger.
6. Geospatial data belongs in PostgreSQL + PostGIS.
7. Media should be separated from the relational database and stored in object storage.
8. The mobile app must support offline-first workflows, so keep offline/local database functionality clearly separated.
9. AI should be isolated as a separate Python service.
10. AI provides signals/predictions; the backend/reward engine makes authoritative decisions.
11. Keep shared types, validation schemas, and utilities in packages so they can be reused safely.
12. Keep infrastructure and deployment configuration separate from application code.
13. Keep tests organized by application/service.
14. Do not create files containing fake implementations just to fill the structure.
15. Use placeholder README files where useful to explain the purpose of major directories.

Also create a root README.md that briefly explains:
- What Horizon is
- The core product workflow
- The purpose of each major directory
- The planned technology stack
- The current status: "Architecture / Initial Setup"

Do not install unnecessary dependencies.
Do not write business logic.
Do not create dummy APIs.
Do not create mock AI models.
Do not create database tables yet.

The goal is to create a clean foundation that we can incrementally build into the Horizon MVP.