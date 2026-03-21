"""API router aggregation."""

from fastapi import APIRouter

from app.api.endpoints import (
    alerts,
    entities,
    health,
    intelligence,
    operator,
    pipeline,
    streams,
    targets,
    websocket,
)

api_router = APIRouter()

# Include all endpoint routers
api_router.include_router(streams.router)
api_router.include_router(entities.router)
api_router.include_router(targets.router)
api_router.include_router(alerts.router)
api_router.include_router(pipeline.router)
api_router.include_router(intelligence.router)
api_router.include_router(operator.router)

# Health and WebSocket routes are mounted at root level
health_router = health.router
ws_router = websocket.router
