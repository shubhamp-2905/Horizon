import uuid
from datetime import datetime, timezone
from sqlalchemy import DateTime, func
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy.types import TypeDecorator, CHAR
from sqlalchemy.ext.compiler import compiles
from geoalchemy2 import Geometry


@compiles(Geometry, "sqlite")
def compile_geometry_sqlite(type_, compiler, **kw):
    return "BLOB"


class GUID(TypeDecorator):
    """Platform-independent GUID type.
    Uses PostgreSQL's UUID type, otherwise uses CHAR(36), storing as stringified hex values.
    """
    impl = CHAR
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":
            return dialect.type_descriptor(PG_UUID(as_uuid=True))
        return dialect.type_descriptor(CHAR(36))

    def process_bind_param(self, value, dialect):
        if value is None:
            return value
        if dialect.name == "postgresql":
            return str(value)
        if isinstance(value, uuid.UUID):
            return str(value)
        return str(uuid.UUID(str(value)))

    def process_result_value(self, value, dialect):
        if value is None:
            return value
        if isinstance(value, uuid.UUID):
            return value
        return uuid.UUID(str(value))


class Base(DeclarativeBase):
    """Base declarative class for all Horizon entities."""
    pass


class TimestampMixin:
    """Provides automatic audit timestamps for entities."""
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


class UUIDPrimaryKeyMixin:
    """Provides standard UUID primary key."""
    id: Mapped[uuid.UUID] = mapped_column(
        GUID(),
        primary_key=True,
        default=uuid.uuid4,
        nullable=False,
    )
