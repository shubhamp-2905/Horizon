PROJECT HORIZON
PHASE 2 — OFFLINE-FIRST MOBILE

============================================================
CURRENT STATUS
============================================================

Phase 0 — Baseline Audit:
COMPLETED

Phase 1 — Field Submission Foundation:
COMPLETED

Current verified state:

- Backend tests: 18/18 passing
- Phase 1 acceptance: 13/13 passing
- Phase 2 previous acceptance flow: 17/17 passing
- Next.js production build: passing
- Mobile TypeScript: passing
- No known regressions

Phase 1 now provides:

- Submission lifecycle
- Draft creation/update
- Dynamic task form schemas
- GPS/location telemetry
- Media metadata
- Submission media registration
- Claim/submission state synchronization
- Submission API
- Verification persistence
- Admin review foundation

Existing mobile offline foundation:

- React Native + Expo
- TypeScript
- SQLite foundation
- queue.ts
- Existing API client

============================================================
PHASE 2 OBJECTIVE
============================================================

Complete the REAL offline-first field workflow.

A contributor must be able to perform field work even when there is:

- no internet
- intermittent internet
- weak internet
- network switching
- app restart

The core requirement is:

ONLINE
  ↓
Download/cache task
  ↓
Start task
  ↓
OFFLINE
  ↓
Capture location
  ↓
Capture images
  ↓
Fill observations
  ↓
Save locally
  ↓
Create local submission
  ↓
Queue synchronization
  ↓
NETWORK RETURNS
  ↓
Synchronize safely
  ↓
Server confirms
  ↓
Local state becomes synced

The user must NEVER lose collected evidence because the network disappeared.

============================================================
CRITICAL RULES
============================================================

1. DO NOT rewrite the mobile application.

2. DO NOT replace React Native.

3. DO NOT replace Expo.

4. DO NOT replace SQLite.

5. DO NOT introduce another local database.

6. DO NOT introduce Redux/MobX/Zustand/etc. unless the repository already uses one and it is necessary.

7. DO NOT modify FastAPI architecture unnecessarily.

8. DO NOT modify token economics.

9. DO NOT modify AI functionality.

10. DO NOT implement MobileNetV3, MobileCLIP, DINOv2, pHash, or LightGBM in this phase.

11. DO NOT redesign the entire UI.

12. DO improve the existing mobile screens where necessary to communicate offline state.

13. Preserve every existing passing test.

14. Do not fake synchronization.

15. Do not silently discard failed operations.

============================================================
1. FIRST — INSPECT CURRENT OFFLINE IMPLEMENTATION
============================================================

Inspect:

apps/mobile/

especially:

- queue.ts
- API client
- SQLite/database layer
- navigation
- task screens
- TaskDetailScreen
- MyTasksScreen
- submission screens if already present
- authentication persistence
- existing state management
- existing network detection
- existing storage utilities

Also inspect:

packages/types/

and backend APIs related to:

- tasks
- claims
- submissions
- media
- task form schemas

Determine exactly what is already implemented.

Do not create duplicate abstractions.

Before coding, produce a concise:

CURRENT OFFLINE ARCHITECTURE

showing:

SERVER
↓
API CLIENT
↓
LOCAL DATABASE
↓
QUEUE
↓
SYNC ENGINE
↓
UI STATE

Then implement the missing pieces.

============================================================
2. OFFLINE-FIRST DATA MODEL
============================================================

SQLite should become the local source of truth for field operations while offline.

At minimum, locally cache:

TASKS
CLAIMS
FORM SCHEMAS
SUBMISSION DRAFTS
OBSERVATIONS
LOCATIONS
MEDIA REFERENCES
SYNC OPERATIONS

Do NOT attempt to replicate the entire PostgreSQL database locally.

Only cache data necessary for the contributor workflow.

============================================================
3. LOCAL TASK CACHE
============================================================

When the contributor has connectivity:

Fetch relevant tasks.

Store locally:

