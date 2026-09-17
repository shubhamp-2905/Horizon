PROJECT: HORIZON
PHASE 2 — TASK DISCOVERY & CONTRIBUTOR EXPERIENCE

You are continuing development of Project Horizon.

IMPORTANT:
Phase 1 has already been completed and verified.

DO NOT rebuild Phase 1.
DO NOT replace the existing architecture.
DO NOT introduce Node.js/NestJS.
DO NOT unnecessarily refactor working Phase 1 code.

Your job is to build Phase 2 ON TOP OF the existing Phase 1 foundation.

==================================================
1. PROJECT CONTEXT
==================================================

Horizon is an offline-first, task-driven geospatial community contribution platform.

The core product loop is:

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

Horizon allows contributors to discover geographic data gaps, claim specific tasks, visit locations, collect evidence, and eventually submit verified ground-truth information.

Phase 2 is focused specifically on:

AUTHENTICATION
→ CONTRIBUTOR IDENTITY
→ STARTER TOKENS
→ TASK CREATION
→ GEOSPATIAL TASK DISCOVERY
→ TASK DETAILS
→ TASK CLAIMING
→ COMMITMENT STAKE

Field data collection itself belongs to Phase 3.

AI/ML belongs primarily to Phase 4.

Production hardening and Loupe integration belong to Phase 5.

==================================================
2. TECHNOLOGY REQUIREMENTS
==================================================

Use the existing Phase 1 stack.

MOBILE:
- React Native
- Expo
- TypeScript

WEB / ADMIN:
- Next.js
- TypeScript

BACKEND:
- Python
- FastAPI
- SQLAlchemy 2.0
- Pydantic
- Alembic
- GeoAlchemy2

DATABASE:
- PostgreSQL
- PostGIS

MEDIA:
- Existing S3-compatible abstraction / MinIO for local development

OFFLINE:
- SQLite on mobile

AI:
- Separate Python + FastAPI service
- DO NOT implement AI models in Phase 2

IMPORTANT:
Python + FastAPI is mandatory for the backend.
Do not introduce Node.js or NestJS.

==================================================
3. PHASE 2 OBJECTIVE
==================================================

At the end of Phase 2, a contributor must be able to:

1. Open Horizon.
2. Register.
3. Log in.
4. Receive their initial Starter Tokens.
5. See their token balance.
6. View available geographic tasks.
7. View tasks on a map.
8. Filter tasks.
9. Open task details.
10. See task requirements.
11. See estimated effort.
12. See reward information.
13. See commitment stake.
14. Commit to a task.
15. Have the commitment stake locked server-side.
16. See the task appear in their claimed/active tasks.
17. See their available and locked token balances update correctly.
18. Be prevented from claiming a task if they do not have sufficient tokens.
19. Be prevented from invalid or duplicate claims.

Admin/reviewer users must be able to:

1. Log in.
2. Create a task.
3. Define task location/geographic area.
4. Define reward parameters.
5. Define commitment stake.
6. Define task requirements.
7. Publish/unpublish tasks.
8. View existing tasks.

This is the Phase 2 definition of done.

==================================================
4. IMPORTANT SCOPE BOUNDARY
==================================================

DO NOT IMPLEMENT THE FOLLOWING IN PHASE 2:

- Camera capture
- Photo upload workflow
- Dynamic submission forms
- GPS evidence capture during field work
- Offline submission synchronization
- AI image quality
- MobileCLIP
- DINOv2
- pHash
- LightGBM
- Human verification
- Automated submission validation
- Final reward calculation after verification
- Reputation scoring
- Fraud detection
- Loupe pipeline integration
- EarthLens integration
- Complex production deployment

Those belong to later phases.

Phase 2 is about:

AUTH + TASKS + MAP + CLAIMING + TOKEN COMMITMENT.

==================================================
5. FIRST STEP — INSPECT PHASE 1
==================================================

Before writing code:

1. Inspect the entire existing Horizon repository.
2. Inspect the Phase 1 database models.
3. Inspect the existing FastAPI architecture.
4. Inspect the existing mobile architecture.
5. Inspect the existing Next.js architecture.
6. Inspect shared TypeScript packages.
7. Inspect existing migrations.
8. Inspect tests.
9. Inspect README and architecture documentation.

Identify what already exists and reuse it.

DO NOT recreate existing models.

DO NOT duplicate utilities.

DO NOT create a second configuration system.

DO NOT create a second database connection layer.

