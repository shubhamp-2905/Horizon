import os
import uuid
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query, Header, Response
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.database.session import get_db
from app.core.config import settings
from app.core.security import get_current_user, ALGORITHM
from app.core.rate_limit import rate_limit
from app.database.models.pipeline import (
    EtlPipelineRun,
    EtlDatasetArtifact,
    DownstreamObservation,
)
from app.modules.pipeline.schemas import (
    PipelineRunTriggerRequest,
    PipelineRunResponse,
    PipelineRunListResponse,
    DatasetArtifactResponse,
    DatasetSummaryResponse,
    DownstreamObservationResponse,
    LoupeSyncRequest,
    LoupeSyncResponse,
)
from app.modules.pipeline.service import (
    trigger_pipeline_run,
    retry_pipeline_run,
    sync_to_loupe_pipeline,
    get_dataset_summaries,
)

router = APIRouter(prefix="/pipeline", tags=["Downstream Pipeline & Loupe Integration"])


def verify_pipeline_auth(
    authorization: Optional[str] = Header(None),
    x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
    x_loupe_api_key: Optional[str] = Header(None, alias="X-Loupe-API-Key"),
    db: Session = Depends(get_db),
):
    """
    Dual Authentication Gate for Downstream Data Pipeline:
    1. External Loupe Systems: Validates API Key via 'X-API-Key' or 'X-Loupe-API-Key'
    2. Internal Horizon Admin: Validates JWT Bearer Token with 'admin' role
    """
    # 1. API Key Auth (External Loupe Service)
    client_key = x_loupe_api_key or x_api_key
    if client_key and settings.LOUPE_API_KEY:
        if client_key == settings.LOUPE_API_KEY:
            return {"auth_type": "api_key", "client": "loupe_downstream_service"}

    # 2. Bearer JWT Auth (Admin User)
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ")[1]
        from jose import jwt, JWTError
        try:
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
            user_id = payload.get("sub")
            role = payload.get("role")
            if user_id and role == "admin":
                return {"auth_type": "jwt", "user_id": user_id, "role": role}
        except JWTError:
            pass

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail={
            "code": "UNAUTHORIZED_PIPELINE_ACCESS",
            "message": "Valid admin bearer token or X-Loupe-API-Key header required for pipeline access",
        },
    )


@router.post(
    "/runs",
    response_model=PipelineRunResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(rate_limit(max_requests=10, window_seconds=60))],
)
def run_pipeline(
    payload: PipelineRunTriggerRequest,
    auth: dict = Depends(verify_pipeline_auth),
    db: Session = Depends(get_db),
):
    """
    Trigger an ETL pipeline execution to extract approved submissions,
    transform them into canonical format, load into Gold layer, and package GeoJSON/JSON/CSV artifacts.
    """
    pipeline_run = trigger_pipeline_run(db, payload)
    return pipeline_run


@router.get("/runs", response_model=PipelineRunListResponse)
def list_pipeline_runs(
    dataset_version: Optional[str] = Query(None, description="Filter by dataset version"),
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by run status"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    auth: dict = Depends(verify_pipeline_auth),
    db: Session = Depends(get_db),
):
    """List historical pipeline executions and performance metrics."""
    query = db.query(EtlPipelineRun)
    if dataset_version:
        query = query.filter(EtlPipelineRun.dataset_version == dataset_version)
    if status_filter:
        query = query.filter(EtlPipelineRun.status == status_filter)

    query = query.order_by(desc(EtlPipelineRun.created_at))
    total = query.count()
    runs = query.offset((page - 1) * page_size).limit(page_size).all()
    return PipelineRunListResponse(runs=runs, total=total)


@router.get("/runs/{run_id}", response_model=PipelineRunResponse)
def get_pipeline_run_details(
    run_id: uuid.UUID,
    auth: dict = Depends(verify_pipeline_auth),
    db: Session = Depends(get_db),
):
    """Get detailed status, counters, errors, and artifacts for a specific pipeline run."""
    run = db.query(EtlPipelineRun).filter(EtlPipelineRun.id == run_id).first()
    if not run:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "RUN_NOT_FOUND", "message": f"Pipeline run {run_id} not found"},
        )
    return run