- task ID
- title
- description
- artifact type
- location
- radius/area information
- difficulty
- reward information
- requirements
- task status
- created/updated timestamps
- last synced timestamp

Use the server as the authoritative source.

SQLite is the offline working copy.

============================================================
4. FORM SCHEMA CACHE
============================================================

Task-specific form schemas must also be cached.

Example:

Task:
Water Source Survey

Schema:
- water_source_type
- condition
- accessibility
- water_present
- seasonal
- required photos

The contributor must be able to open a previously downloaded/claimed task and continue working without a network connection.

Do not require a network request just to render the form.

If a task has no locally cached schema:

show a clear state rather than crashing.

============================================================
5. LOCAL CLAIM CACHE
============================================================

A claimed task must remain accessible offline.

Store locally:

- task ID
- claim ID
- claim status
- stake amount
- claimed timestamp
- local synchronization state

The local app must distinguish:

SERVER CONFIRMED CLAIM

from

LOCAL PENDING ACTION

Do not let an offline client invent a server-authoritative claim.

IMPORTANT:

If claiming currently requires a live server request, preserve that behavior unless the existing architecture explicitly supports offline claiming.

Phase 2 priority is:

OFFLINE WORK AFTER A VALID CLAIM

not speculative offline claiming.

============================================================
6. LOCAL SUBMISSION DRAFT
============================================================

When a contributor starts a field survey:

Create or load the local draft.

Local draft should contain:

- local submission ID
- server submission ID if known
- task ID
- claim ID
- observations
- location
- media references
- draft status
- created timestamp
- updated timestamp
- sync status

Possible local states:

LOCAL_DRAFT
READY_TO_SYNC
SYNCING
SYNCED
SYNC_FAILED

Do not confuse local synchronization state with server submission status.

Example:

Local:
SYNCED

Server:
SUBMITTED

or:

Local:
READY_TO_SYNC

Server:
no submission yet

These are different concepts.

============================================================
7. CLIENT-GENERATED IDENTIFIERS
============================================================

Every locally created submission must have a stable client-generated ID.

Use UUID or the repository's existing identifier mechanism.

Example:

local_submission_id

This ID must survive:

- app restart
- retries
- network changes
- process termination

It must not be regenerated every time synchronization is attempted.

This is essential for idempotency.

============================================================
8. SYNC QUEUE
============================================================

Complete the existing queue.ts implementation.

The queue must support operations such as:

CREATE_SUBMISSION
UPDATE_SUBMISSION
ATTACH_MEDIA
FINALIZE_SUBMISSION

Only include operations actually required by the existing API.

Each queue item should contain conceptually:

- operation ID
- operation type
- local entity ID
- server entity ID if known
- payload/reference
- created timestamp
- retry count
- last attempt
- status
- error information

Possible states:

PENDING
SYNCING
FAILED
COMPLETED

Avoid ambiguous boolean fields such as:

synced = true/false

A real state machine is easier to debug.

============================================================
9. SYNC ORDER
============================================================

Synchronization must respect dependencies.

Example:

CREATE_SUBMISSION
        ↓
UPDATE_SUBMISSION
        ↓
ATTACH_MEDIA
        ↓
FINALIZE_SUBMISSION

Do NOT upload media before the server knows which submission it belongs to.

Do NOT finalize a submission before required evidence has synchronized.

The sync engine must understand operation dependencies.

============================================================
10. IDEMPOTENT SYNCHRONIZATION
============================================================

This is one of the most important requirements.

Consider:

Client sends:

CREATE_SUBMISSION

Server successfully creates it.

Network fails before client receives response.

Client retries.

The server must NOT create a second submission.

Use the Phase 1 client-generated identifier / idempotency mechanism.

Same principle for:

- media attachment
- final submission

Retries must be safe.

============================================================
11. NETWORK DETECTION
============================================================

Use the existing Expo-compatible network capability if already present.

Detect:

ONLINE
OFFLINE

Also handle:

NETWORK_UNSTABLE

Do not assume:

