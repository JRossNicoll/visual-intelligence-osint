"""Video file management API endpoints — upload, list, status."""

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import TokenData, get_current_user
from app.db.session import get_db
from app.services.case_service import AuditService
from app.services.video_service import VideoService

router = APIRouter(prefix="/videos", tags=["videos"])


@router.post("/cases/{case_id}/upload")
async def upload_video(
    case_id: str,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
) -> dict:
    """Upload a video file to a case for batch processing."""
    # Validate file type
    allowed_types = {
        "video/mp4", "video/avi", "video/x-msvideo",
        "video/quicktime", "video/webm",
    }
    if file.content_type and file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {file.content_type}",
        )

    content = await file.read()
    result = await VideoService.upload_video(
        db,
        case_id=case_id,
        filename=file.filename or "video.mp4",
        file_content=content,
    )
    if not result:
        raise HTTPException(status_code=404, detail="Case not found")

    await AuditService.log(
        db, actor=current_user.username, role=current_user.role,
        action="video_uploaded", resource_type="video",
        resource_id=result["id"],
        detail=f"Uploaded {file.filename} to case {case_id}",
    )
    return result


@router.get("/cases/{case_id}")
async def list_case_videos(
    case_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
) -> list[dict]:
    """Get all videos for a case."""
    return await VideoService.get_case_videos(db, case_id)


@router.get("/{video_id}")
async def get_video(
    video_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
) -> dict:
    """Get a single video by ID."""
    result = await VideoService.get_video(db, video_id)
    if not result:
        raise HTTPException(status_code=404, detail="Video not found")
    return result


@router.get("/cases/{case_id}/completion")
async def check_case_completion(
    case_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
) -> dict:
    """Check if all videos in a case are processed."""
    return await VideoService.check_case_completion(db, case_id)
