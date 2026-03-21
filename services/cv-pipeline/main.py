"""CV Pipeline Service - FastAPI entry point.

Provides HTTP API for managing CV pipeline instances.
Each stream gets its own pipeline processor running in an async task.
"""

import asyncio
import logging
import os
from contextlib import asynccontextmanager
from typing import AsyncGenerator, Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from pipeline.config import pipeline_settings
from pipeline.processor import PipelineProcessor

logging.basicConfig(
    level=logging.DEBUG if pipeline_settings.DEBUG else logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# Store active pipeline processors
active_pipelines: dict[str, PipelineProcessor] = {}
pipeline_tasks: dict[str, asyncio.Task] = {}

# Shared model instances (loaded once, shared across pipelines)
_models_loaded = False


def _load_shared_models() -> None:
    """Pre-load models so they're ready when pipelines start."""
    global _models_loaded
    if _models_loaded:
        return

    logger.info("Pre-loading shared ML models...")
    # Models will be loaded per-pipeline on first use
    # This is a placeholder for future shared model pool
    _models_loaded = True
    logger.info("Model initialization complete")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifecycle."""
    logger.info("Starting CV Pipeline Service v%s", pipeline_settings.SERVICE_NAME)
    os.makedirs(pipeline_settings.FRAME_CAPTURE_DIR, exist_ok=True)
    os.makedirs(pipeline_settings.THUMBNAIL_DIR, exist_ok=True)
    _load_shared_models()
    yield
    # Shutdown: stop all active pipelines
    logger.info("Shutting down CV Pipeline Service")
    for stream_id in list(active_pipelines.keys()):
        await _stop_pipeline(stream_id)
    logger.info("All pipelines stopped")


app = FastAPI(
    title="VIOSINT CV Pipeline",
    version="0.1.0",
    lifespan=lifespan,
)


class StartPipelineRequest(BaseModel):
    stream_id: str
    source: str  # RTSP URL, file path, or WebRTC signaling URL
    processing_fps: int = 10
    detection_confidence: float = 0.5
    enable_tracking: bool = True
    enable_embedding: bool = True


class PipelineStatusResponse(BaseModel):
    stream_id: str
    is_running: bool
    frame_count: int = 0
    detection_count: int = 0
    current_fps: float = 0.0


@app.get("/health")
async def health() -> dict:
    return {
        "status": "healthy",
        "service": pipeline_settings.SERVICE_NAME,
        "active_pipelines": len(active_pipelines),
        "models_loaded": _models_loaded,
    }


@app.post("/pipeline/start", response_model=PipelineStatusResponse)
async def start_pipeline(request: StartPipelineRequest) -> PipelineStatusResponse:
    """Start a new CV pipeline for a video stream."""
    if request.stream_id in active_pipelines:
        raise HTTPException(
            status_code=409,
            detail=f"Pipeline already running for stream {request.stream_id}",
        )

    if len(active_pipelines) >= pipeline_settings.MAX_CONCURRENT_STREAMS:
        raise HTTPException(
            status_code=429,
            detail=f"Maximum concurrent streams ({pipeline_settings.MAX_CONCURRENT_STREAMS}) reached",
        )

    processor = PipelineProcessor(
        stream_id=request.stream_id,
        source=request.source,
        processing_fps=request.processing_fps,
        detection_confidence=request.detection_confidence,
        enable_tracking=request.enable_tracking,
        enable_embedding=request.enable_embedding,
    )

    # Load models
    processor.load_models()

    # Start processing in background task
    task = asyncio.create_task(_run_pipeline(request.stream_id, processor))
    active_pipelines[request.stream_id] = processor
    pipeline_tasks[request.stream_id] = task

    logger.info("Pipeline started for stream %s", request.stream_id)

    return PipelineStatusResponse(
        stream_id=request.stream_id,
        is_running=True,
    )


@app.post("/pipeline/{stream_id}/stop", response_model=PipelineStatusResponse)
async def stop_pipeline(stream_id: str) -> PipelineStatusResponse:
    """Stop a running pipeline."""
    if stream_id not in active_pipelines:
        raise HTTPException(
            status_code=404,
            detail=f"No active pipeline for stream {stream_id}",
        )

    processor = active_pipelines[stream_id]
    await _stop_pipeline(stream_id)

    return PipelineStatusResponse(
        stream_id=stream_id,
        is_running=False,
        frame_count=processor.frame_count,
        detection_count=processor.detection_count,
        current_fps=0.0,
    )


@app.get("/pipeline/{stream_id}/status", response_model=PipelineStatusResponse)
async def get_pipeline_status(stream_id: str) -> PipelineStatusResponse:
    """Get the status of a pipeline."""
    processor = active_pipelines.get(stream_id)
    if not processor:
        raise HTTPException(
            status_code=404,
            detail=f"No active pipeline for stream {stream_id}",
        )

    return PipelineStatusResponse(
        stream_id=stream_id,
        is_running=processor.is_running,
        frame_count=processor.frame_count,
        detection_count=processor.detection_count,
        current_fps=round(processor.current_fps, 2),
    )


@app.get("/pipeline/active")
async def list_active_pipelines() -> list[PipelineStatusResponse]:
    """List all active pipelines."""
    return [
        PipelineStatusResponse(
            stream_id=sid,
            is_running=p.is_running,
            frame_count=p.frame_count,
            detection_count=p.detection_count,
            current_fps=round(p.current_fps, 2),
        )
        for sid, p in active_pipelines.items()
    ]


async def _run_pipeline(stream_id: str, processor: PipelineProcessor) -> None:
    """Run a pipeline processor as an async task."""
    try:
        await processor.start()
    except Exception as e:
        logger.error("Pipeline crashed for stream %s: %s", stream_id, e)
    finally:
        # Clean up on completion
        if stream_id in active_pipelines:
            del active_pipelines[stream_id]
        if stream_id in pipeline_tasks:
            del pipeline_tasks[stream_id]


async def _stop_pipeline(stream_id: str) -> None:
    """Stop a pipeline and clean up."""
    processor = active_pipelines.get(stream_id)
    if processor:
        await processor.stop()

    task = pipeline_tasks.get(stream_id)
    if task and not task.done():
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass

    active_pipelines.pop(stream_id, None)
    pipeline_tasks.pop(stream_id, None)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=pipeline_settings.SERVICE_PORT,
        reload=pipeline_settings.DEBUG,
    )
