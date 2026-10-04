import uuid
from datetime import datetime
from typing import Optional, Dict, Any, List
from sqlalchemy import ForeignKey, String, Text, Float, Integer, DateTime, JSON, UniqueConstraint, Index, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.base import Base, UUIDPrimaryKeyMixin, GUID


class PeerReviewAssignment(Base, UUIDPrimaryKeyMixin):
    """Assignment record linking a designated reviewer to a submitted contribution."""
    __tablename__ = "peer_review_assignments"

    submission_id: Mapped[uuid.UUID] = mapped_column(
        GUID(),
        ForeignKey("submissions.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    reviewer_id: Mapped[uuid.UUID] = mapped_column(
        GUID(),
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    status: Mapped[str] = mapped_column(String(32), default="assigned", index=True, nullable=False)
    assigned_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    submission = relationship("Submission", back_populates="peer_assignments")
    reviewer = relationship("User", foreign_keys=[reviewer_id])

    __table_args__ = (
        UniqueConstraint("submission_id", "reviewer_id", name="uq_peer_assignment_submission_reviewer"),
        Index("idx_peer_assignment_reviewer_status", "reviewer_id", "status"),
    )

    def __repr__(self) -> str:
        return f"<PeerReviewAssignment id={self.id} submission={self.submission_id} reviewer={self.reviewer_id} status={self.status}>"


class PeerReview(Base, UUIDPrimaryKeyMixin):
    """Individual peer verification decision and inspection vote."""
    __tablename__ = "peer_reviews"

    submission_id: Mapped[uuid.UUID] = mapped_column(
        GUID(),
        ForeignKey("submissions.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    reviewer_id: Mapped[uuid.UUID] = mapped_column(
        GUID(),
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    decision: Mapped[str] = mapped_column(String(32), index=True, nullable=False)  # APPROVE, REJECT, FLAG
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    evidence_references: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True, default=dict)
    confidence_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # Relationships
    submission = relationship("Submission", back_populates="peer_reviews")
    reviewer = relationship("User", foreign_keys=[reviewer_id])

    __table_args__ = (
        UniqueConstraint("submission_id", "reviewer_id", name="uq_peer_review_submission_reviewer"),
        Index("idx_peer_review_submission_decision", "submission_id", "decision"),
    )

    def __repr__(self) -> str:
        return f"<PeerReview id={self.id} submission={self.submission_id} reviewer={self.reviewer_id} decision={self.decision}>"


class ConsensusRecord(Base, UUIDPrimaryKeyMixin):
    """Authoritative quorum, vote accounting, consensus state, and settlement tracking."""
    __tablename__ = "consensus_records"

    submission_id: Mapped[uuid.UUID] = mapped_column(
        GUID(),
        ForeignKey("submissions.id", ondelete="CASCADE"),
        unique=True,
        index=True,
        nullable=False,
    )
    status: Mapped[str] = mapped_column(String(32), default="PENDING", index=True, nullable=False)  # PENDING, APPROVED, REJECTED, DISPUTED
    pool_size: Mapped[int] = mapped_column(Integer, default=3, nullable=False)
    quorum: Mapped[int] = mapped_column(Integer, default=2, nullable=False)
    approval_threshold: Mapped[float] = mapped_column(Float, default=0.5, nullable=False)
    rejection_threshold: Mapped[float] = mapped_column(Float, default=0.5, nullable=False)

    total_votes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    approve_votes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    reject_votes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    flag_votes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    settlement_status: Mapped[str] = mapped_column(String(32), default="unsettled", index=True, nullable=False)  # unsettled, settled, disputed
    settled_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Dispute fields
    dispute_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    disputed_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        GUID(),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    disputed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    resolution_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    resolved_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        GUID(),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    consensus_metadata: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True, default=dict)

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
    submission = relationship("Submission", back_populates="consensus_record")
    disputer = relationship("User", foreign_keys=[disputed_by])
    resolver = relationship("User", foreign_keys=[resolved_by])

    __table_args__ = (
        Index("idx_consensus_status_settlement", "status", "settlement_status"),
    )

    def __repr__(self) -> str:
        return f"<ConsensusRecord id={self.id} submission={self.submission_id} status={self.status} votes={self.total_votes}/{self.quorum}>"