"network connected"

means:

"server request will succeed."

A request can still fail due to:

- timeout
- DNS
- server unavailable
- API error

The sync engine must treat request failures separately from actual connectivity state.

============================================================
12. AUTOMATIC SYNC
============================================================

When network becomes available:

Automatically attempt synchronization.

Flow:

OFFLINE
  ↓
NETWORK AVAILABLE
  ↓
SYNC QUEUE
  ↓
PROCESS OPERATIONS
  ↓
SERVER CONFIRMATION
  ↓
UPDATE LOCAL STATE

Do not block the entire application while synchronization happens.

Sync should run safely in the background where Expo architecture permits.

============================================================
13. MANUAL SYNC
============================================================

Also provide a manual synchronization action.

Example:

Sync Now

Display:

Syncing...

or:

All changes synced

or:

3 items waiting to sync

This is important for field users who want confidence that their evidence has reached the server.

============================================================
14. RETRY ENGINE
============================================================

Failed operations must be retried safely.

Do not retry infinitely at maximum speed.

Use bounded retry behavior.

Example strategy:

Attempt 1
↓
short delay

Attempt 2
↓
longer delay

Attempt 3
↓
longer delay

Eventually:

FAILED

Then wait for:

- network restoration
- manual retry
- application retry policy

Do not create aggressive polling.

============================================================
15. ERROR CLASSIFICATION
============================================================

Not every error should be retried.

Classify errors.

RETRYABLE:

- timeout
- connection failure
- server temporarily unavailable
- 5xx

NOT AUTOMATICALLY RETRYABLE:

- 400 validation error
- 401 authentication failure
- 403 authorization
- 404 invalid entity
- 409 business conflict

For non-retryable errors:

mark the queue operation appropriately.

Show the user enough information to fix the issue.

Do not hide permanent failures.

============================================================
16. SYNC STATUS UI
============================================================

The mobile application must clearly communicate synchronization.

Add a global sync indicator where appropriate.

Possible states:

✓ Synced

⟳ Syncing...

3 changes waiting

⚠ Sync failed

Offline

Example:

--------------------------------
OFFLINE

Your work is saved on this device.

3 items waiting to sync.
--------------------------------

When synchronized:

--------------------------------
✓ ALL CHANGES SYNCED

Last synced:
09:42 AM
--------------------------------

The user should never wonder:

"Did my data disappear?"

============================================================
17. FIELD COLLECTION OFFLINE UX
============================================================

When offline:

DO NOT disable:

- viewing cached tasks
- opening claimed tasks
- viewing cached form schema
- editing local draft
- capturing images
- capturing location
- entering observations
- reviewing draft

Instead:

Show:

OFFLINE

and explain:

"Your work will sync automatically when you're back online."

============================================================
18. MEDIA OFFLINE STORAGE
============================================================

This is critical.

When the contributor captures an image offline:

The image must be stored locally.

Do NOT store only a remote URL.

Store:

- local URI
- local media ID
- submission ID
- MIME type
- file size
- dimensions where available
- capture timestamp
- GPS metadata where available
- upload/sync status
- content hash where possible

Example:

LOCAL MEDIA

local_media_id
submission_id
local_uri
status = PENDING_UPLOAD

When network returns:

LOCAL FILE
↓
UPLOAD
↓
SERVER STORAGE
↓
MEDIA RECORD
↓
LOCAL STATUS = SYNCED

============================================================
19. IMAGE STORAGE SAFETY
============================================================

Do not allow app cleanup mechanisms to delete unsynchronized evidence.

A media file should only be deleted locally when:

- server upload succeeded
- server media record exists
- local state is safely marked synced

Even then, preserve the file if the product's offline recovery policy requires it.

Never delete pending evidence simply because:

"cache cleanup"

occurred.

============================================================
20. APP RESTART RECOVERY
============================================================

Test this scenario:

1. User claims task.
2. User starts submission.
3. User goes offline.
4. Captures GPS.
5. Captures 4 images.
6. Completes form.
7. App is killed.
8. App is reopened.
9. Network remains offline.

