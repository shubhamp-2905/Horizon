import uuid
from datetime import datetime
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field, ConfigDict


class PipelineRunTriggerRequest(BaseModel):
    """Payload to trigger an ETL pipeline run for Loupe downstream data publishing."""
    dataset_version: Optional[str] = Field(default=None, description="Semantic dataset version, e.g. v1.0.0. Defaults to current system default.")
    run_type: str = Field(default="incremental", description="Run mode: 'incremental' (newly approved only) or 'full_refresh' (all approved)")
    artifact_type: Optional[str] = Field(default=None, description="Optional filter to only process submissions for a specific artifact type")


class DatasetArtifactResponse(BaseModel):
    """Metadata and checksum for an exported dataset file."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    pipeline_run_id: uuid.UUID
    dataset_version: str
    export_format: str
    storage_path: str
    file_size_bytes: int
    record_count: int
    checksum_sha256: str
    created_at: datetime
    download_url: Optional[str] = None


class PipelineRunResponse(BaseModel):
    """Execution status, performance metrics, and artifact references for a pipeline run."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    pipeline_name: str
    dataset_version: str
    run_type: str
    status: str
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    records_extracted: int
    records_transformed: int
    records_loaded: int
    records_skipped: int
    records_failed: int
    error_message: Optional[str] = None
    retry_count: int
    max_retries: int
    execution_metadata: Optional[Dict[str, Any]] = None
    created_at: datetime
    artifacts: List[DatasetArtifactResponse] = Field(default_factory=list)


class PipelineRunListResponse(BaseModel):
    runs: List[PipelineRunResponse]
    total: int


class DatasetSummaryResponse(BaseModel):
    """Overview of a published dataset version ready for Loupe consumption."""
    dataset_version: str
    total_observations: int
    artifact_types: Dict[str, int]
    avg_quality_score: float
    latest_pipeline_run_id: Optional[uuid.UUID] = None
    last_updated_at: Optional[datetime] = None
    available_formats: List[str]


class DownstreamObservationResponse(BaseModel):
    """Canonical Gold-layer observation model."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    submission_id: uuid.UUID
    task_id: uuid.UUID
    dataset_version: str
    artifact_type: str
    latitude: float
    longitude: float
    gps_accuracy: float
    captured_at: datetime
    approved_at: datetime
    canonical_data: Dict[str, Any]
    media_references: List[Dict[str, Any]]
    quality_score: float
    provenance: Dict[str, Any]
    created_at: datetime


class LoupeSyncRequest(BaseModel):
    target_endpoint: Optional[str] = Field(default=None, description="Optional custom downstream webhook URL")
    dry_run: bool = Field(default=False, description="When true, validates payload without network dispatch")


class LoupeSyncResponse(BaseModel):
    dataset_version: str
    record_count: int
    endpoint: str
    status: str
    dispatch_mode: str
    delivered_at: datetime
    checksum_sha256: str
    details: Dict[str, Any] = Field(default_factory=dict)
