import uuid
from datetime import datetime
from typing import Optional, Dict, Any, List
from sqlalchemy import ForeignKey, String, Text, Float, Integer, DateTime, JSON, UniqueConstraint, Index, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from geoalchemy2 import Geometry
from app.database.base import Base, UUIDPrimaryKeyMixin, GUID


class EtlPipelineRun(Base, UUIDPrimaryKeyMixin):
    """Tracks execution, metrics, status, and retry lineage for downstream ETL runs."""
    __tablename__ = "etl_pipeline_runs"

    pipeline_name: Mapped[str] = mapped_column(String(64), default="loupe_downstream_etl", nullable=False)
    dataset_version: Mapped[str] = mapped_column(String(32), index=True, nullable=False)
    run_type: Mapped[str] = mapped_column(String(32), default="incremental", nullable=False)  # incremental, full_refresh
    status: Mapped[str] = mapped_column(String(32), default="PENDING", index=True, nullable=False)  # PENDING, RUNNING, COMPLETED, FAILED, RETRYING

    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    records_extracted: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    records_transformed: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    records_loaded: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    records_skipped: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    records_failed: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    retry_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    max_retries: Mapped[int] = mapped_column(Integer, default=3, nullable=False)

    execution_metadata: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, default=dict, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # Relationships
    bronze_records = relationship("EtlBronzeRecord", back_populates="pipeline_run", cascade="all, delete-orphan")
    silver_records = relationship("EtlSilverRecord", back_populates="pipeline_run", cascade="all, delete-orphan")
    gold_observations = relationship("DownstreamObservation", back_populates="pipeline_run")
    artifacts = relationship("EtlDatasetArtifact", back_populates="pipeline_run", cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_etl_runs_version_status", "dataset_version", "status"),
    )

    def __repr__(self) -> str:
        return f"<EtlPipelineRun id={self.id} version={self.dataset_version} status={self.status} loaded={self.records_loaded}>"


class EtlBronzeRecord(Base, UUIDPrimaryKeyMixin):
    """Bronze Layer: Raw, immutable snapshot of extracted approved ground-truth submission."""
    __tablename__ = "etl_bronze_records"

    pipeline_run_id: Mapped[uuid.UUID] = mapped_column(
        GUID(),
        ForeignKey("etl_pipeline_runs.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    submission_id: Mapped[uuid.UUID] = mapped_column(
        GUID(),
        ForeignKey("submissions.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    raw_payload: Mapped[Dict[str, Any]] = mapped_column(JSON, nullable=False)
    extracted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    pipeline_run = relationship("EtlPipelineRun", back_populates="bronze_records")
    submission = relationship("Submission")

    def __repr__(self) -> str:
        return f"<EtlBronzeRecord id={self.id} run={self.pipeline_run_id} submission={self.submission_id}>"


class EtlSilverRecord(Base, UUIDPrimaryKeyMixin):
    """Silver Layer: Cleansed, validated, normalized, and scored observation record."""
    __tablename__ = "etl_silver_records"

    pipeline_run_id: Mapped[uuid.UUID] = mapped_column(
        GUID(),
        ForeignKey("etl_pipeline_runs.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    submission_id: Mapped[uuid.UUID] = mapped_column(
        GUID(),
        ForeignKey("submissions.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    validation_status: Mapped[str] = mapped_column(String(32), default="VALID", index=True, nullable=False)  # VALID, INVALID, ANOMALY
    cleaned_payload: Mapped[Dict[str, Any]] = mapped_column(JSON, nullable=False)
    quality_score: Mapped[float] = mapped_column(Float, default=1.0, nullable=False)
    transformed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    pipeline_run = relationship("EtlPipelineRun", back_populates="silver_records")
    submission = relationship("Submission")

    def __repr__(self) -> str:
        return f"<EtlSilverRecord id={self.id} status={self.validation_status} score={self.quality_score:.2f}>"


class DownstreamObservation(Base, UUIDPrimaryKeyMixin):
    """Gold Layer: Published canonical geospatial observation for downstream Loupe/GIS ingestion."""
    __tablename__ = "downstream_observations"

    pipeline_run_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        GUID(),
        ForeignKey("etl_pipeline_runs.id", ondelete="SET NULL"),
        index=True,
        nullable=True,
    )
    submission_id: Mapped[uuid.UUID] = mapped_column(
        GUID(),
        ForeignKey("submissions.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    task_id: Mapped[uuid.UUID] = mapped_column(
        GUID(),
        ForeignKey("tasks.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    dataset_version: Mapped[str] = mapped_column(String(32), index=True, nullable=False)
    artifact_type: Mapped[str] = mapped_column(String(64), index=True, nullable=False)

    # PostGIS Point location of verified observation
    location = mapped_column(
        Geometry(geometry_type="POINT", srid=4326),
        nullable=True,
    )
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    gps_accuracy: Mapped[float] = mapped_column(Float, default=5.0, nullable=False)

    captured_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    approved_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    canonical_data: Mapped[Dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)
    media_references: Mapped[List[Dict[str, Any]]] = mapped_column(JSON, nullable=False, default=list)
    quality_score: Mapped[float] = mapped_column(Float, default=1.0, nullable=False)
    provenance: Mapped[Dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # Relationships
    pipeline_run = relationship("EtlPipelineRun", back_populates="gold_observations")
    submission = relationship("Submission")
    task = relationship("Task")

    __table_args__ = (
        UniqueConstraint("submission_id", "dataset_version", name="uq_downstream_submission_version"),
        Index("idx_downstream_task_artifact", "task_id", "artifact_type"),
        Index("idx_downstream_version_score", "dataset_version", "quality_score"),
    )

    def __repr__(self) -> str:
        return f"<DownstreamObservation id={self.id} submission={self.submission_id} artifact={self.artifact_type}>"


class EtlDatasetArtifact(Base, UUIDPrimaryKeyMixin):
    """Persisted export artifact file for Loupe / GIS consumer downloads."""
    __tablename__ = "etl_dataset_artifacts"

    pipeline_run_id: Mapped[uuid.UUID] = mapped_column(
        GUID(),
        ForeignKey("etl_pipeline_runs.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    dataset_version: Mapped[str] = mapped_column(String(32), index=True, nullable=False)
    export_format: Mapped[str] = mapped_column(String(32), index=True, nullable=False)  # GEOJSON, JSON, CSV
    storage_path: Mapped[str] = mapped_column(String(512), nullable=False)
    file_size_bytes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    record_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    checksum_sha256: Mapped[str] = mapped_column(String(64), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    pipeline_run = relationship("EtlPipelineRun", back_populates="artifacts")

    __table_args__ = (
        Index("idx_artifacts_version_format", "dataset_version", "export_format"),
    )

    def __repr__(self) -> str:
        return f"<EtlDatasetArtifact id={self.id} format={self.export_format} records={self.record_count}>"