Expected:

Draft is still present.

Images are still present.

Observations are still present.

Location is still present.

Sync status is preserved.

Then:

10. Network returns.
11. Sync starts.
12. Submission reaches server.

============================================================
21. PARTIAL SYNC RECOVERY
============================================================

Test:

Submission created successfully.

Media 1 uploaded.

Media 2 failed.

Media 3 uploaded.

Network disappears.

Expected:

Do NOT recreate submission.

Do NOT re-upload media 1 unnecessarily.

Do NOT lose media 2.

When network returns:

Resume from the failed operation.

This requires operation-level synchronization state.

============================================================
22. DUPLICATE PREVENTION
============================================================

Ensure that repeated synchronization does not create:

- duplicate submission
- duplicate media
- duplicate observation
- duplicate finalization
- duplicate server records

Use:

client IDs
+
idempotency keys
+
server uniqueness constraints where appropriate.

Do not rely solely on client-side checks.

============================================================
23. SERVER-SIDE IDEMPOTENCY
============================================================

Review Phase 1 APIs.

If required, extend the FastAPI backend so requests include:

Idempotency-Key

or a stable client-generated resource identifier.

For example:

POST /tasks/{task_id}/submission

with:

client_submission_id

The server should recognize repeated creation attempts.

Do not introduce a generic distributed idempotency system unless necessary.

Keep it simple and reliable.

============================================================
24. CONFLICT HANDLING
============================================================

Define behavior for:

- submission already submitted
- claim released
- task no longer available
- server record deleted/invalid
- stale draft
- media already uploaded

Do not overwrite server data blindly.

Examples:

If server says:

SUBMISSION ALREADY SUBMITTED

local state should become:

SYNCED / SUBMITTED

not:

FAILED

If server says:

CLAIM NO LONGER VALID

show:

"This task can no longer be submitted."

Preserve local evidence.

Do not delete it automatically.

============================================================
25. AUTHENTICATION OFFLINE
============================================================

Inspect the existing authentication persistence.

The app should remain usable for active field work after temporary network loss.

Do NOT implement offline registration.

Do NOT allow sensitive authentication operations without the server.

Use the existing authentication architecture.

If an access token expires while offline:

- preserve local work
- do not lose drafts
- require reauthentication when synchronization requires it

Never delete local evidence because authentication failed.

============================================================
26. TASK CACHE EXPIRATION
============================================================

Cached data should include:

last_synced_at

Do not aggressively delete task data.

A user may need to finish a task after losing connectivity.

Clearly indicate stale data when appropriate.

Example:

Task information
Last synced 2h ago

Do not prevent useful field work solely because cached metadata is old unless the task's server-side rules require it.

============================================================
27. SQLITE DATA MODEL
============================================================

Inspect existing SQLite implementation.

Extend it rather than creating a parallel system.

Potential local tables:

cached_tasks
cached_claims
cached_form_schemas
local_submissions
local_observations
local_locations
local_media
sync_operations

Only create tables that do not already exist.

Each table must have a clear purpose.

Avoid copying every PostgreSQL field into SQLite.

============================================================
28. SQLITE MIGRATIONS
============================================================

If the local database schema changes:

Implement a proper local migration/versioning strategy.

Do not simply delete the local database during development.

Existing user data should survive app updates.

============================================================
29. SYNC ENGINE ARCHITECTURE
============================================================

Use a clear separation:

LOCAL REPOSITORY
        ↓
SYNC QUEUE
        ↓
SYNC ENGINE
        ↓
API CLIENT
        ↓
FASTAPI

The UI should not manually orchestrate:

create submission
then upload media
then finalize

directly when offline.

Instead:

UI
 ↓
Local Repository
 ↓
Local DB
 ↓
Queue
 ↓
Sync Engine

This is the foundation for reliable offline-first architecture.

============================================================
30. LOCAL REPOSITORY
============================================================

