from fastapi import APIRouter
from app.api.v1 import health
from app.modules.auth.router import router as auth_router
from app.modules.tokens.router import router as tokens_router
from app.modules.tasks.router import router as tasks_router
from app.modules.admin.router import router as admin_router
from app.modules.submissions.router import router as submissions_router
from app.modules.validation.router import router as validation_router

api_router = APIRouter()

# Health & System
api_router.include_router(health.router)

# Authentication & Contributor Identity
api_router.include_router(auth_router)

# Wallet & Tokens
api_router.include_router(tokens_router)

# Tasks & Geospatial Discovery
api_router.include_router(tasks_router)

# Admin Task Management
api_router.include_router(admin_router)

# Field Submissions & Review
api_router.include_router(submissions_router)

# Phase 4: Automated Data Validation
api_router.include_router(validation_router)