@router.post("/runs/{run_id}/retry", response_model=PipelineRunResponse)
def retry_failed_run(
    run_id: uuid.UUID,
    auth: dict = Depends(verify_pipeline_auth),
    db: Session = Depends(get_db),
):
    """Retry a failed ETL pipeline execution."""
    return retry_pipeline_run(db, run_id)


@router.get("/datasets", response_model=List[DatasetSummaryResponse])
def list_published_datasets(
    auth: dict = Depends(verify_pipeline_auth),
    db: Session = Depends(get_db),
):
    """List all canonical dataset versions published for Loupe with feature counts and quality scores."""
    summaries = get_dataset_summaries(db)
    return summaries


@router.get("/datasets/{version}/export")
def export_dataset_file(
    version: str,
    format: str = Query("geojson", description="Format: geojson, json, or csv"),
    auth: dict = Depends(verify_pipeline_auth),
    db: Session = Depends(get_db),
):
    """
    Download a published dataset artifact in GeoJSON, JSON, or CSV format.
    Provides immutable SHA-256 verified ground-truth exports for downstream Loupe analytics.
    """
    export_fmt = format.upper().strip()
    if export_fmt not in ["GEOJSON", "JSON", "CSV"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "INVALID_FORMAT", "message": "Format must be geojson, json, or csv"},
        )

    artifact = (
        db.query(EtlDatasetArtifact)
        .filter(
            EtlDatasetArtifact.dataset_version == version,
            EtlDatasetArtifact.export_format == export_fmt,
        )
        .order_by(EtlDatasetArtifact.created_at.desc())
        .first()
    )

    if not artifact or not os.path.exists(artifact.storage_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "ARTIFACT_NOT_FOUND",
                "message": f"Dataset artifact for version '{version}' in '{format}' format not found on disk",
            },
        )

    media_types = {
        "GEOJSON": "application/geo+json",
        "JSON": "application/json",
        "CSV": "text/csv",
    }

    filename = os.path.basename(artifact.storage_path)
    response = FileResponse(
        path=artifact.storage_path,
        media_type=media_types.get(export_fmt, "application/octet-stream"),
        filename=filename,
    )
    response.headers["X-Checksum-SHA256"] = artifact.checksum_sha256
    response.headers["X-Record-Count"] = str(artifact.record_count)
    return response


@router.post("/datasets/{version}/sync-loupe", response_model=LoupeSyncResponse)
def sync_dataset_to_loupe(
    version: str,
    payload: LoupeSyncRequest,
    auth: dict = Depends(verify_pipeline_auth),
    db: Session = Depends(get_db),
):
    """
    Publish/sync dataset manifest and delivery notification to downstream Loupe ingestion pipeline.
    """
    return sync_to_loupe_pipeline(db, version, payload)


@router.get("/observations", response_model=List[DownstreamObservationResponse])
def query_downstream_observations(
    dataset_version: Optional[str] = Query(None, description="Dataset version filter"),
    artifact_type: Optional[str] = Query(None, description="Artifact type filter"),
    min_quality: Optional[float] = Query(None, ge=0.0, le=1.0, description="Minimum quality score"),
    limit: int = Query(50, ge=1, le=500),
    auth: dict = Depends(verify_pipeline_auth),
    db: Session = Depends(get_db),
):
    """Direct programmatic access to published Gold layer observations."""
    query = db.query(DownstreamObservation)
    if dataset_version:
        query = query.filter(DownstreamObservation.dataset_version == dataset_version)
    if artifact_type:
        query = query.filter(DownstreamObservation.artifact_type == artifact_type)
    if min_quality is not None:
        query = query.filter(DownstreamObservation.quality_score >= min_quality)

    query = query.order_by(desc(DownstreamObservation.created_at)).limit(limit)
    return query.all()