Create a clean abstraction if the repository does not already have one.

Example:

TaskRepository
SubmissionRepository
MediaRepository
SyncRepository

The mobile UI should interact with repositories rather than directly manipulating SQLite.

Do not over-engineer.

The goal is:

UI
→ repository
→ SQLite

and:

sync engine
→ repository
→ API

============================================================
31. UI STATE
============================================================

The UI must distinguish:

LOCAL DRAFT
SYNCING
SYNCED
SYNC FAILED

For example:

Task Detail

Status:
In Progress

Sync:
✓ Synced

or:

Sync:
3 changes pending

Submission:

Draft saved locally

This should be visible but not intrusive.

============================================================
32. HOME SCREEN
============================================================

Improve the existing HomeScreen to surface useful sync information.

Potential cards:

ACTIVE TASKS
2

PENDING SYNC
3

COMPLETED
14

TOKENS
320

Do not add fake metrics.

Only show data that exists.

A compact sync status component is especially important.

============================================================
33. MY TASKS
============================================================

Show task status clearly.

Example:

WATER SOURCE SURVEY

Claimed

Draft saved locally

or:

Submitted

or:

Waiting for sync

Do not make the user guess what happened.

============================================================
34. SUBMISSION STATUS
============================================================

Separate:

SERVER STATUS

from:

SYNC STATUS

Example:

Server:
DRAFT

Sync:
SYNCED

or:

Server:
SUBMITTED

Sync:
SYNCED

or:

Server:
unknown

Sync:
PENDING

This distinction is mandatory.

============================================================
35. NETWORK CHANGE TESTING
============================================================

Test:

ONLINE
→ OFFLINE
→ ONLINE

and:

ONLINE
→ OFFLINE
→ app restart
→ ONLINE

and:

ONLINE
→ weak connection
→ timeout
→ retry
→ success

and:

OFFLINE
→ capture multiple tasks
→ ONLINE
→ sync multiple operations

============================================================
36. PERFORMANCE
============================================================

Do not block the UI during sync.

Do not:

- reload entire task lists unnecessarily
- upload all media simultaneously
- create excessive API calls
- repeatedly re-render the entire app

Use controlled synchronization.

If multiple media files exist:

Use a safe sequential or bounded-concurrency strategy.

Do not exhaust memory.

============================================================
37. SECURITY
============================================================

Never store:

- passwords
- refresh secrets unnecessarily
- sensitive credentials

in plain text.

If authentication tokens are persisted, follow the existing secure storage architecture.

Local field evidence is sensitive product data.

Do not expose file paths unnecessarily.

============================================================
38. OBSERVABILITY
============================================================

Add useful local sync logs.

Example:

SYNC STARTED
operation=abc

UPLOAD MEDIA
media=123

SYNC SUCCESS
operation=abc

or:

SYNC FAILED
operation=abc
reason=timeout
retry_count=2

Do not log:

- passwords
- tokens/secrets
- unnecessary sensitive data

============================================================
39. TESTING
============================================================

Add tests for:

LOCAL DATABASE:

1. Task caching
2. Form schema caching
3. Draft persistence
4. Media persistence
5. Queue persistence

SYNC:

6. Queue insertion
7. Queue ordering
8. Successful sync
9. Failed sync
10. Retry
11. Retry limit
12. Resume after failure
13. Idempotent submission creation
14. Idempotent media upload
15. Duplicate prevention

OFFLINE:

16. Create draft offline
17. Update draft offline
18. Capture location offline
19. Capture media offline
20. App restart recovery

CONFLICTS:

21. Already submitted
22. Invalid claim
23. Server conflict
24. Authentication failure

REGRESSION:

All existing backend tests must remain passing.

Phase 1 acceptance must remain passing.

Phase 2 original acceptance must remain passing.

============================================================
40. END-TO-END ACCEPTANCE TEST
============================================================

Create:

scripts/demo_phase2_offline.py

or equivalent appropriate test mechanism.

Demonstrate:

