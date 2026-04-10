from __future__ import annotations

import os
from contextlib import contextmanager
from pathlib import Path

from sqlalchemy import create_engine, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import settings


class Base(DeclarativeBase):
    pass


_engine = None
_session_factory = None
_resolved_database_url = None
_initialized = False


def _default_sqlite_url() -> str:
    db_path = Path(__file__).resolve().parents[2] / "data" / "pdf_converter.db"
    return f"sqlite:///{db_path.as_posix()}"


def _pick_database_url() -> str:
    if os.getenv("PYTEST_CURRENT_TEST"):
        return _default_sqlite_url()
    return settings.database_url


def get_engine():
    global _engine, _resolved_database_url
    if _engine is not None:
        return _engine

    import logging
    logger = logging.getLogger(__name__)

    primary_url = _pick_database_url()
    is_test = bool(os.getenv("PYTEST_CURRENT_TEST"))
    connect_args = {"check_same_thread": False} if primary_url.startswith("sqlite") else {"connect_timeout": 10}

    safe_url = primary_url.split("@")[-1] if "@" in primary_url else "database"
    logger.info(f"⏳ Attempting to connect to database at {safe_url} with 10s timeout...")

    try:
        engine = create_engine(primary_url, future=True, pool_pre_ping=True, connect_args=connect_args, echo_pool=True)
        with engine.connect() as connection:
            logger.info("⏳ Executing test query (SELECT 1)...")
            connection.execute(text("SELECT 1"))
            logger.info("✅ Database connection and test query successful!")
        _engine = engine
        _resolved_database_url = primary_url
        return _engine
    except (SQLAlchemyError, Exception) as e:
        logger.error(f"❌ Primary DB connection failed: {e}")
        if is_test:
            fallback_url = _default_sqlite_url()
            logger.warning(f"Falling back to SQLite at {fallback_url}")
            connect_args = {"check_same_thread": False}
            _engine = create_engine(fallback_url, future=True, pool_pre_ping=True, connect_args=connect_args)
            _resolved_database_url = fallback_url
            return _engine
        # Fail fast in production so the orchestrator (Railway) restarts the container
        raise


def get_resolved_database_url() -> str:
    get_engine()
    return _resolved_database_url or _default_sqlite_url()


def get_session_factory():
    global _session_factory
    if _session_factory is None:
        _session_factory = sessionmaker(bind=get_engine(), autoflush=False, autocommit=False, future=True)
    init_database()
    return _session_factory


@contextmanager
def db_session() -> Session:
    session = get_session_factory()()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def init_database() -> None:
    global _initialized
    if _initialized:
        return

    Base.metadata.create_all(bind=get_engine())
    _initialized = True