DO NOT replace working Phase 1 code unless absolutely necessary.

Before implementation, provide a short internal implementation plan based on the actual repository.

==================================================
6. AUTHENTICATION & IDENTITY
==================================================

Implement a clean authentication foundation.

The contributor must be able to:

- Register
- Log in
- Log out
- Maintain authenticated session
- Retrieve current user profile

Use secure password hashing.

Use JWT-based authentication unless the existing Phase 1 architecture already establishes another secure mechanism.

Backend endpoints should be approximately:

POST /api/v1/auth/register
POST /api/v1/auth/login
POST /api/v1/auth/logout
GET  /api/v1/auth/me

If logout is implemented as client-side token invalidation for the MVP, document the security tradeoff.

Use access tokens appropriately.

Do not store plaintext passwords.

Do not expose password hashes through APIs.

==================================================
7. USER ROLES
==================================================

The Phase 1 User model supports:

- contributor
- reviewer
- admin

Implement role handling sufficiently for Phase 2.

Contributor:
- discover tasks
- claim tasks
- view own tasks
- view own wallet

Reviewer:
- access reviewer functionality where required

Admin:
- create/update/publish tasks

Do not build a complete role/permission management system yet.

Use backend authorization checks.

Never rely only on the mobile/web UI to enforce permissions.

==================================================
8. STARTER TOKENS
==================================================

Implement the initial Starter Token grant.

IMPORTANT:

Starter Tokens are NOT earned rewards.

They are initial participation credits used to enable the task commitment mechanism.

The current Phase 1 configuration contains:

STARTER_TOKEN_GRANT = 100

Treat this as a PROVISIONAL MVP configuration value.

Do not hardcode 100 throughout the application.

Read it from the shared/configuration layer.

When a new contributor is successfully created:

- create their TokenAccount if one does not exist
- grant the configured Starter Token amount
- create an immutable TokenTransaction describing the grant

Example:

New user:

Available = 100
Locked = 0

Ledger:

STARTER_GRANT +100

This operation must be idempotent.

A user must never receive Starter Tokens multiple times because of:

- repeated API calls
- retry requests
- application restarts
- duplicated registration attempts

==================================================
9. TOKEN ACCOUNT RULES
==================================================

The backend is the ONLY authority for token balances.

The mobile application must NEVER calculate authoritative token balances.

Do not allow:

POST /wallet
{
  "balance": 500
}

or any equivalent client-controlled balance update.

The backend must derive balances from trusted server-side state.

The Phase 1 model contains:

available_balance
locked_balance

Use these correctly.

For Phase 2:

Available Tokens:
Tokens the contributor can use.

Locked Tokens:
Tokens currently committed to active task claims.

Total balance:

available + locked

==================================================
10. TOKEN LEDGER
==================================================

Use the existing TokenTransaction model.

Treat it as an append-only audit ledger.

Phase 2 transaction types should include at minimum:

STARTER_GRANT
TASK_STAKE_LOCK

Do NOT implement final reward issuance yet.

The ledger must record:

- transaction ID
- user/account
- amount
- transaction type
- reference type
- reference ID
- timestamp

Use positive/negative amounts consistently and document the convention.

Example:

STARTER_GRANT
+100

TASK_STAKE_LOCK
-20

The locked balance should increase by 20 when the stake is committed.

Do not simply mutate balances without recording the corresponding ledger event.

==================================================
11. TASK DOMAIN
==================================================

Use the existing Task model from Phase 1.

A task represents a geographic data-collection opportunity.

A task should expose:

- ID
- title
- description
- artifact type
- status
- geographic location
- geographic boundary if available
- difficulty
- scarcity
- base reward
- commitment stake
- estimated effort
- estimated distance if calculated for a contributor
- requirements
- creation timestamp
- expiry if available

Do not redesign the existing Task model unnecessarily.

If a required field is missing, add a migration only when necessary.

==================================================
12. TASK STATUS
==================================================

Use explicit task lifecycle states.

At minimum:

DRAFT
PUBLISHED
PAUSED
COMPLETED
EXPIRED
ARCHIVED

Only PUBLISHED tasks should be discoverable by normal contributors.

Admins can create and modify tasks.

Do not allow contributors to modify tasks.

==================================================
13. TASK CREATION — ADMIN
==================================================

Implement admin task creation.

Endpoint approximately:

POST /api/v1/admin/tasks

Admin should be able to define:

- title
- description
- artifact type
- latitude/longitude
- geographic boundary where applicable
- difficulty
- scarcity
- base reward
- commitment stake
- estimated effort
- requirements
- status

