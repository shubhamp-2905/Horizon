# API Documentation

## API Overview
Base URL: `/api/v1`

### Endpoints Overview

| Module | Route | Method | Description |
| :--- | :--- | :--- | :--- |
| **Auth** | `/auth/login` | POST | Authenticate user & issue JWT |
| **Tasks** | `/tasks/nearby` | GET | Query tasks within bounding box / radius |
| **Tasks** | `/tasks/:id/commit` | POST | Reserve task for execution |
| **Submissions** | `/submissions` | POST | Submit observation records & media keys |
| **Media** | `/media/presign-upload` | POST | Get direct presigned S3 upload URL |
| **Verification** | `/verification/:id/vote` | POST | Reviewer consensus submission |
| **Tokens** | `/tokens/balance` | GET | Fetch authenticated contributor balance |
| **Tokens** | `/tokens/transactions` | GET | Paginated ledger transaction history |
