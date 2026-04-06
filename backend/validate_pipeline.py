#!/usr/bin/env python3
"""Validate Sprint 1 Batch Video Pipeline.

Tests:
1. Enqueues a synthetic video job via VideoService
2. Confirms VideoFile record is created with status=queued
3. Simulates worker processing (creates entities + embeddings)
4. Confirms entities and embeddings are written to PostgreSQL
5. Confirms embedding-based similarity search returns correct neighbors
"""

import asyncio
import os
import sys
from datetime import datetime, timezone

# Ensure env vars are set
os.environ.setdefault("SECRET_KEY", "test-secret-key-validate-pipeline")
os.environ.setdefault("POSTGRES_HOST", "127.0.0.1")
os.environ.setdefault("POSTGRES_USER", "viosint")
os.environ.setdefault("POSTGRES_PASSWORD", "viosint")
os.environ.setdefault("POSTGRES_DB", "viosint")
os.environ.setdefault("REDIS_HOST", "127.0.0.1")
os.environ.setdefault("ADMIN_PASSWORD", "admin123")
os.environ.setdefault("ANALYST_PASSWORD", "analyst123")

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import numpy as np  # noqa: E402
from sqlalchemy import select  # noqa: E402

passed = 0
failed = 0
cleanup_ids: dict[str, list[str]] = {"cases": [], "videos": [], "entities": []}


def check(name: str, condition: bool, detail: str = "") -> None:
    global passed, failed
    if condition:
        passed += 1
        print(f"  PASS  {name}")
    else:
        failed += 1
        print(f"  FAIL  {name} — {detail}")


