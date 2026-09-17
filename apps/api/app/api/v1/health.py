from fastapi import APIRouter
from app.core.config import settings
from app.database.session import check_db_connectivity
from app.schemas.health import HealthResponse

router = APIRouter(tags=["Health"])


@router.get("/health", response_model=HealthResponse)
def get_v1_health() -> HealthResponse:
    """Return health status of the API, current environment, and database connectivity."""
    db_connected = check_db_connectivity()
    return HealthResponse(
        status="ok" if db_connected else "degraded",
        service="horizon-api",
        environment=settings.ENVIRONMENT,
        version="0.1.0",
        database="connected" if db_connected else "disconnected",
    )
