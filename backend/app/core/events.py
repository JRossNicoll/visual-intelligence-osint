"""Application lifecycle events."""

import logging
import os
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI

from app.core.config import settings

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Handle application startup and shutdown events."""
    # Startup
    logger.info("Starting VIOSINT Backend v%s", settings.APP_VERSION)

    # Ensure upload directories exist
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    os.makedirs(settings.FRAME_CAPTURE_DIR, exist_ok=True)

    # Initialize database tables
    from app.db.session import engine
    from app.models import base  # noqa: F401

    async with engine.begin() as conn:
        from app.models.base import Base

        await conn.run_sync(Base.metadata.create_all)

    logger.info("Database tables initialized")

    # Initialize Redis connection pool
    from app.db.redis import redis_manager

    await redis_manager.connect()
    logger.info("Redis connected")

    # Initialize Neo4j driver
    from app.db.neo4j import neo4j_manager

    await neo4j_manager.connect()
    logger.info("Neo4j connected")

    yield

    # Shutdown
    logger.info("Shutting down VIOSINT Backend")
    await redis_manager.disconnect()
    await neo4j_manager.disconnect()
    from app.db.session import engine

    await engine.dispose()
    logger.info("All connections closed")
