import uuid
from datetime import datetime
from typing import Dict, Any, Optional
from sqlalchemy import ForeignKey, String, JSON, DateTime, func, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.base import Base, UUIDPrimaryKeyMixin, GUID


class SubmissionMedia(Base, UUIDPrimaryKeyMixin):
    """Georeferenced photo or sensor media attachment stored in S3/R2."""
    __tablename__ = "submission_media"

    submission_id: Mapped[uuid.UUID] = mapped_column(
        GUID(),
        ForeignKey("submissions.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    storage_key: Mapped[str] = mapped_column(String(512), nullable=False)
    media_type: Mapped[str] = mapped_column(String(64), nullable=False, default="image/jpeg")
    media_metadata: Mapped[Dict[str, Any]] = mapped_column("metadata", JSON, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # Relationships
    submission = relationship("Submission", back_populates="media")

    def __repr__(self) -> str:
        return f"<SubmissionMedia id={self.id} key={self.storage_key} type={self.media_type}>"
