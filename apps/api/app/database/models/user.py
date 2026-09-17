from typing import Optional, Dict, Any
from sqlalchemy import String, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.base import Base, UUIDPrimaryKeyMixin, TimestampMixin


class User(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Authoritative user record representing a platform contributor, reviewer, or admin."""
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    username: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    display_name: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="active", index=True, nullable=False)
    role: Mapped[str] = mapped_column(String(32), default="contributor", index=True, nullable=False)
    avatar_url: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    profile_data: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True, default=dict)

    # Relationships
    token_account = relationship("TokenAccount", back_populates="user", uselist=False, cascade="all, delete-orphan")
    reputation = relationship("Reputation", back_populates="user", uselist=False, cascade="all, delete-orphan")
    claims = relationship("TaskClaim", back_populates="user")
    submissions = relationship("Submission", back_populates="user")

    def __repr__(self) -> str:
        return f"<User id={self.id} username={self.username} status={self.status}>"
