from fastapi import APIRouter
from app.api.v1 import health

api_router = APIRouter()

# Core system endpoints
api_router.include_router(health.router)

# Future domain module routers will be mounted here:
# api_router.include_router(users.router, prefix="/users", tags=["Users"])
# api_router.include_router(tasks.router, prefix="/tasks", tags=["Tasks"])
# api_router.include_router(submissions.router, prefix="/submissions", tags=["Submissions"])
# api_router.include_router(verification.router, prefix="/verification", tags=["Verification"])
# api_router.include_router(rewards.router, prefix="/rewards", tags=["Rewards"])
# api_router.include_router(tokens.router, prefix="/tokens", tags=["Tokens"])
# api_router.include_router(reputation.router, prefix="/reputation", tags=["Reputation"])
# api_router.include_router(media.router, prefix="/media", tags=["Media"])
