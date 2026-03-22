"""Stream management API endpoints."""

import os
import uuid
from typing import Optional

import aiofiles
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import TokenData, get_current_user
from app.db.session import get_db
from app.schemas.stream import (
    StreamCreate,
    StreamResponse,
    StreamStartRequest,
    StreamStatusResponse,
    StreamUpdate,
)
from app.services.stream_service import StreamService

router = APIRouter(prefix="/streams", tags=["streams"])


@router.post("", response_model=StreamResponse, status_code=201)
async def create_stream(
    data: StreamCreate,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
) -> StreamResponse:
    """Create a new video stream source."""
    stream = await StreamService.create_stream(db, data)
    return StreamResponse.model_validate(stream)


@router.get("", response_model=list[StreamResponse])
async def list_streams(
    status: Optional[str] = Query(None),
    source_type: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
) -> list[StreamResponse]:
    """List all streams with optional filtering."""
    streams = await StreamService.list_streams(db, status, source_type, limit, offset)
    return [StreamResponse.model_validate(s) for s in streams]


@router.get("/{stream_id}", response_model=StreamResponse)
async def get_stream(
    stream_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
) -> StreamResponse:
    """Get a specific stream by ID."""
    stream = await StreamService.get_stream(db, stream_id)
    if not stream:
        raise HTTPException(status_code=404, detail="Stream not found")
    return StreamResponse.model_validate(stream)


@router.patch("/{stream_id}", response_model=StreamResponse)
async def update_stream(
    stream_id: str,
    data: StreamUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
) -> StreamResponse:
    """Update a stream."""
    stream = await StreamService.update_stream(db, stream_id, data)
    if not stream:
        raise HTTPException(status_code=404, detail="Stream not found")
    return StreamResponse.model_validate(stream)


@router.delete("/{stream_id}", status_code=204)
async def delete_stream(
    stream_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
) -> None:
    """Delete a stream."""
    deleted = await StreamService.delete_stream(db, stream_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Stream not found")


@router.post("/{stream_id}/start", response_model=StreamResponse)
async def start_stream(
    stream_id: str,
    config: Optional[StreamStartRequest] = None,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
) -> StreamResponse:
    """Start processing a stream."""
    stream = await StreamService.start_stream(db, stream_id)
    if not stream:
        raise HTTPException(status_code=404, detail="Stream not found")
    return StreamResponse.model_validate(stream)


@router.post("/{stream_id}/stop", response_model=StreamResponse)
async def stop_stream(
    stream_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
) -> StreamResponse:
    """Stop processing a stream."""
    stream = await StreamService.stop_stream(db, stream_id)
    if not stream:
        raise HTTPException(status_code=404, detail="Stream not found")
    return StreamResponse.model_validate(stream)


@router.get("/{stream_id}/status", response_model=StreamStatusResponse)
async def get_stream_status(
    stream_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
) -> StreamStatusResponse:
    """Get real-time stream processing status."""
    stream = await StreamService.get_stream(db, stream_id)
    if not stream:
        raise HTTPException(status_code=404, detail="Stream not found")

    status = await StreamService.get_stream_status(stream_id)
    if status:
        return StreamStatusResponse(
            stream_id=stream_id,
            status=status.get("status", stream.status),
            current_fps=status.get("current_fps"),
            frames_processed=status.get("frames_processed", 0),
            detections_count=status.get("detections_count", 0),
            active_tracks=status.get("active_tracks", 0),
        )

    return StreamStatusResponse(
        stream_id=stream_id,
        status=stream.status,
        frames_processed=stream.total_frames_processed,
        detections_count=stream.total_detections,
    )


@router.post("/{stream_id}/upload", response_model=StreamResponse)
async def upload_video(
    stream_id: str,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
) -> StreamResponse:
    """Upload a video file for processing."""
    stream = await StreamService.get_stream(db, stream_id)
    if not stream:
        raise HTTPException(status_code=404, detail="Stream not found")

    if stream.source_type != "file":
        raise HTTPException(
            status_code=400,
            detail="Stream source type must be 'file' for uploads",
        )

    # Validate file type
    allowed_types = {"video/mp4", "video/avi", "video/x-msvideo", "video/quicktime", "video/webm"}
    if file.content_type and file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {file.content_type}",
        )

    # Save file
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    file_ext = os.path.splitext(file.filename or "video.mp4")[1]
    filename = f"{uuid.uuid4()}{file_ext}"
    file_path = os.path.join(settings.UPLOAD_DIR, filename)

    async with aiofiles.open(file_path, "wb") as f:
        content = await file.read()
        await f.write(content)

    stream.file_path = file_path
    stream.status = "ready"
    await db.flush()
    await db.refresh(stream)

    return StreamResponse.model_validate(stream)
