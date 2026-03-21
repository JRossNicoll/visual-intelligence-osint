"""Health check endpoints."""

from fastapi import APIRouter

from app.core.config import settings
from app.db.neo4j import neo4j_manager
from app.db.redis import redis_manager

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
