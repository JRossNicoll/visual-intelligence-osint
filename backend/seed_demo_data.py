#!/usr/bin/env python3
"""CLI script to seed the database with demo data.

Usage:
    # From backend directory (local dev):
    poetry run python seed_demo_data.py

    # From Docker:
    docker compose exec backend python seed_demo_data.py

    # Clear existing data first (default):
    poetry run python seed_demo_data.py --clear

    # Add on top of existing data:
    poetry run python seed_demo_data.py --no-clear
"""

import argparse
import asyncio
import logging
import sys

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("seed")


async def main(clear: bool = True) -> None:
    # Import after logging is configured so the app picks up our settings
    from app.db.session import async_session_factory, engine
    from app.models.base import Base
    from app.services.seed_service import SeedService

    # Ensure tables exist
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session_factory() as db:
        try:
            summary = await SeedService.seed_demo_data(db, clear_existing=clear)
            await db.commit()
            logger.info("=" * 60)
            logger.info("DEMO DATA SEEDED SUCCESSFULLY")
            logger.info("=" * 60)
            for key, value in summary.items():
                logger.info("  %-20s %s", key, value)
            logger.info("=" * 60)
        except Exception:
            await db.rollback()
            logger.exception("Seeding failed")
            sys.exit(1)

    await engine.dispose()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed VIOSINT database with demo data")
    parser.add_argument(
        "--no-clear",
        action="store_true",
        help="Add data on top of existing records (default: clear first)",
    )
    parser.add_argument(
        "--clear",
        action="store_true",
        default=True,
        help="Clear existing data before seeding (default)",
    )
    args = parser.parse_args()

    asyncio.run(main(clear=not args.no_clear))
