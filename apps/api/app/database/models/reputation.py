import uuid
from sqlalchemy import ForeignKey, Float
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.base import Base, UUIDPrimaryKeyMixin, TimestampMixin, GUID


class Reputation(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Contributor reputation score reflecting historical submission quality and verification consistency."""
    __tablename__ = "reputations"

    user_id: Mapped[uuid.UUID] = mapped_column(
        GUID(),
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        index=True,
        nullable=False,
    )
    score: Mapped[float] = mapped_column(Float, default=100.0, nullable=False)

    # Relationships
    user = relationship("User", back_populates="reputation")

    def __repr__(self) -> str:
        return f"<Reputation id={self.id} user_id={self.user_id} score={self.score}>"
