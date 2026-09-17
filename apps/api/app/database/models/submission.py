import uuid
from datetime import datetime
from typing import Optional, Dict, Any, List
from sqlalchemy import ForeignKey, String, Float, DateTime, JSON, func, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from geoalchemy2 import Geometry
from app.database.base import Base, UUIDPrimaryKeyMixin, GUID


class Submission(Base, UUIDPrimaryKeyMixin):
    """Ground-truth geospatial observation submitted by a contributor."""
    __tablename__ = "submissions"

    task_id: Mapped[uuid.UUID] = mapped_column(
        GUID(),
        ForeignKey("tasks.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        GUID(),
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )

    # PostGIS Point location of capture
    location = mapped_column(
        Geometry(geometry_type="POINT", srid=4326),
        nullable=True,
    )
    gps_accuracy: Mapped[float] = mapped_column(Float, nullable=False, default=5.0)

    captured_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    submitted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    status: Mapped[str] = mapped_column(String(32), default="submitted", index=True, nullable=False)
    form_data: Mapped[Dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)

    # Relationships
    task = relationship("Task", back_populates="submissions")
    user = relationship("User", back_populates="submissions")
    media = relationship("SubmissionMedia", back_populates="submission", cascade="all, delete-orphan")
    verification = relationship("Verification", back_populates="submission", uselist=False, cascade="all, delete-orphan")
    reward = relationship("Reward", back_populates="submission", uselist=False, cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_submissions_task_status", "task_id", "status"),
        Index("idx_submissions_user_status", "user_id", "status"),
    )

    def __repr__(self) -> str:
        return f"<Submission id={self.id} task_id={self.task_id} status={self.status}>"
