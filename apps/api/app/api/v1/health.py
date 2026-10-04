import os
import time
from datetime import datetime, timezone
from typing import Dict
import httpx
from fastapi import APIRouter, Response, status
from app.core.config import settings
from app.database.session import check_db_connectivity, engine
from app.schemas.health import HealthResponse, ReadinessResponse, SubsystemStatus
from sqlalchemy import text

router = APIRouter(tags=["Health & Observability"])


@router.get("/health", response_model=HealthResponse)
def get_v1_health() -> HealthResponse:
    """Basic health check providing quick status of the service and database."""
    db_connected = check_db_connectivity()
    return HealthResponse(
        status="ok" if db_connected else "degraded",
        service="horizon-api",
        environment=settings.ENVIRONMENT,
        version="0.1.0",
        database="connected" if db_connected else "disconnected",
    )


@router.get("/healthz", response_model=HealthResponse)
def liveness_check() -> HealthResponse:
    """Kubernetes / Cloud provider liveness probe."""
    return HealthResponse(
        status="ok",
        service="horizon-api",
        environment=settings.ENVIRONMENT,
        version="0.1.0",
        database="ok",
    )


@router.get("/readyz", response_model=ReadinessResponse)
def readiness_check(response: Response) -> ReadinessResponse:
    """
    Kubernetes / Cloud provider readiness probe.
    Tests database connectivity, AI microservice availability, and storage directory.
    Returns 503 if primary database is unreachable.
    """
    subsystems: Dict[str, SubsystemStatus] = {}
    is_ready = True

    # 1. Database Check
    db_start = time.perf_counter()
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        db_ms = round((time.perf_counter() - db_start) * 1000, 2)
        subsystems["database"] = SubsystemStatus(status="healthy", latency_ms=db_ms)
    except Exception as exc:
        db_ms = round((time.perf_counter() - db_start) * 1000, 2)
        subsystems["database"] = SubsystemStatus(status="unavailable", latency_ms=db_ms, details={"error": str(exc)})
        is_ready = False

    # 2. AI Service Check
    ai_start = time.perf_counter()
    try:
        url = f"{settings.AI_SERVICE_URL.rstrip('/')}/health"
        with httpx.Client(timeout=1.0) as client:
            resp = client.get(url)
            ai_ms = round((time.perf_counter() - ai_start) * 1000, 2)
            if resp.status_code == 200:
                subsystems["ai_service"] = SubsystemStatus(status="healthy", latency_ms=ai_ms)
            else:
                subsystems["ai_service"] = SubsystemStatus(
                    status="degraded",
                    latency_ms=ai_ms,
                    details={"http_status": resp.status_code},
                )
    except Exception as exc:
        ai_ms = round((time.perf_counter() - ai_start) * 1000, 2)
        subsystems["ai_service"] = SubsystemStatus(
            status="degraded",
            latency_ms=ai_ms,
            details={"fallback": "in_process_fallback_active", "notice": "AI microservice unreachable; fallback active"},
        )

    # 3. Storage Directory Check
    try:
        os.makedirs(settings.STORAGE_PERSISTENT_DIR, exist_ok=True)
        os.makedirs(settings.EXPORT_STORAGE_DIR, exist_ok=True)
        subsystems["storage"] = SubsystemStatus(
            status="healthy",
            details={
                "storage_dir": settings.STORAGE_PERSISTENT_DIR,
                "exports_dir": settings.EXPORT_STORAGE_DIR,
                "s3_bucket": settings.S3_BUCKET,
            },
        )
    except Exception as exc:
        subsystems["storage"] = SubsystemStatus(status="degraded", details={"error": str(exc)})

    if not is_ready:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE

    return ReadinessResponse(
        status="ready" if is_ready else "not_ready",
        service="horizon-api",
        version="0.1.0",
        environment=settings.ENVIRONMENT,
        timestamp=datetime.now(timezone.utc).isoformat(),
        subsystems=subsystems,
    )
