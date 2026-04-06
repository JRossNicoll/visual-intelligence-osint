#!/usr/bin/env python3
"""Validate Sprint 1 Cross-Video Identity Matching.

Tests:
1. Inserts entities with known embeddings into a test case
   - Pair A-B: cosine similarity ~0.88 (should auto-merge)
   - Pair A-C: cosine similarity ~0.75 (should create pending_match)
   - Pair A-D: cosine similarity ~0.45 (should treat as distinct)
2. Runs matching via MatchingService
3. Confirms pending_match created for the 0.75-similarity pair
4. Confirms the dissimilar pair (0.45) does NOT generate a pending_match
5. Confirms the high-similarity pair (0.88) is auto-merged
"""

import asyncio
import os
import sys
from datetime import datetime, timezone

# Ensure env vars are set
os.environ.setdefault("SECRET_KEY", "test-secret-key-validate-matching")
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


def check(name: str, condition: bool, detail: str = "") -> None:
    global passed, failed
    if condition:
        passed += 1
        print(f"  PASS  {name}")
    else:
        failed += 1
        print(f"  FAIL  {name} — {detail}")


def make_embedding_with_similarity(base: np.ndarray, target_sim: float, rng: np.random.Generator) -> list[float]:
    """Create a unit embedding with exact cosine similarity `target_sim` to `base`.

    Uses the formula: b = s * a + sqrt(1 - s^2) * orthogonal_unit_vector
    where s is the target similarity and a is the unit base vector.
    """
    # Generate a random vector and orthogonalize it against base
    rand_vec = rng.standard_normal(512)
    # Remove component parallel to base
    rand_vec = rand_vec - np.dot(rand_vec, base) * base
    # Normalize to unit vector
    rand_vec = rand_vec / np.linalg.norm(rand_vec)
    # Construct vector with exact cosine similarity
    result = target_sim * base + np.sqrt(1.0 - target_sim ** 2) * rand_vec
    result = result / np.linalg.norm(result)  # Ensure unit norm
    return result.tolist()


