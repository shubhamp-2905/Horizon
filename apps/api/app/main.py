from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.logging import setup_logging
from app.api.router import api_router
from app.schemas.health import HealthResponse
from app.database.session import check_db_connectivity
from app.database.init_db import init_database


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: configure logging and initialize database schema & seed data
    setup_logging()
    init_database()
    yield
    # Shutdown logic if needed


app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Authoritative backend API for the Horizon geospatial community contribution platform.",
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

# CORS Configuration - permit localhost and LAN origins for Expo physical devices
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.API_CORS_ORIGINS,
    allow_origin_regex=r"^https?://.*$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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


# Mount versioned API router
app.include_router(api_router, prefix=settings.API_V1_STR)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=settings.API_HOST, port=settings.API_PORT, reload=True)
