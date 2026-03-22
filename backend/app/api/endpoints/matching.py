"""Cross-video identity matching API endpoints."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import TokenData, get_current_user
from app.db.session import get_db
from app.services.case_service import AuditService
from app.services.matching_service import MatchingService

router = APIRouter(prefix="/matching", tags=["matching"])


class MatchReviewRequest(BaseModel):
    decision: str  # "accepted" or "rejected"


@router.get("/cases/{case_id}/pending")
async def get_pending_matches(
    case_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
) -> list[dict]:
    """Get all pending identity matches for a case."""
    return await MatchingService.get_pending_matches(db, case_id)


@router.post("/cases/{case_id}/run")
async def run_matching(
    case_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
) -> dict:
    """Manually trigger identity matching for a case."""
    result = await MatchingService.run_matching_for_case(db, case_id)
    await AuditService.log(
        db, actor=current_user.username, role=current_user.role,
        action="matching_triggered", resource_type="case",
        resource_id=case_id,
        detail=f"Auto-merged: {result['auto_merged']}, Pending: {result['pending_matches_created']}",
    )
    return result


@router.post("/{match_id}/review")
async def review_match(
    match_id: str,
    body: MatchReviewRequest,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
) -> dict:
    """Accept or reject a pending identity match."""
    if body.decision not in ("accepted", "rejected"):
        raise HTTPException(status_code=400, detail="Decision must be 'accepted' or 'rejected'")

    result = await MatchingService.review_match(
        db, match_id, decision=body.decision, reviewed_by=current_user.username,
    )
    if not result:
        raise HTTPException(status_code=404, detail="Match not found")

    await AuditService.log(
        db, actor=current_user.username, role=current_user.role,
        action=f"match_{body.decision}", resource_type="pending_match",
        resource_id=match_id,
        detail=f"Match {body.decision} (sim={result['similarity_score']:.3f})",
    )
    return result


@router.get("/cases/{case_id}/stats")
async def get_match_stats(
    case_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
) -> dict:
    """Get matching statistics for a case."""
    return await MatchingService.get_match_stats(db, case_id)
