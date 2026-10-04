from contextlib import asynccontextmanager
from fastapi import FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.logging import setup_logging
from app.core.middleware import ObservabilityAndSecurityMiddleware
from app.api.router import api_router
from app.api.v1.health import liveness_check, readiness_check
from app.schemas.health import HealthResponse, ReadinessResponse
from app.database.session import check_db_connectivity
from app.database.init_db import init_database


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: configure logging and initialize database schema & seed data
    setup_logging()
    if not settings.is_production:
        init_database()
    yield


app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Authoritative backend API for the Horizon geospatial community contribution platform.",
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/docs" if not settings.is_production else None,
    redoc_url="/redoc" if not settings.is_production else None,
    openapi_url="/openapi.json" if not settings.is_production else None,
)

# 1. Observability, Latency & Security Headers Middleware
app.add_middleware(ObservabilityAndSecurityMiddleware)

# 2. CORS Configuration - hardened for production
cors_kwargs = {
    "allow_credentials": True,
    "allow_methods": ["*"],
    "allow_headers": ["*"],
}

if settings.is_production:
    cors_kwargs["allow_origins"] = settings.API_CORS_ORIGINS
else:
    cors_kwargs["allow_origins"] = settings.API_CORS_ORIGINS
    cors_kwargs["allow_origin_regex"] = r"^https?://.*$"

app.add_middleware(CORSMiddleware, **cors_kwargs)


# Top-level Health, Liveness, and Readiness endpoints
@app.get("/health", response_model=HealthResponse, tags=["Health"])
def root_health() -> HealthResponse:
    """Root health check providing quick status of the service and database."""
    db_connected = check_db_connectivity()
    return HealthResponse(
        status="ok" if db_connected else "degraded",
        service="horizon-api",
        environment=settings.ENVIRONMENT,
        version="0.1.0",
        database="connected" if db_connected else "disconnected",
    )


@app.get("/healthz", response_model=HealthResponse, tags=["Health"])
def root_liveness() -> HealthResponse:
    return liveness_check()


@app.get("/readyz", response_model=ReadinessResponse, tags=["Health"])
def root_readiness(response: Response) -> ReadinessResponse:
    return readiness_check(response)


# Mount versioned API router
app.include_router(api_router, prefix=settings.API_V1_STR)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=settings.API_HOST, port=settings.API_PORT, reload=True)
