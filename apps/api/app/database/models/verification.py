import uuid
from typing import Optional
from sqlalchemy import ForeignKey, String, Text, Float, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.base import Base, UUIDPrimaryKeyMixin, TimestampMixin, GUID


class Verification(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Multi-stage validation and verification record for a contributor submission."""
    __tablename__ = "verifications"

    submission_id: Mapped[uuid.UUID] = mapped_column(
        GUID(),
        ForeignKey("submissions.id", ondelete="CASCADE"),
        unique=True,
        index=True,
        nullable=False,
    )
    status: Mapped[str] = mapped_column(String(32), default="pending", index=True, nullable=False)
    reviewer_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        GUID(),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    ai_confidence_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # Relationships
    submission = relationship("Submission", back_populates="verification")
    reviewer = relationship("User", foreign_keys=[reviewer_id])

    __table_args__ = (
        Index("idx_verifications_status_reviewer", "status", "reviewer_id"),
    )

    def __repr__(self) -> str:
        return f"<Verification id={self.id} submission_id={self.submission_id} status={self.status}>"
