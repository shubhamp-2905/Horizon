import logging
from typing import Generator
from contextlib import contextmanager
from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import sessionmaker, Session
from app.core.config import settings

logger = logging.getLogger(__name__)

# Disable GeoAlchemy2 SQLite hooks if running on SQLite
try:
    from geoalchemy2.admin.dialects import sqlite as geo_sqlite
    geo_sqlite.after_create = lambda table, bind, **kw: None
    geo_sqlite.before_create = lambda table, bind, **kw: None
    geo_sqlite.before_drop = lambda table, bind, **kw: None
    geo_sqlite.after_drop = lambda table, bind, **kw: None
except ImportError:
    pass


def _mock_as_ewkb(x):
    if x is None:
        return None
    if isinstance(x, (bytes, memoryview)):
        return bytes(x)
    if isinstance(x, str):
        try:
            import shapely.wkt
            import shapely.wkb
            srid = 4326
            text_val = x
            if text_val.startswith("SRID="):
                parts = text_val.split(";", 1)
                try:
                    srid = int(parts[0].replace("SRID=", ""))
                except Exception:
                    pass
                text_val = parts[1]
            geom = shapely.wkt.loads(text_val)
            return shapely.wkb.dumps(geom, srid=srid)
        except Exception:
            return x
    return x


def register_sqlite_spatial_functions(dbapi_connection, connection_record):
    """Register spatial functions so SQLite can execute GeoAlchemy2 queries."""
    dbapi_connection.create_function("GeomFromEWKT", 1, lambda x: x)
    dbapi_connection.create_function("GeomFromText", 1, lambda x: x)
    dbapi_connection.create_function("GeomFromEWKB", 1, lambda x: x)
    dbapi_connection.create_function("GeomFromWKB", 1, lambda x: x)
    dbapi_connection.create_function("AsEWKT", 1, lambda x: str(x))
    dbapi_connection.create_function("AsText", 1, lambda x: str(x))
    dbapi_connection.create_function("AsEWKB", 1, _mock_as_ewkb)
    dbapi_connection.create_function("AsBinary", 1, _mock_as_ewkb)
    dbapi_connection.create_function("RecoverGeometryColumn", 5, lambda a, b, c, d, e: 1)
    dbapi_connection.create_function("DiscardGeometryColumn", 2, lambda a, b: 1)


def create_db_engine():
    db_url = settings.DATABASE_URL
    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)
    is_sqlite = db_url.startswith("sqlite")

    if is_sqlite and settings.is_production:
        raise RuntimeError(
            "SQLite database is strictly forbidden in production/staging mode. "
            "A persistent PostgreSQL database must be configured via DATABASE_URL."
        )

    # If Postgres is configured, attempt connection probe
    if not is_sqlite:
        candidates = [db_url]
        if "wlelfechiyxzfxjhkvmy" in db_url and "pooler" not in db_url:
            pooler_url = "postgresql://postgres.wlelfechiyxzfxjhkvmy:%23xH7sJ%26J!hzyUdv@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres?sslmode=require"
            candidates.insert(0, pooler_url)
            candidates.append(pooler_url.replace(":5432/", ":6543/"))

        if db_url.startswith("postgresql://"):
            candidates.append(db_url.replace("postgresql://", "postgresql+psycopg2://", 1))
            candidates.append(db_url.replace("postgresql://", "postgresql+psycopg://", 1))

        connect_args = {"connect_timeout": 5}
        if "supabase" in db_url or "render" in db_url or settings.is_production:
            connect_args["sslmode"] = "require"

        for candidate_url in candidates:
            try:
                test_engine = create_engine(
                    candidate_url,
                    pool_pre_ping=True,
                    pool_size=settings.DATABASE_POOL_SIZE,
                    max_overflow=settings.DATABASE_MAX_OVERFLOW,
                    pool_recycle=settings.DATABASE_POOL_RECYCLE,
                    connect_args=connect_args,
                )
                with test_engine.connect() as conn:
                    conn.execute(text("SELECT 1"))
                logger.info(f"Successfully connected to primary PostgreSQL database using {candidate_url.split('@')[-1]}.")
                return test_engine
            except Exception as exc:
                logger.warning(f"Connection attempt to {candidate_url.split('@')[-1]} failed: {exc}")

        if settings.is_production:
            raise RuntimeError(
                "Production database connection failure: could not connect to PostgreSQL. "
                "Silent fallback to SQLite is strictly disabled in production mode."
            )

        # If immediate ping failed during local development, fallback to SQLite
        logger.warning(
            "All PostgreSQL connection attempts failed. Falling back to local SQLite database for development."
        )
        db_url = "sqlite:///./horizon_dev.db"
        is_sqlite = True

    engine_kwargs = {"connect_args": {"check_same_thread": False}}
    eng = create_engine(db_url, **engine_kwargs)
    event.listen(eng, "connect", register_sqlite_spatial_functions)
    return eng


engine = create_db_engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@contextmanager
def transactional_session(db: Session) -> Generator[Session, None, None]:
    """Execute a block within an atomic transaction with automatic rollback on error."""
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise


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

