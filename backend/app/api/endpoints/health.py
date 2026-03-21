"""Health check endpoints."""

from fastapi import APIRouter, Depends
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.neo4j import neo4j_manager
from app.db.redis import redis_manager
from app.db.session import get_db
from app.models.alert import Alert
from app.models.case import Case
from app.models.entity import Entity
from app.models.intelligence import TemporalEvent
from app.models.stream import Stream

router = APIRouter(tags=["health"])


@router.get("/health")
async def health_check() -> dict:
    """Basic health check."""
    return {
        "status": "healthy",
        "version": settings.APP_VERSION,
        "service": settings.APP_NAME,
    }


@router.get("/health/detailed")
async def detailed_health_check() -> dict:
    """Detailed health check including all dependencies."""
    redis_ok = False
    if redis_manager.client:
        try:
            await redis_manager.client.ping()
            redis_ok = True
        except Exception:
            pass

    neo4j_ok = False
    if neo4j_manager.driver:
        try:
            async with neo4j_manager.driver.session() as session:
                await session.run("RETURN 1")
            neo4j_ok = True
        except Exception:
            pass

    return {
        "status": "healthy" if redis_ok and neo4j_ok else "degraded",
        "version": settings.APP_VERSION,
        "service": settings.APP_NAME,
        "dependencies": {
            "redis": "connected" if redis_ok else "disconnected",
            "neo4j": "connected" if neo4j_ok else "disconnected",
        },
    }


@router.get("/health/status")
async def platform_status(db: AsyncSession = Depends(get_db)) -> dict:
    """Full platform status dashboard.

    Returns health of every dependency plus data-layer statistics
    so operators can verify the system is running correctly.
    """
    # --- Database ---
    db_ok = False
    try:
        await db.execute(text("SELECT 1"))
        db_ok = True
    except Exception:
        pass

    # --- Redis ---
    redis_ok = False
    redis_info: dict = {}
    if redis_manager.client:
        try:
            await redis_manager.client.ping()
            redis_ok = True
            info = await redis_manager.client.info("memory")
            redis_info = {
                "used_memory_human": info.get("used_memory_human", "unknown"),
            }
        except Exception:
            pass

    # --- Neo4j ---
    neo4j_ok = False
    if neo4j_manager.driver:
        try:
            async with neo4j_manager.driver.session() as session:
                await session.run("RETURN 1")
            neo4j_ok = True
        except Exception:
            pass

    # --- Data statistics ---
    entity_count = (await db.execute(select(func.count()).select_from(Entity))).scalar() or 0
    stream_count = (await db.execute(select(func.count()).select_from(Stream))).scalar() or 0
    alert_count = (await db.execute(select(func.count()).select_from(Alert))).scalar() or 0
    event_count = (await db.execute(select(func.count()).select_from(TemporalEvent))).scalar() or 0
    case_count = (await db.execute(select(func.count()).select_from(Case))).scalar() or 0

    active_streams = (
        await db.execute(
            select(func.count()).select_from(Stream).where(Stream.status == "active")
        )
    ).scalar() or 0

    unread_alerts = (
        await db.execute(
            select(func.count()).select_from(Alert).where(Alert.is_read.is_(False))
        )
    ).scalar() or 0

    overall = "healthy"
    if not db_ok:
        overall = "unhealthy"
    elif not redis_ok:
        overall = "degraded"

    return {
        "status": overall,
        "version": settings.APP_VERSION,
        "service": settings.APP_NAME,
        "demo_mode": settings.DEMO_MODE,
        "services": {
            "database": {"status": "connected" if db_ok else "disconnected"},
            "redis": {
                "status": "connected" if redis_ok else "disconnected",
                **redis_info,
            },
            "neo4j": {"status": "connected" if neo4j_ok else "disconnected"},
        },
        "data": {
            "entities": entity_count,
            "streams": stream_count,
            "active_streams": active_streams,
            "alerts": alert_count,
            "unread_alerts": unread_alerts,
            "events": event_count,
            "cases": case_count,
        },
    }
