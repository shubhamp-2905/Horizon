import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import ForeignKey, Integer, String, DateTime, func, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.base import Base, UUIDPrimaryKeyMixin, GUID


class TaskClaim(Base, UUIDPrimaryKeyMixin):
    """Contributor commitment and staking reservation for a specific task window."""
    __tablename__ = "task_claims"

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
    stake_amount: Mapped[int] = mapped_column(Integer, default=10, nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="claimed", index=True, nullable=False)
    claimed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    task = relationship("Task", back_populates="claims")
    user = relationship("User", back_populates="claims")

    __table_args__ = (
        Index("idx_claims_task_user_status", "task_id", "user_id", "status"),
    )

    def __repr__(self) -> str:
        return f"<TaskClaim id={self.id} task_id={self.task_id} user_id={self.user_id} status={self.status}>"