Provide validation.

Examples:

- latitude must be valid
- longitude must be valid
- reward cannot be negative
- stake cannot be negative
- difficulty must be within configured bounds
- scarcity must be within configured bounds
- published tasks must contain required geographic information

Do not allow arbitrary invalid geographic data.

==================================================
14. GEOSPATIAL TASK DISCOVERY
==================================================

This is a major Phase 2 feature.

Use PostgreSQL + PostGIS.

Do NOT fetch every task and calculate distance in Python.

Use PostGIS for spatial queries.

Support:

- nearby tasks
- tasks within a radius
- geographic filtering
- task location
- task boundary

Use appropriate PostGIS functions such as:

ST_DWithin
ST_Distance
ST_Contains

where appropriate.

Use existing spatial indexes.

Do not remove GIST indexes created in Phase 1.

==================================================
15. TASK DISCOVERY API
==================================================

Create contributor endpoints approximately:

GET /api/v1/tasks
GET /api/v1/tasks/{task_id}

Task list should support parameters such as:

latitude
longitude
radius
status
artifact_type
difficulty
minimum_reward
maximum_reward

Do not overcomplicate filtering.

The most important query is:

"Give me published tasks near this location."

Example:

GET /api/v1/tasks?lat=18.52&lng=73.85&radius=5000

Return tasks sorted appropriately.

For initial MVP, prioritize geographic proximity.

Do not claim that this is a personalized recommendation engine.

==================================================
16. TASK DETAIL API
==================================================

GET /api/v1/tasks/{task_id}

Return enough information for the contributor to understand the task before claiming it.

Include:

- title
- description
- artifact type
- location
- approximate distance
- difficulty
- estimated effort
- reward information
- commitment stake
- requirements
- task status

Do not expose internal admin-only fields.

==================================================
17. TASK CLAIMING
==================================================

Implement task claiming.

Endpoint approximately:

POST /api/v1/tasks/{task_id}/claim

The server must perform ALL validation.

Before claiming:

1. User is authenticated.
2. Task exists.
3. Task is PUBLISHED.
4. Task is claimable.
5. User does not already have an active claim for the same task.
6. User has enough available tokens.
7. Commitment stake is valid.

Then atomically:

1. Lock the required token amount.
2. Decrease available balance.
3. Increase locked balance.
4. Create TaskClaim.
5. Create TASK_STAKE_LOCK TokenTransaction.

This must happen inside a database transaction.

If any step fails, the entire operation must roll back.

Never allow:

- negative available balance
- duplicate active claims
- partial token locking
- token deduction without a claim

==================================================
18. COMMITMENT STAKE
==================================================

Use the existing Phase 1 concept.

Starter Tokens give the contributor an initial participation balance.

A task has a commitment stake.

For example:

Contributor:

Available = 100

Task:

Reward = 150
Commitment = 20

After claiming:

Available = 80
Locked = 20

The 20 tokens are NOT spent permanently at this point.

They are locked as a commitment.

The exact stake-return/forfeiture behavior belongs to Phase 3 when the submission and verification lifecycle exists.

For Phase 2:

ONLY LOCK THE STAKE.

Do not implement final stake return yet.

Do not implement fraud penalties yet.

==================================================
19. CONCURRENCY & TRANSACTION SAFETY
==================================================

This is important.

Two requests must not be able to spend the same token balance.

Example:

User has 10 tokens.

Two simultaneous requests attempt to claim tasks requiring 10 tokens.

Only one should succeed.

Use appropriate database transaction/isolation/row-locking techniques.

The operation should be atomic.

Test concurrent/duplicate claim behavior where practical.

==================================================
20. CLAIMED TASKS
==================================================

Implement an endpoint:

GET /api/v1/me/tasks

Return tasks currently claimed by the authenticated contributor.

Show:

- task
- claim status
- stake
- claimed_at
- task status
- next action placeholder

Do not build the full submission workflow.

The mobile app should show the task as:

"Committed"

rather than pretending it is already completed.

==================================================
21. MOBILE APP — AUTH
==================================================

Implement contributor authentication screens.

Create:

- Welcome / landing
- Register
- Login
- Basic authenticated home

Use a clean mobile-first UX.

Do not overdesign.

Focus on usability.

==================================================
22. MOBILE APP — HOME
==================================================

Create the first real Horizon contributor home screen.

It should show:

HORIZON

Token balance

