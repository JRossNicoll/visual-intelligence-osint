"""Target definition API endpoints."""

import os
import uuid
from typing import Optional

import aiofiles
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.session import get_db
from app.schemas.target import TargetCreate, TargetResponse, TargetUpdate
from app.services.target_service import TargetService

router = APIRouter(prefix="/targets", tags=["targets"])


@router.post("", response_model=TargetResponse, status_code=201)
async def create_target(
    data: TargetCreate,
    db: AsyncSession = Depends(get_db),
) -> TargetResponse:
    """Create a new intelligence target definition.

    Examples:
      - "white Toyota Hilux"
      - "person wearing red hoodie"
      - "black SUV with roof racks"
    """
    target = await TargetService.create_target(db, data)
    return TargetResponse.model_validate(target)


@router.get("", response_model=list[TargetResponse])
async def list_targets(
    is_active: Optional[bool] = Query(None),
    target_type: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
) -> list[TargetResponse]:
    """List all targets with optional filtering."""
    targets = await TargetService.list_targets(db, is_active, target_type, limit, offset)
    return [TargetResponse.model_validate(t) for t in targets]


@router.get("/{target_id}", response_model=TargetResponse)
async def get_target(
    target_id: str,
    db: AsyncSession = Depends(get_db),
) -> TargetResponse:
    """Get a specific target by ID."""
    target = await TargetService.get_target(db, target_id)
    if not target:
        raise HTTPException(status_code=404, detail="Target not found")
    return TargetResponse.model_validate(target)


@router.patch("/{target_id}", response_model=TargetResponse)
async def update_target(
    target_id: str,
    data: TargetUpdate,
    db: AsyncSession = Depends(get_db),
) -> TargetResponse:
    """Update a target definition."""
    target = await TargetService.update_target(db, target_id, data)
    if not target:
        raise HTTPException(status_code=404, detail="Target not found")
    return TargetResponse.model_validate(target)


@router.delete("/{target_id}", status_code=204)
async def delete_target(
    target_id: str,
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete a target."""
    deleted = await TargetService.delete_target(db, target_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Target not found")


@router.post("/{target_id}/reference-image", response_model=TargetResponse)
async def upload_reference_image(
    target_id: str,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
) -> TargetResponse:
    """Upload a reference image for a target."""
    target = await TargetService.get_target(db, target_id)
    if not target:
        raise HTTPException(status_code=404, detail="Target not found")

    # Validate file type
    allowed_types = {"image/jpeg", "image/png", "image/webp"}
    if file.content_type and file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported image type: {file.content_type}",
        )

    # Save file
    ref_dir = os.path.join(settings.UPLOAD_DIR, "reference_images")
    os.makedirs(ref_dir, exist_ok=True)
    file_ext = os.path.splitext(file.filename or "image.jpg")[1]
    filename = f"{uuid.uuid4()}{file_ext}"
    file_path = os.path.join(ref_dir, filename)

    async with aiofiles.open(file_path, "wb") as f:
        content = await file.read()
        await f.write(content)

    target.reference_image_path = file_path
    await db.flush()
    await db.refresh(target)

    return TargetResponse.model_validate(target)
