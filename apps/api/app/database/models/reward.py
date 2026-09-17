import uuid
from datetime import datetime
from sqlalchemy import ForeignKey, String, Float, Integer, DateTime, func, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.base import Base, UUIDPrimaryKeyMixin, GUID


class Reward(Base, UUIDPrimaryKeyMixin):
    """Authoritative reward assessment derived from verification outcomes and data quality factors."""
    __tablename__ = "rewards"

    submission_id: Mapped[uuid.UUID] = mapped_column(
        GUID(),
        ForeignKey("submissions.id", ondelete="CASCADE"),
        unique=True,
        index=True,
        nullable=False,
    )
    base_value: Mapped[float] = mapped_column(Float, nullable=False, default=50.0)
    difficulty_factor: Mapped[float] = mapped_column(Float, nullable=False, default=1.0)
    scarcity_factor: Mapped[float] = mapped_column(Float, nullable=False, default=1.0)
    quality_factor: Mapped[float] = mapped_column(Float, nullable=False, default=1.0)
    calculated_reward: Mapped[int] = mapped_column(Integer, nullable=False, default=50)
    status: Mapped[str] = mapped_column(String(32), default="pending", index=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # Relationships
    submission = relationship("Submission", back_populates="reward")

    def __repr__(self) -> str:
        return f"<Reward id={self.id} submission_id={self.submission_id} amount={self.calculated_reward} status={self.status}>"