Available tokens
Locked tokens

Nearby task summary

Active/committed tasks

Navigation to:

- Discover
- My Tasks
- Wallet
- Profile

Keep the UI consistent and clean.

==================================================
23. MOBILE APP — TASK DISCOVERY
==================================================

Build the contributor task discovery experience.

Primary experience:

MAP-FIRST + TASK-FIRST

The contributor should be able to:

1. View available tasks.
2. See task markers.
3. Tap a marker.
4. Open task information.
5. View nearby task list.
6. Filter tasks.

Use a map library compatible with React Native + Expo.

Do not create fake geographic data in production code.

For development, a small seed dataset may be created.

==================================================
24. TASK CARD
==================================================

Create a reusable TaskCard component.

Show:

Task title

Artifact type

Distance

Estimated effort

Reward

Commitment stake

Difficulty

Status

Example:

--------------------------------
Water Source Survey

2.4 km
~25 min

Reward
150 tokens

Commitment
20 tokens

Difficulty
Medium

[ VIEW TASK ]
--------------------------------

Do not overload the card.

==================================================
25. TASK DETAIL SCREEN
==================================================

Create a detailed task screen.

Structure:

TASK TITLE

Location / map preview

Description

What you need to collect

Required evidence summary

Estimated effort

Difficulty

Reward

Commitment stake

Important notes

[ COMMIT TO TASK ]

Before committing, clearly explain:

"You will lock X tokens to commit to this task."

The contributor must understand that these tokens are locked, not immediately consumed.

==================================================
26. TOKEN WALLET UI
==================================================

Create a basic wallet screen.

Show:

TOTAL
Available
Locked

Transaction history.

Example:

+100 Starter Tokens

-20 Task Commitment

Do not allow any manual balance modification.

Wallet data comes from backend APIs.

==================================================
27. MOBILE API CLIENT
==================================================

Replace placeholder API client functionality where necessary.

Create typed functions for:

register
login
logout
getCurrentUser
getWallet
getTasks
getTask
claimTask
getMyTasks

Keep API communication centralized.

Do not scatter fetch calls throughout screens.

==================================================
28. AUTH SESSION STORAGE
==================================================

Store authentication state securely on mobile.

Do not store sensitive credentials in plain AsyncStorage.

Use an appropriate secure storage mechanism supported by Expo.

Handle:

- login
- session restoration
- logout
- expired token

==================================================
29. WEB ADMIN CONSOLE
==================================================

Extend the existing Next.js dashboard from Phase 1.

Do not redesign the entire dashboard.

Add:

TASK MANAGEMENT

Pages/components:

- Task list
- Create task
- Edit task
- Publish/unpublish
- Task details

Show:

Task title
Artifact type
Location
Status
Difficulty
Reward
Stake

==================================================
30. ADMIN TASK CREATION UI
==================================================

Create a functional task creation form.

Fields:

Title
Description
Artifact type
Latitude
Longitude
Geographic boundary if supported
Difficulty
Scarcity
Base reward
Commitment stake
Estimated effort
Requirements

Add client-side validation.

Backend validation remains authoritative.

After creation:

show success state.

Allow admin to publish the task.

==================================================
31. SEED DATA
==================================================

Create a small DEVELOPMENT-ONLY seed dataset.

Use realistic sample tasks.

For example:

1. Community Water Source
2. Community Education Center
3. Local Sacred Site
4. Unmapped Archaeological Feature
5. Community Gathering Point

These are only development examples.

Clearly mark seed data as development data.

Do not present fake data as real Loupe data.

Use realistic coordinates only if clearly marked as development/demo data.

==================================================
32. DATABASE MIGRATIONS
==================================================

Inspect whether Phase 1 models already support all required Phase 2 functionality.

If changes are needed:

1. Modify SQLAlchemy models.
2. Create a new Alembic migration.
3. Do NOT edit the existing Phase 1 migration unless there is a genuine migration error.

Migration must be reversible where practical.

==================================================
33. BACKEND API STRUCTURE
==================================================

Keep the existing modular monolith.

Organize functionality approximately:

app/modules/
    auth/
    users/
    tasks/
    tokens/
    admin/

Do not create unnecessary microservices.

The AI service remains separate but is NOT required for Phase 2.

==================================================
34. SECURITY
==================================================

Implement basic security correctly.

Requirements:

- Password hashing
- JWT validation
- Authentication middleware/dependencies
- Role authorization
- Input validation
- SQL injection protection through SQLAlchemy
- No hardcoded secrets
- No token manipulation from clients
- No admin operations available to contributors

