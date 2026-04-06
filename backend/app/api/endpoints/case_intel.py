"""Case intelligence API endpoints — cached analysis results."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import TokenData, get_current_user
from app.db.session import get_db
from app.services.case_intelligence_service import CaseIntelligenceService
from app.services.case_service import AuditService

router = APIRouter(prefix="/case-intelligence", tags=["case-intelligence"])


@router.get("/{case_id}")
async def get_case_intelligence(
    case_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
) -> dict:
    """Get cached intelligence results for a case."""
    result = await CaseIntelligenceService.get_case_intelligence(db, case_id)
    if not result:
        raise HTTPException(status_code=404, detail="No intelligence data for this case")
    return result


@router.post("/{case_id}/generate")
async def generate_case_intelligence(
    case_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
) -> dict:
    """Manually trigger intelligence analysis for a case."""
    result = await CaseIntelligenceService.generate_case_intelligence(db, case_id)
    await AuditService.log(
        db, actor=current_user.username, role=current_user.role,
        action="intelligence_generated", resource_type="case",
        resource_id=case_id,
        detail=f"Generated intelligence: {result.get('entity_count', 0)} entities, {result.get('pattern_count', 0)} patterns",
    )
    return result
