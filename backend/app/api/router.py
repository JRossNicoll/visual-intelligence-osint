"""API router aggregation."""

from fastapi import APIRouter

from app.api.endpoints import (
    alerts,
    auth,
    case_intel,
    cases,
    entities,
    health,
    intelligence,
    matching,
    operator,
    pipeline,
    seed,
    streams,
    targets,
    videos,
    websocket,
)

api_router = APIRouter()

# Include all endpoint routers
api_router.include_router(auth.router)
api_router.include_router(streams.router)
api_router.include_router(entities.router)
api_router.include_router(targets.router)
api_router.include_router(alerts.router)
api_router.include_router(pipeline.router)
api_router.include_router(intelligence.router)
api_router.include_router(operator.router)
api_router.include_router(cases.router)
api_router.include_router(videos.router)
api_router.include_router(matching.router)
api_router.include_router(case_intel.router)
api_router.include_router(seed.router)

# Health and WebSocket routes are mounted at root level
health_router = health.router
ws_router = websocket.router