Do not claim enterprise-grade security.

==================================================
35. ERROR HANDLING
==================================================

Create clean API errors.

Examples:

401 Unauthorized

403 Forbidden

404 Task not found

409 Task already claimed

409 Insufficient token balance

422 Validation error

Return structured errors suitable for mobile UI.

Example:

{
  "error": {
    "code": "INSUFFICIENT_TOKENS",
    "message": "You do not have enough available tokens to commit to this task."
  }
}

==================================================
36. TESTING
==================================================

Add real tests.

Backend tests should cover at minimum:

AUTH:
- registration
- duplicate registration
- login
- invalid password
- authenticated user

TOKENS:
- Starter Token grant
- grant idempotency
- wallet retrieval

TASKS:
- create task as admin
- contributor cannot create task
- publish task
- unpublished task not visible to contributor
- task retrieval
- geographic task query

CLAIMING:
- successful claim
- insufficient tokens
- duplicate claim
- unpublished task cannot be claimed
- token balance updates
- locked balance updates
- ledger transaction created

SECURITY:
- unauthorized endpoints
- contributor cannot access admin endpoints

Use database-backed tests where required.

Do not mock away the entire business logic.

==================================================
37. GEOSPATIAL TESTING
==================================================

Create at least basic tests proving:

1. Nearby published task can be discovered.
2. Distant task is excluded from radius query.
3. Geographic coordinates are stored correctly.
4. Task geographic data uses SRID 4326.
5. Spatial indexes remain available.

==================================================
38. API DOCUMENTATION
==================================================

FastAPI automatically exposes OpenAPI documentation.

Ensure endpoints have:

- clear names
- descriptions
- request models
- response models
- authentication requirements
- useful error responses

Keep the API documentation understandable.

==================================================
39. PRODUCT RULES
==================================================

Keep these rules explicit.

RULE 1:
Starter Tokens are initial participation credits.

RULE 2:
Task rewards are NOT paid when a task is claimed.

RULE 3:
Claiming locks the commitment stake.

RULE 4:
Only the backend can modify token state.

RULE 5:
Only published tasks are visible to contributors.

RULE 6:
A contributor cannot have multiple active claims for the same task.

RULE 7:
Token operations must be auditable.

RULE 8:
Geospatial filtering should be performed by PostGIS.

RULE 9:
The client cannot decide reward or token balances.

RULE 10:
AI is not part of Phase 2 business logic.

==================================================
40. IMPORTANT PRODUCT CLARIFICATION
==================================================

Do NOT implement the old concept where contributors receive tokens in exchange for EarthLens report access.

That is NOT the Horizon direction.

Horizon tokens are an internal participation/reward mechanism.

EarthLens remains a downstream consumer of verified geospatial intelligence.

==================================================
41. UX PRINCIPLES
==================================================

The contributor experience should be:

MAP-FIRST
TASK-FIRST
FIELD-FIRST

Prioritize:

- clarity
- minimal steps
- obvious reward
- obvious commitment requirement
- clear location
- clear task requirements
- clear token state

Avoid:

- unnecessary animations
- excessive dashboards
- complicated onboarding
- cryptocurrency-style wallet UI
- unnecessary gamification
- technical terminology

The product should feel like a serious geospatial field-data platform.

==================================================
42. NO OVER-ENGINEERING
==================================================

Do not introduce:

- Kubernetes
- Kafka
- Redis unless genuinely required
- GraphQL
- blockchain
- cryptocurrency
- microservices for every domain
- event-driven architecture
- complex recommendation systems

The current architecture should remain:

React Native
+
Next.js
+
FastAPI modular monolith
+
PostgreSQL/PostGIS
+
S3-compatible storage
+
separate AI service

==================================================
43. DEFINITION OF DONE
==================================================

Phase 2 is complete only when:

AUTH
[ ] Contributor can register
[ ] Contributor can log in
[ ] Contributor can log out
[ ] Current user endpoint works
[ ] Role authorization works

TOKENS
[ ] New contributor receives Starter Tokens
[ ] Starter grant is idempotent
[ ] Wallet shows available/locked balance
[ ] Token ledger records Starter Token grant

TASKS
[ ] Admin can create task
[ ] Admin can edit task
[ ] Admin can publish/unpublish task
[ ] Published tasks are discoverable
[ ] Task details work
[ ] Geographic task queries work
[ ] PostGIS is used for spatial filtering

