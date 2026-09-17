import uuid
from datetime import datetime
from typing import Dict, Any
from sqlalchemy import ForeignKey, Integer, JSON, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.base import Base, UUIDPrimaryKeyMixin, GUID


class TaskFormSchema(Base, UUIDPrimaryKeyMixin):
    """Declarative JSON schema defining the required structured form fields for a task."""
    __tablename__ = "task_form_schemas"

    task_id: Mapped[uuid.UUID] = mapped_column(
        GUID(),
        ForeignKey("tasks.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    schema_definition: Mapped[Dict[str, Any]] = mapped_column(JSON, nullable=False)
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # Relationships
    task = relationship("Task", back_populates="form_schemas")

    def __repr__(self) -> str:
        return f"<TaskFormSchema id={self.id} task_id={self.task_id} version={self.version}>"
