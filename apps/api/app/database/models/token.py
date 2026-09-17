import uuid
from datetime import datetime
from typing import Optional, List
from sqlalchemy import ForeignKey, Integer, String, DateTime, func, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.base import Base, UUIDPrimaryKeyMixin, TimestampMixin, GUID


class TokenAccount(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Server-authoritative token wallet associated with a contributor or reviewer account."""
    __tablename__ = "token_accounts"

    user_id: Mapped[uuid.UUID] = mapped_column(
        GUID(),
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        index=True,
        nullable=False,
    )
    available_balance: Mapped[int] = mapped_column(Integer, default=100, nullable=False)
    locked_balance: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Relationships
    user = relationship("User", back_populates="token_account")
    transactions = relationship("TokenTransaction", back_populates="account", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<TokenAccount id={self.id} user_id={self.user_id} available={self.available_balance} locked={self.locked_balance}>"


class TokenTransaction(Base, UUIDPrimaryKeyMixin):
    """Immutable, append-only ledger transaction recording internal token movements."""
    __tablename__ = "token_transactions"

    token_account_id: Mapped[uuid.UUID] = mapped_column(
        GUID(),
        ForeignKey("token_accounts.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    transaction_type: Mapped[str] = mapped_column(String(32), index=True, nullable=False)
    amount: Mapped[int] = mapped_column(Integer, nullable=False)
    reference_type: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    reference_id: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # Relationships
    account = relationship("TokenAccount", back_populates="transactions")

    __table_args__ = (
        Index("idx_transactions_account_type", "token_account_id", "transaction_type"),
    )

    def __repr__(self) -> str:
        return f"<TokenTransaction id={self.id} account_id={self.token_account_id} type={self.transaction_type} amount={self.amount}>"