CLAIMING
[ ] Contributor can claim task
[ ] Commitment stake locks
[ ] Available balance decreases
[ ] Locked balance increases
[ ] Ledger transaction is created
[ ] Duplicate claims are prevented
[ ] Insufficient token balance is rejected
[ ] Concurrent claims are handled safely

MOBILE
[ ] Auth screens work
[ ] Home screen works
[ ] Task map works
[ ] Task list works
[ ] Task detail works
[ ] Commit task works
[ ] Wallet works
[ ] My Tasks works

ADMIN
[ ] Admin dashboard works
[ ] Task creation works
[ ] Task management works

TESTING
[ ] Backend tests pass
[ ] Geospatial tests pass
[ ] Authentication tests pass
[ ] Token tests pass
[ ] Claiming tests pass

DOCUMENTATION
[ ] API documentation updated
[ ] Phase 2 architecture notes updated
[ ] README updated
[ ] Product workflow updated

==================================================
44. VERIFICATION / DEMO FLOW
==================================================

Before declaring Phase 2 complete, perform this exact demonstration:

STEP 1
Create an admin user.

STEP 2
Login as admin.

STEP 3
Create:

"Community Water Source Survey"

Reward:
150 tokens

Commitment:
20 tokens

Difficulty:
2.0

Scarcity:
1.5

Location:
Development/demo geographic coordinate.

STEP 4
Publish the task.

STEP 5
Create a contributor.

STEP 6
Verify Starter Tokens:

Available = 100
Locked = 0

STEP 7
Open mobile app.

STEP 8
Login as contributor.

STEP 9
Open Discover.

STEP 10
See the task on the map/list.

STEP 11
Open task details.

STEP 12
Verify:

Reward = 150
Commitment = 20

STEP 13
Commit to task.

STEP 14
Verify:

Available = 80
Locked = 20

STEP 15
Verify ledger:

STARTER_GRANT +100
TASK_STAKE_LOCK -20

STEP 16
Attempt to claim the same task again.

It must fail.

STEP 17
Attempt another task requiring more tokens than available.

It must fail with a clear error.

This demonstration is the minimum end-to-end Phase 2 acceptance test.

==================================================
45. PERFORMANCE
==================================================

Do not prematurely optimize.

But ensure:

- database indexes are used
- spatial queries use PostGIS
- pagination exists for task lists
- APIs don't return unnecessary data
- mobile task lists are efficiently rendered

==================================================
46. DOCUMENTATION OF DECISIONS
==================================================

Update:

docs/architecture/decisions.md

Add Phase 2 decisions such as:

- JWT authentication approach
- Starter Token initialization
- server-authoritative token balances
- task commitment mechanism
- PostGIS spatial discovery
- transactional token locking
- contributor/admin separation

==================================================
47. FINAL EXECUTION INSTRUCTIONS
==================================================

Before coding:

1. Inspect Phase 1.
2. Identify reusable components.
3. Identify any missing requirements.
4. Create an implementation plan.

Then implement Phase 2 incrementally.

Recommended implementation order:

1. Authentication backend
2. Authentication database integration
3. Starter token initialization
4. Wallet APIs
5. Task APIs
6. PostGIS spatial discovery
7. Task claiming transaction
8. Backend tests
9. Mobile authentication
10. Mobile home
11. Mobile task discovery
12. Mobile map
13. Task details
14. Commit task
15. Wallet
16. My Tasks
17. Admin task management
18. Seed data
19. Integration testing
20. Documentation

After implementation:

Run:

- backend tests
- migration checks
- API checks
- frontend type checks
- Next.js build
- mobile TypeScript checks/build validation where available

Perform the complete Phase 2 demo flow described above.

Fix errors introduced during implementation.

Do not move to Phase 3 automatically.

==================================================
48. FINAL RESPONSE REQUIRED FROM ANTIGRAVITY
==================================================

When Phase 2 is complete, provide:

1. Summary of what was implemented.
2. Files/modules added or modified.
3. Database migrations created.
4. API endpoints created.
5. Mobile screens created.
6. Admin functionality created.
7. Token flow implemented.
8. PostGIS functionality implemented.
9. Tests executed and results.
10. Build results.
11. Demo flow verification results.
12. Known limitations.
13. Recommended next step.

IMPORTANT:

DO NOT claim Phase 2 is complete if the acceptance/demo flow fails.

Do not proceed automatically to Phase 3.

STOP after Phase 2.