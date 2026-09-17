import logging
from typing import Generator
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, Session
from app.core.config import settings

logger = logging.getLogger(__name__)

engine_kwargs = {}
if settings.DATABASE_URL.startswith("sqlite"):
    engine_kwargs["connect_args"] = {"check_same_thread": False}
else:
    engine_kwargs["pool_size"] = settings.DATABASE_POOL_SIZE
    engine_kwargs["max_overflow"] = settings.DATABASE_MAX_OVERFLOW
    engine_kwargs["pool_pre_ping"] = True

engine = create_engine(settings.DATABASE_URL, **engine_kwargs)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Generator[Session, None, None]:
    """Dependency that yields an active database session and ensures cleanup."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def check_db_connectivity() -> bool:
    """Check whether the database is reachable."""
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        return True
    except Exception as exc:
        logger.warning(f"Database connectivity check failed: {exc}")
        return False