1. Contributor logs in.
2. Contributor has a claimed task.
3. Task and schema are cached.
4. Network becomes unavailable.
5. Contributor opens task.
6. Contributor creates/loads draft.
7. Contributor captures location.
8. Contributor captures required images.
9. Contributor enters observations.
10. Contributor saves draft.
11. App restart is simulated.
12. Draft remains.
13. Network restored.
14. Sync begins.
15. Submission created on server.
16. Media uploaded.
17. Draft updated.
18. Submission finalized.
19. Server confirms submission.
20. Local sync state becomes synced.
21. Re-running sync does not create duplicates.

============================================================
41. WEB
============================================================

Do not significantly modify the web application in this phase.

Only make changes if necessary to expose useful sync/submission information.

Do not redesign the admin console.

============================================================
42. BACKEND
============================================================

Only modify FastAPI where required for:

- idempotency
- client-generated identifiers
- safe repeated requests
- synchronization compatibility

Do not rewrite submission logic.

Do not change business rules.

============================================================
43. AI
============================================================

No AI model implementation in this phase.

Do not implement:

MobileNetV3
MobileCLIP
pHash
DINOv2
LightGBM

The purpose of this phase is to create reliable evidence transport.

============================================================
44. ACCEPTANCE CRITERIA
============================================================

Phase 2 is complete only if:

OFFLINE FIELD WORK:

✓ Cached claimed task opens offline

✓ Cached form schema opens offline

✓ Submission draft works offline

✓ Observations work offline

✓ GPS data can be stored offline

✓ Images can be captured/stored offline

✓ App restart does not lose work

✓ Sync queue survives restart

✓ Network restoration triggers sync

✓ Failed operations retry safely

✓ Partial sync resumes

✓ Duplicate records are prevented

✓ Sync status is visible

✓ User can manually retry

SERVER:

✓ Idempotent submission creation

✓ Idempotent media attachment

✓ Final submission remains safe

✓ Existing Phase 1 behavior preserved

DATABASE:

✓ Local migrations work

✓ No data loss

TESTS:

✓ Existing backend tests pass

✓ Phase 1 acceptance passes

✓ Phase 2 acceptance passes

✓ New offline tests pass

MOBILE:

✓ TypeScript passes

✓ No runtime TypeScript errors

✓ Main offline workflow verified

============================================================
45. REQUIRED COMPLETION REPORT
============================================================

After implementation, report exactly:

### PHASE
Phase 2 — Offline-First Mobile

### STATUS
Completed / Partially Completed / Blocked

### OFFLINE ARCHITECTURE
- ...

### SQLITE CHANGES
- ...

### SYNC QUEUE
- ...

### SYNC ENGINE
- ...

### API CHANGES
- ...

### IDEMPOTENCY
- ...

### MEDIA OFFLINE STORAGE
- ...

### NETWORK HANDLING
- ...

### UI CHANGES
- ...

### FILES CREATED
- ...

### FILES MODIFIED
- ...

### DATABASE/MIGRATION CHANGES
- ...

### TESTS
- Backend: X/X
- Phase 1 acceptance: X/X
- Phase 2 acceptance: X/X
- Offline tests: X/X
- Web build: PASS/FAIL
- Mobile TypeScript: PASS/FAIL

### OFFLINE SCENARIOS VERIFIED
- Offline draft
- App restart
- Network recovery
- Partial sync
- Retry
- Duplicate prevention
- Conflict handling

### REGRESSIONS
- None
or
- ...

### KNOWN LIMITATIONS
- ...

### NEXT PHASE
Phase 3 — Field Collection UX

============================================================
FINAL INSTRUCTION
============================================================

Implement Phase 2 now.

First inspect the existing mobile SQLite and queue implementation.

Do not recreate it.

Complete the existing offline foundation.

Preserve all working functionality from Phase 0 and Phase 1.

Do not move automatically to Phase 3 after completion.

Do not claim completion unless the offline scenarios and tests have actually been verified.