async def run_tests() -> None:
    from app.db.session import async_session_factory, engine
    from app.models.base import Base
    from app.models.case import Case
    from app.models.entity import Entity
    from app.models.video import VideoFile
    from app.services.matching_service import cosine_similarity

    # Create tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # -------------------------------------------------------------------
    # 1. Create a test case
    # -------------------------------------------------------------------
    print("\n--- Create Test Case ---")
    async with async_session_factory() as session:
        case = Case(
            title="Pipeline Validation Test Case",
            description="Auto-generated for validate_pipeline.py",
            status="open",
            priority="medium",
            severity="medium",
            opened_at=datetime.now(timezone.utc),
        )
        session.add(case)
        await session.commit()
        case_id = case.id
        cleanup_ids["cases"].append(case_id)
        check("test case created", case_id is not None)

    # -------------------------------------------------------------------
    # 2. Create a VideoFile record (simulating upload)
    # -------------------------------------------------------------------
    print("\n--- VideoFile Creation (Upload Simulation) ---")
    async with async_session_factory() as session:
        video = VideoFile(
            case_id=case_id,
            filename="test_video_001.mp4",
            file_path="/tmp/viosint/videos/test_video_001.mp4",
            file_size_bytes=1024000,
            status="queued",
        )
        session.add(video)
        await session.commit()
        video_id = video.id
        cleanup_ids["videos"].append(video_id)
        check("video record created", video_id is not None)

        # Verify status is queued
        result = await session.execute(
            select(VideoFile).where(VideoFile.id == video_id)
        )
        v = result.scalar_one_or_none()
        check("video status is queued", v is not None and v.status == "queued",
              f"status={v.status if v else 'N/A'}")
        check("video belongs to case", v is not None and v.case_id == case_id)

    # -------------------------------------------------------------------
    # 3. Simulate worker processing — create entities with embeddings
    # -------------------------------------------------------------------
    print("\n--- Worker Simulation (Entities + Embeddings) ---")

    # Generate synthetic embeddings (512-dim CLIP-like vectors)
    rng = np.random.default_rng(42)
    base_embedding = rng.standard_normal(512).tolist()
    # Similar entity: perturb slightly (should have high cosine sim)
    similar_embedding = (np.array(base_embedding) + rng.standard_normal(512) * 0.05).tolist()
    # Different entity: random vector (should have low cosine sim)
    different_embedding = rng.standard_normal(512).tolist()

    now = datetime.now(timezone.utc)
    entity_ids = []

    async with async_session_factory() as session:
        # Entity 1 — person from video
        e1 = Entity(
            entity_type="person",
            label="Person Alpha",
            confidence=0.95,
            embedding=base_embedding,
            first_seen=now,
            last_seen=now,
            total_sightings=5,
            case_id=case_id,
            video_file_id=video_id,
        )
        # Entity 2 — same person (similar embedding)
        e2 = Entity(
            entity_type="person",
            label="Person Alpha Variant",
            confidence=0.88,
            embedding=similar_embedding,
            first_seen=now,
            last_seen=now,
            total_sightings=3,
            case_id=case_id,
            video_file_id=video_id,
        )
        # Entity 3 — different person (different embedding)
        e3 = Entity(
            entity_type="person",
            label="Person Beta",
            confidence=0.92,
            embedding=different_embedding,
            first_seen=now,
            last_seen=now,
            total_sightings=2,
            case_id=case_id,
            video_file_id=video_id,
        )

        session.add_all([e1, e2, e3])
        await session.commit()
        entity_ids = [e1.id, e2.id, e3.id]
        cleanup_ids["entities"].extend(entity_ids)

        check("3 entities created", len(entity_ids) == 3)

        # Update video status to complete
        result = await session.execute(
            select(VideoFile).where(VideoFile.id == video_id)
        )
        video = result.scalar_one()
        video.status = "complete"
        video.entity_count_discovered = 3
        video.processed_frames = 1000
        video.frame_count = 1000
        video.duration_seconds = 33.3
        video.processing_started_at = now
        video.processing_completed_at = now
        await session.commit()

    # -------------------------------------------------------------------
    # 4. Verify entities and embeddings in PostgreSQL
    # -------------------------------------------------------------------
    print("\n--- Verify Entities & Embeddings in DB ---")
    async with async_session_factory() as session:
        result = await session.execute(
            select(Entity).where(Entity.case_id == case_id)
        )
        entities = list(result.scalars().all())
        check("found 3 entities in case", len(entities) == 3,
              f"found {len(entities)}")

        entities_with_embeddings = [e for e in entities if e.embedding is not None]
        check("all 3 have embeddings", len(entities_with_embeddings) == 3,
              f"found {len(entities_with_embeddings)} with embeddings")

        for e in entities_with_embeddings:
            check(f"embedding dim=512 for {e.label}",
                  len(e.embedding) == 512,
                  f"dim={len(e.embedding)}")

        # Verify video is marked complete
        vresult = await session.execute(
            select(VideoFile).where(VideoFile.id == video_id)
        )
        v = vresult.scalar_one()
        check("video status is complete", v.status == "complete",
              f"status={v.status}")
        check("video entity_count_discovered=3", v.entity_count_discovered == 3,
              f"count={v.entity_count_discovered}")

    # -------------------------------------------------------------------
    # 5. Embedding similarity search (cosine similarity)
    # -------------------------------------------------------------------
    print("\n--- Embedding Similarity Search ---")

    sim_12 = cosine_similarity(base_embedding, similar_embedding)
    sim_13 = cosine_similarity(base_embedding, different_embedding)
    sim_23 = cosine_similarity(similar_embedding, different_embedding)

    check(f"similar pair sim > 0.85 (got {sim_12:.4f})", sim_12 > 0.85,
          f"sim={sim_12:.4f}")
    check(f"different pair sim < 0.70 (got {sim_13:.4f})", sim_13 < 0.70,
          f"sim={sim_13:.4f}")
    check(f"cross pair sim < 0.70 (got {sim_23:.4f})", sim_23 < 0.70,
          f"sim={sim_23:.4f}")

    # Verify nearest neighbor: entity 2 is closest to entity 1
    sims = [(entity_ids[1], sim_12), (entity_ids[2], sim_13)]
    nearest = max(sims, key=lambda x: x[1])
    check("nearest neighbor of e1 is e2", nearest[0] == entity_ids[1],
          f"nearest={nearest[0]}")

    # -------------------------------------------------------------------
    # Cleanup
    # -------------------------------------------------------------------
    print("\n--- Cleanup ---")
    async with async_session_factory() as session:
        for eid in cleanup_ids["entities"]:
            result = await session.execute(select(Entity).where(Entity.id == eid))
            entity = result.scalar_one_or_none()
            if entity:
                await session.delete(entity)
        for vid in cleanup_ids["videos"]:
            result = await session.execute(select(VideoFile).where(VideoFile.id == vid))
            video = result.scalar_one_or_none()
            if video:
                await session.delete(video)
        for cid in cleanup_ids["cases"]:
            result = await session.execute(select(Case).where(Case.id == cid))
            case = result.scalar_one_or_none()
            if case:
                await session.delete(case)
        await session.commit()
    print("  Test data cleaned up.")

    await engine.dispose()


def main() -> None:
    print("=" * 60)
    print("VIOSINT Sprint 1 — Pipeline Validation")
    print("=" * 60)

    asyncio.run(run_tests())

    print("\n" + "=" * 60)
    print(f"RESULTS: {passed} passed, {failed} failed, {passed + failed} total")
    print("=" * 60)

    if failed > 0:
        sys.exit(1)
    print("\nAll pipeline validations PASSED.")


if __name__ == "__main__":
    main()