async def run_tests() -> None:
    from app.db.session import async_session_factory, engine
    from app.models.base import Base
    from app.models.case import Case
    from app.models.entity import Entity
    from app.models.matching import NegativeMatchPair, PendingMatch
    from app.services.matching_service import MatchingService, cosine_similarity

    # Create tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    now = datetime.now(timezone.utc)
    rng = np.random.default_rng(123)

    # Create a normalized base vector
    base = rng.standard_normal(512)
    base = base / np.linalg.norm(base)

    # Create embeddings with EXACT target similarities:
    # A = base vector (normalized)
    emb_a = base.tolist()

    # B = cosine sim 0.88 to A (auto-merge range: > 0.85)
    emb_b = make_embedding_with_similarity(base, 0.88, rng)
    # C = cosine sim 0.78 to A (pending match range: 0.70 - 0.85)
    emb_c = make_embedding_with_similarity(base, 0.78, rng)
    # D = cosine sim 0.45 to A (distinct range: < 0.70)
    emb_d = make_embedding_with_similarity(base, 0.45, rng)

    # Verify similarities
    sim_ab = cosine_similarity(emb_a, emb_b)
    sim_ac = cosine_similarity(emb_a, emb_c)
    sim_ad = cosine_similarity(emb_a, emb_d)

    print("\n--- Pre-computed Similarities ---")
    print(f"  A-B: {sim_ab:.4f}  (target: 0.88, auto-merge range >0.85)")
    print(f"  A-C: {sim_ac:.4f}  (target: 0.78, pending range 0.70-0.85)")
    print(f"  A-D: {sim_ad:.4f}  (target: 0.45, distinct range <0.70)")

    check("A-B sim > 0.85 (auto-merge range)", sim_ab > 0.85, f"sim={sim_ab:.4f}")
    check("A-C sim in [0.70, 0.85) (pending range)", 0.70 <= sim_ac < 0.85, f"sim={sim_ac:.4f}")
    check("A-D sim < 0.70 (distinct range)", sim_ad < 0.70, f"sim={sim_ad:.4f}")

    case_id = None
    entity_ids = []

    # -------------------------------------------------------------------
    # 1. Create test case and entities
    # -------------------------------------------------------------------
    print("\n--- Create Test Case & Entities ---")
    async with async_session_factory() as session:
        case = Case(
            title="Matching Validation Test",
            description="Auto-generated for validate_matching.py",
            status="open",
            priority="medium",
            severity="medium",
            opened_at=now,
        )
        session.add(case)
        await session.commit()
        case_id = case.id

        entities = []
        for label, emb in [("Entity-A", emb_a), ("Entity-B", emb_b),
                            ("Entity-C", emb_c), ("Entity-D", emb_d)]:
            e = Entity(
                entity_type="person",
                label=label,
                confidence=0.90,
                embedding=emb,
                first_seen=now,
                last_seen=now,
                total_sightings=1,
                case_id=case_id,
            )
            entities.append(e)

        session.add_all(entities)
        await session.commit()
        entity_ids = [e.id for e in entities]
        check("4 entities created", len(entity_ids) == 4)

    # -------------------------------------------------------------------
    # 2. Run matching
    # -------------------------------------------------------------------
    print("\n--- Run Matching ---")
    async with async_session_factory() as session:
        result = await MatchingService.run_matching_for_case(session, case_id)
        await session.commit()

        print(f"  Matching result: {result}")
        check("matching ran successfully", "case_id" in result)
        check("entities_compared >= 4", result.get("entities_compared", 0) >= 4,
              f"compared={result.get('entities_compared')}")
        check("auto_merged >= 1 (A-B)", result.get("auto_merged", 0) >= 1,
              f"auto_merged={result.get('auto_merged')}")
        check("pending_matches_created >= 1 (A-C)", result.get("pending_matches_created", 0) >= 1,
              f"pending={result.get('pending_matches_created')}")

    # -------------------------------------------------------------------
    # 3. Verify pending_match records
    # -------------------------------------------------------------------
    print("\n--- Verify Pending Matches ---")
    async with async_session_factory() as session:
        pm_result = await session.execute(
            select(PendingMatch).where(PendingMatch.case_id == case_id)
        )
        pending_matches = list(pm_result.scalars().all())
        check("at least 1 pending match created", len(pending_matches) >= 1,
              f"found {len(pending_matches)}")

        # Find the A-C pending match
        a_id, c_id, d_id = entity_ids[0], entity_ids[2], entity_ids[3]
        ac_match = None
        for pm in pending_matches:
            pair = {pm.entity_a_id, pm.entity_b_id}
            if a_id in pair and c_id in pair:
                ac_match = pm
                break

        check("A-C pending match exists", ac_match is not None)
        if ac_match:
            check(f"A-C similarity ~ {sim_ac:.3f}",
                  abs(ac_match.similarity_score - sim_ac) < 0.01,
                  f"stored={ac_match.similarity_score:.4f}")
            check("A-C status is pending", ac_match.status == "pending",
                  f"status={ac_match.status}")

        # Verify NO pending match for A-D (dissimilar pair)
        ad_match = None
        for pm in pending_matches:
            pair = {pm.entity_a_id, pm.entity_b_id}
            if a_id in pair and d_id in pair:
                ad_match = pm
                break
        check("A-D has NO pending match (distinct)", ad_match is None,
              "unexpected pending match for dissimilar pair")

    # -------------------------------------------------------------------
    # 4. Verify auto-merge (A-B should share match_cluster_id)
    # -------------------------------------------------------------------
    print("\n--- Verify Auto-Merge ---")
    async with async_session_factory() as session:
        a_result = await session.execute(select(Entity).where(Entity.id == entity_ids[0]))
        b_result = await session.execute(select(Entity).where(Entity.id == entity_ids[1]))
        e_a = a_result.scalar_one_or_none()
        e_b = b_result.scalar_one_or_none()

        if e_a and e_b:
            check("Entity A has match_cluster_id",
                  e_a.match_cluster_id is not None,
                  f"cluster={e_a.match_cluster_id}")
            check("Entity B has match_cluster_id",
                  e_b.match_cluster_id is not None,
                  f"cluster={e_b.match_cluster_id}")
            check("A and B share same cluster",
                  e_a.match_cluster_id == e_b.match_cluster_id,
                  f"A={e_a.match_cluster_id}, B={e_b.match_cluster_id}")
            check("merged sightings > 1",
                  max(e_a.total_sightings, e_b.total_sightings) > 1,
                  f"A={e_a.total_sightings}, B={e_b.total_sightings}")
        else:
            check("entities A and B found", False, "one or both missing")

    # -------------------------------------------------------------------
    # Cleanup
    # -------------------------------------------------------------------
    print("\n--- Cleanup ---")
    async with async_session_factory() as session:
        # Delete pending matches
        pm_result = await session.execute(
            select(PendingMatch).where(PendingMatch.case_id == case_id)
        )
        for pm in pm_result.scalars().all():
            await session.delete(pm)
        # Delete negative match pairs
        neg_result = await session.execute(
            select(NegativeMatchPair).where(NegativeMatchPair.case_id == case_id)
        )
        for neg in neg_result.scalars().all():
            await session.delete(neg)
        # Delete entities
        for eid in entity_ids:
            result = await session.execute(select(Entity).where(Entity.id == eid))
            entity = result.scalar_one_or_none()
            if entity:
                await session.delete(entity)
        # Delete case
        result = await session.execute(select(Case).where(Case.id == case_id))
        case = result.scalar_one_or_none()
        if case:
            await session.delete(case)
        await session.commit()
    print("  Test data cleaned up.")

    await engine.dispose()


def main() -> None:
    print("=" * 60)
    print("VIOSINT Sprint 1 — Matching Validation")
    print("=" * 60)

    asyncio.run(run_tests())

    print("\n" + "=" * 60)
    print(f"RESULTS: {passed} passed, {failed} failed, {passed + failed} total")
    print("=" * 60)

    if failed > 0:
        sys.exit(1)
    print("\nAll matching validations PASSED.")


if __name__ == "__main__":
    main()
