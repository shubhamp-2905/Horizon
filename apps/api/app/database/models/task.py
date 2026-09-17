from datetime import datetime
from typing import Optional, List, Dict, Any
from sqlalchemy import String, Text, Integer, Float, DateTime, Index, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from geoalchemy2 import Geometry
from app.database.base import Base, UUIDPrimaryKeyMixin, TimestampMixin


class Task(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Geospatial data collection task representing a targeted ground-truth collection gap."""
    __tablename__ = "tasks"

    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    artifact_type: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="draft", index=True, nullable=False)
    difficulty: Mapped[float] = mapped_column(Float, default=1.0, nullable=False)
    scarcity: Mapped[float] = mapped_column(Float, default=1.0, nullable=False)
    base_reward: Mapped[int] = mapped_column(Integer, default=50, nullable=False)
    commitment_stake: Mapped[int] = mapped_column(Integer, default=10, nullable=False)
    estimated_effort_minutes: Mapped[Optional[int]] = mapped_column(Integer, default=30, nullable=True)
    requirements: Mapped[Optional[List[str]]] = mapped_column(JSON, default=list, nullable=True)

    # Geospatial definition: PostGIS Point and optional Polygon boundary (SRID 4326: WGS84)
    location_point = mapped_column(
        Geometry(geometry_type="POINT", srid=4326),
        nullable=True,
    )
    geographic_area = mapped_column(
        Geometry(geometry_type="POLYGON", srid=4326),
        nullable=True,
    )

    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    form_schemas = relationship("TaskFormSchema", back_populates="task", cascade="all, delete-orphan")
    claims = relationship("TaskClaim", back_populates="task")
    submissions = relationship("Submission", back_populates="task")

    __table_args__ = (
        Index("idx_tasks_status_artifact", "status", "artifact_type"),
    )

    def __repr__(self) -> str:
        return f"<Task id={self.id} title={self.title} status={self.status} base_reward={self.base_reward}>"
