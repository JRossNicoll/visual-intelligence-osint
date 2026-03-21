"""Seed/demo data management endpoints."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.services.seed_service import SeedService

router = APIRouter(prefix="/seed", tags=["seed"])


@router.post("/demo")
async def seed_demo_data(
    clear_existing: bool = True,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Generate realistic demo data for the platform.

    This populates the database with:
    - Camera streams (8 locations)
    - Entities (15 people + 10 vehicles)
    - Temporal events with realistic patterns
    - Alerts (anomalies, coordinated behavior, reappearances)
    - Cases with linked evidence, notes, and audit logs
    - Intelligence insights and behavior records
    - Entity profiles with risk scores

    Use `clear_existing=true` (default) to wipe and regenerate,
    or `false` to add on top of existing data.
    """
    summary = await SeedService.seed_demo_data(db, clear_existing=clear_existing)
    return {"status": "success", "message": "Demo data generated", "summary": summary}


@router.get("/status")
async def seed_status(db: AsyncSession = Depends(get_db)) -> dict:
    """Check whether the database has been seeded with demo data."""
    is_seeded = await SeedService.is_seeded(db)
    return {"is_seeded": is_seeded}


@router.delete("/demo")
async def clear_demo_data(db: AsyncSession = Depends(get_db)) -> dict:
    """Remove all demo data from the database."""
    await SeedService._clear_tables(db)
    return {"status": "success", "message": "All demo data cleared"}
