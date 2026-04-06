"""Enterprise Data Fusion service — source management, ingestion, correlation, and fusion.

Handles the full lifecycle of external data: register sources, ingest records,
correlate with existing entities, and produce confidence-weighted fusion summaries.
"""

import logging
from datetime import datetime, timezone
from typing import Optional

import numpy as np
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.data_fusion import (
    CorrelationRecord,
    DataSource,
    FusionSummary,
    IngestedRecord,
)
from app.models.entity import Entity

logger = logging.getLogger(__name__)


# ------------------------------------------------------------------ #
# Admiralty rating → confidence weight conversion
# ------------------------------------------------------------------ #

_RELIABILITY_WEIGHTS = {"A": 1.0, "B": 0.8, "C": 0.6, "D": 0.4, "E": 0.2, "F": 0.1}
_CREDIBILITY_WEIGHTS = {"1": 1.0, "2": 0.8, "3": 0.6, "4": 0.4, "5": 0.2, "6": 0.1}


def compute_confidence_weight(reliability: str, credibility: str) -> float:
    r = _RELIABILITY_WEIGHTS.get(reliability, 0.5)
    c = _CREDIBILITY_WEIGHTS.get(credibility, 0.5)
    return round(r * c, 3)


class DataFusionService:
    """Manages external data sources, ingestion, correlation, and fusion."""

    # ------------------------------------------------------------------ #
    # Data Source CRUD
    # ------------------------------------------------------------------ #

    @staticmethod
    async def create_source(
        db: AsyncSession,
        *,
        name: str,
        display_name: str,
        description: str = "",
        source_type: str,
        adapter_type: str = "generic_api",
        connection_config: Optional[dict] = None,
        field_mapping: Optional[dict] = None,
        reliability_rating: str = "C",
        credibility_rating: str = "3",
    ) -> dict:
        weight = compute_confidence_weight(reliability_rating, credibility_rating)
        ds = DataSource(
            name=name,
            display_name=display_name,
            description=description,
            source_type=source_type,
            adapter_type=adapter_type,
            connection_config=connection_config,
            field_mapping=field_mapping,
            reliability_rating=reliability_rating,
            credibility_rating=credibility_rating,
            confidence_weight=weight,
        )
        db.add(ds)
        await db.flush()
        logger.info("Created data source: %s (%s)", name, source_type)
        return _source_to_dict(ds)

    @staticmethod
    async def list_sources(
        db: AsyncSession,
        *,
        source_type: Optional[str] = None,
        status: Optional[str] = None,
        limit: int = 50,
    ) -> list[dict]:
        conditions = []
        if source_type:
            conditions.append(DataSource.source_type == source_type)
        if status:
            conditions.append(DataSource.status == status)
        query = select(DataSource)
        if conditions:
            query = query.where(and_(*conditions))
        query = query.order_by(DataSource.created_at.desc()).limit(limit)
        result = await db.execute(query)
        return [_source_to_dict(ds) for ds in result.scalars().all()]

    @staticmethod
    async def get_source(db: AsyncSession, source_id: str) -> Optional[dict]:
        result = await db.execute(
            select(DataSource).where(DataSource.id == source_id)
        )
        ds = result.scalar_one_or_none()
        return _source_to_dict(ds) if ds else None

    @staticmethod
    async def update_source(
        db: AsyncSession, source_id: str, **kwargs: object
    ) -> Optional[dict]:
        result = await db.execute(
            select(DataSource).where(DataSource.id == source_id)
        )
        ds = result.scalar_one_or_none()
        if not ds:
            return None

        for key, value in kwargs.items():
            if value is not None and hasattr(ds, key):
                setattr(ds, key, value)

        # Recompute confidence weight if ratings changed
        if "reliability_rating" in kwargs or "credibility_rating" in kwargs:
            ds.confidence_weight = compute_confidence_weight(
                ds.reliability_rating, ds.credibility_rating
            )

        ds.updated_at = datetime.now(timezone.utc)
        await db.flush()
        return _source_to_dict(ds)

    @staticmethod
    async def delete_source(db: AsyncSession, source_id: str) -> bool:
        result = await db.execute(
            select(DataSource).where(DataSource.id == source_id)
        )
        ds = result.scalar_one_or_none()
        if not ds:
            return False
        await db.delete(ds)
        await db.flush()
        return True

    @staticmethod
    async def get_source_stats(db: AsyncSession) -> dict:
        """Get aggregate statistics across all data sources."""
        total = await db.execute(select(func.count(DataSource.id)))
        active = await db.execute(
            select(func.count(DataSource.id)).where(DataSource.status == "active")
        )
        total_records = await db.execute(
            select(func.sum(DataSource.total_records_ingested))
        )
        by_type = await db.execute(
            select(DataSource.source_type, func.count(DataSource.id))
            .group_by(DataSource.source_type)
        )

        return {
            "total_sources": total.scalar() or 0,
            "active_sources": active.scalar() or 0,
            "total_records_ingested": total_records.scalar() or 0,
            "sources_by_type": {row[0]: row[1] for row in by_type.all()},
        }

    # ------------------------------------------------------------------ #
    # Record Ingestion
    # ------------------------------------------------------------------ #

    @staticmethod
    async def ingest_record(
        db: AsyncSession,
        *,
        data_source_id: str,
        raw_data: dict,
        external_id: Optional[str] = None,
        raw_timestamp: Optional[datetime] = None,
        location_name: Optional[str] = None,
        latitude: Optional[float] = None,
        longitude: Optional[float] = None,
    ) -> dict:
        """Ingest a single record from an external source.

        Steps: validate source → dedup → normalize → store → trigger correlation.
        """
        # Validate source exists
        src_result = await db.execute(
            select(DataSource).where(DataSource.id == data_source_id)
        )
        source = src_result.scalar_one_or_none()
        if not source:
            raise ValueError(f"Data source {data_source_id} not found")

        # Dedup by external_id
        if external_id:
            existing = await db.execute(
                select(IngestedRecord).where(
                    and_(
                        IngestedRecord.data_source_id == data_source_id,
                        IngestedRecord.external_id == external_id,
                    )
                )
            )
            if existing.scalar_one_or_none():
                return {"status": "duplicate", "external_id": external_id}

        # Normalize using field mapping
        normalized = _apply_field_mapping(raw_data, source.field_mapping or {})
        entity_hints = _extract_entity_hints(raw_data, source.field_mapping or {})

        record = IngestedRecord(
            data_source_id=data_source_id,
            raw_data=raw_data,
            raw_timestamp=raw_timestamp or datetime.now(timezone.utc),
            external_id=external_id,
            normalized_data=normalized,
            entity_hints=entity_hints,
            processing_status="pending",
            source_confidence=source.confidence_weight,
            location_name=location_name,
            latitude=latitude,
            longitude=longitude,
        )
        db.add(record)

        # Update source stats
        source.total_records_ingested += 1
        source.last_ingestion_at = datetime.now(timezone.utc)

        await db.flush()
        logger.info(
            "Ingested record from %s (ext_id=%s)",
            source.name, external_id,
        )
        return _ingested_record_to_dict(record)

    @staticmethod
    async def ingest_batch(
        db: AsyncSession,
        *,
        data_source_id: str,
        records: list[dict],
    ) -> dict:
        """Ingest multiple records at once."""
        results = {"ingested": 0, "duplicates": 0, "errors": 0}
        for raw in records:
            try:
                result = await DataFusionService.ingest_record(
                    db,
                    data_source_id=data_source_id,
                    raw_data=raw.get("data", raw),
                    external_id=raw.get("external_id"),
                    raw_timestamp=raw.get("timestamp"),
                    location_name=raw.get("location_name"),
                    latitude=raw.get("latitude"),
                    longitude=raw.get("longitude"),
                )
                if result.get("status") == "duplicate":
                    results["duplicates"] += 1
                else:
                    results["ingested"] += 1
            except Exception as e:
                logger.warning("Ingestion error: %s", e)
                results["errors"] += 1
        return results

    @staticmethod
    async def list_ingested_records(
        db: AsyncSession,
        *,
        data_source_id: Optional[str] = None,
        processing_status: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[dict]:
        conditions = []
        if data_source_id:
            conditions.append(IngestedRecord.data_source_id == data_source_id)
        if processing_status:
            conditions.append(IngestedRecord.processing_status == processing_status)
        query = select(IngestedRecord)
        if conditions:
            query = query.where(and_(*conditions))
        query = query.order_by(IngestedRecord.created_at.desc()).limit(limit).offset(offset)
        result = await db.execute(query)
        return [_ingested_record_to_dict(r) for r in result.scalars().all()]

    # ------------------------------------------------------------------ #
    # Correlation Engine
    # ------------------------------------------------------------------ #

    @staticmethod
    async def correlate_record(
        db: AsyncSession,
        record_id: str,
        *,
        auto_accept_threshold: float = 0.85,
    ) -> list[dict]:
        """Correlate a single ingested record against existing entities.

        Uses multiple strategies: attribute matching, embedding similarity,
        temporal/spatial proximity. Returns correlation records created.
        """
        rec_result = await db.execute(
            select(IngestedRecord).where(IngestedRecord.id == record_id)
        )
        record = rec_result.scalar_one_or_none()
        if not record:
            return []

        src_result = await db.execute(
            select(DataSource).where(DataSource.id == record.data_source_id)
        )
        source = src_result.scalar_one_or_none()
        source_weight = source.confidence_weight if source else 0.5

        hints = record.entity_hints or {}
        correlations: list[dict] = []

        # Strategy 1: Attribute matching (license plate, name, etc.)
        attr_matches = await _match_by_attributes(db, hints)

        # Strategy 2: Embedding similarity (if face/clip embedding present)
        embedding = hints.get("embedding")
        embed_matches: list[tuple[str, float]] = []
        if embedding and isinstance(embedding, list):
            embed_matches = await _match_by_embedding(db, embedding)

        # Strategy 3: Temporal-spatial proximity
        geo_matches: list[tuple[str, float]] = []
        if record.latitude and record.longitude:
            geo_matches = await _match_by_location(
                db, record.latitude, record.longitude, radius_km=0.5,
            )

        # Merge all match candidates
        candidate_scores: dict[str, list[tuple[str, float]]] = {}
        for entity_id, score in attr_matches:
            candidate_scores.setdefault(entity_id, []).append(("attribute_match", score))
        for entity_id, score in embed_matches:
            candidate_scores.setdefault(entity_id, []).append(("embedding_similarity", score))
        for entity_id, score in geo_matches:
            candidate_scores.setdefault(entity_id, []).append(("temporal_proximity", score))

        for entity_id, match_list in candidate_scores.items():
            # Composite score: weighted average of match methods
            raw_score = sum(s for _, s in match_list) / len(match_list)
            weighted_score = raw_score * source_weight

            matching_fields = {method: score for method, score in match_list}

            status = "auto_accepted" if weighted_score >= auto_accept_threshold else "pending_review"

            corr = CorrelationRecord(
                ingested_record_id=record.id,
                entity_id=entity_id,
                data_source_id=record.data_source_id,
                correlation_method="composite",
                correlation_score=round(raw_score, 4),
                weighted_score=round(weighted_score, 4),
                matching_fields=matching_fields,
                status=status,
            )
            db.add(corr)
            correlations.append(_correlation_to_dict(corr))

        # Update record status
        if correlations:
            record.processing_status = "correlated"
        else:
            record.processing_status = "unmatched"

        await db.flush()
        return correlations

    @staticmethod
    async def correlate_pending(
        db: AsyncSession, *, batch_size: int = 50
    ) -> dict:
        """Process all pending ingested records through the correlation engine."""
        result = await db.execute(
            select(IngestedRecord)
            .where(IngestedRecord.processing_status == "pending")
            .limit(batch_size)
        )
        pending = result.scalars().all()

        stats = {"processed": 0, "correlated": 0, "unmatched": 0}
        for record in pending:
            correlations = await DataFusionService.correlate_record(db, record.id)
            stats["processed"] += 1
            if correlations:
                stats["correlated"] += 1
            else:
                stats["unmatched"] += 1

        return stats

    @staticmethod
    async def review_correlation(
        db: AsyncSession,
        correlation_id: str,
        *,
        decision: str,
        reviewed_by: str,
        enrichment: Optional[dict] = None,
    ) -> Optional[dict]:
        """Accept or reject a pending correlation."""
        result = await db.execute(
            select(CorrelationRecord).where(CorrelationRecord.id == correlation_id)
        )
        corr = result.scalar_one_or_none()
        if not corr:
            return None

        corr.status = decision  # accepted or rejected
        corr.reviewed_by = reviewed_by
        corr.reviewed_at = datetime.now(timezone.utc)

        if decision == "accepted" and enrichment:
            corr.enrichment_applied = enrichment
            # Apply enrichment to the entity
            entity_result = await db.execute(
                select(Entity).where(Entity.id == corr.entity_id)
            )
            entity = entity_result.scalar_one_or_none()
            if entity:
                existing_attrs = entity.attributes or {}
                existing_attrs.update(enrichment)
                entity.attributes = existing_attrs

        await db.flush()
        return _correlation_to_dict(corr)

    @staticmethod
    async def list_correlations(
        db: AsyncSession,
        *,
        entity_id: Optional[str] = None,
        data_source_id: Optional[str] = None,
        status: Optional[str] = None,
        limit: int = 50,
    ) -> list[dict]:
        conditions = []
        if entity_id:
            conditions.append(CorrelationRecord.entity_id == entity_id)
        if data_source_id:
            conditions.append(CorrelationRecord.data_source_id == data_source_id)
        if status:
            conditions.append(CorrelationRecord.status == status)
        query = select(CorrelationRecord)
        if conditions:
            query = query.where(and_(*conditions))
        query = query.order_by(CorrelationRecord.created_at.desc()).limit(limit)
        result = await db.execute(query)
        return [_correlation_to_dict(c) for c in result.scalars().all()]

    # ------------------------------------------------------------------ #
    # Fusion Summaries
    # ------------------------------------------------------------------ #

    @staticmethod
    async def compute_fusion_summary(
        db: AsyncSession, entity_id: str
    ) -> dict:
        """Recompute the fusion summary for an entity.

        Aggregates all accepted correlations, weights attributes by source
        confidence, and produces a single merged profile.
        """
        # Get all accepted correlations for this entity
        corr_result = await db.execute(
            select(CorrelationRecord).where(
                and_(
                    CorrelationRecord.entity_id == entity_id,
                    CorrelationRecord.status.in_(["auto_accepted", "accepted"]),
                )
            )
        )
        correlations = corr_result.scalars().all()

        # Get source info for each correlation
        source_data: dict[str, dict] = {}
        fused_attrs: dict[str, dict] = {}

        for corr in correlations:
            # Get the ingested record
            rec_result = await db.execute(
                select(IngestedRecord).where(IngestedRecord.id == corr.ingested_record_id)
            )
            record = rec_result.scalar_one_or_none()
            if not record:
                continue

            # Get source
            src_result = await db.execute(
                select(DataSource).where(DataSource.id == corr.data_source_id)
            )
            source = src_result.scalar_one_or_none()
            source_name = source.name if source else "unknown"
            source_type = source.source_type if source else "unknown"

            # Track source breakdown
            if source_name not in source_data:
                source_data[source_name] = {
                    "source_type": source_type,
                    "count": 0,
                    "avg_score": 0.0,
                    "last_seen": None,
                }
            source_data[source_name]["count"] += 1
            source_data[source_name]["avg_score"] = (
                (source_data[source_name]["avg_score"] * (source_data[source_name]["count"] - 1)
                 + corr.weighted_score) / source_data[source_name]["count"]
            )
            ts = record.raw_timestamp.isoformat() if record.raw_timestamp else None
            if ts:
                source_data[source_name]["last_seen"] = ts

            # Merge attributes with confidence weighting
            normalized = record.normalized_data or {}
            for attr_key, attr_value in normalized.items():
                if attr_key not in fused_attrs:
                    fused_attrs[attr_key] = {
                        "value": attr_value,
                        "confidence": corr.weighted_score,
                        "sources": [source_name],
                        "count": 1,
                    }
                else:
                    existing = fused_attrs[attr_key]
                    if corr.weighted_score > existing["confidence"]:
                        existing["value"] = attr_value
                        existing["confidence"] = corr.weighted_score
                    if source_name not in existing["sources"]:
                        existing["sources"].append(source_name)
                    existing["count"] += 1

        # Overall confidence
        overall = 0.0
        if correlations:
            overall = sum(c.weighted_score for c in correlations) / len(correlations)

        now = datetime.now(timezone.utc)

        # Upsert fusion summary
        existing = await db.execute(
            select(FusionSummary).where(FusionSummary.entity_id == entity_id)
        )
        summary = existing.scalar_one_or_none()
        if summary:
            summary.source_count = len(source_data)
            summary.correlation_count = len(correlations)
            summary.fused_attributes = fused_attrs
            summary.source_breakdown = source_data
            summary.overall_confidence = round(overall, 4)
            summary.last_computed_at = now
            summary.updated_at = now
        else:
            summary = FusionSummary(
                entity_id=entity_id,
                source_count=len(source_data),
                correlation_count=len(correlations),
                fused_attributes=fused_attrs,
                source_breakdown=source_data,
                overall_confidence=round(overall, 4),
                last_computed_at=now,
            )
            db.add(summary)

        await db.flush()
        return _fusion_summary_to_dict(summary)

    @staticmethod
    async def get_fusion_summary(
        db: AsyncSession, entity_id: str
    ) -> Optional[dict]:
        result = await db.execute(
            select(FusionSummary).where(FusionSummary.entity_id == entity_id)
        )
        fs = result.scalar_one_or_none()
        return _fusion_summary_to_dict(fs) if fs else None

    @staticmethod
    async def list_fusion_summaries(
        db: AsyncSession, *, min_sources: int = 0, limit: int = 50
    ) -> list[dict]:
        query = select(FusionSummary)
        if min_sources > 0:
            query = query.where(FusionSummary.source_count >= min_sources)
        query = query.order_by(FusionSummary.overall_confidence.desc()).limit(limit)
        result = await db.execute(query)
        return [_fusion_summary_to_dict(fs) for fs in result.scalars().all()]


# ------------------------------------------------------------------ #
# Correlation strategies
# ------------------------------------------------------------------ #


async def _match_by_attributes(
    db: AsyncSession, hints: dict
) -> list[tuple[str, float]]:
    """Match by attribute fields (license plate, name, etc.)."""
    matches: list[tuple[str, float]] = []

    # Get all entities with attributes
    result = await db.execute(
        select(Entity).where(Entity.attributes.isnot(None)).limit(500)
    )
    entities = result.scalars().all()

    for entity in entities:
        attrs = entity.attributes or {}
        score = 0.0
        match_count = 0

        for hint_key, hint_value in hints.items():
            if hint_key == "embedding":
                continue
            entity_val = attrs.get(hint_key)
            if entity_val and hint_value:
                if str(entity_val).lower() == str(hint_value).lower():
                    score += 1.0
                    match_count += 1
                elif str(hint_value).lower() in str(entity_val).lower():
                    score += 0.5
                    match_count += 1

        if match_count > 0:
            avg_score = score / match_count
            matches.append((entity.id, avg_score))

    return matches


async def _match_by_embedding(
    db: AsyncSession, embedding: list[float], threshold: float = 0.7
) -> list[tuple[str, float]]:
    """Match by embedding cosine similarity."""
    matches: list[tuple[str, float]] = []
    query_vec = np.array(embedding, dtype=np.float32)

    result = await db.execute(
        select(Entity).where(Entity.embedding.isnot(None)).limit(500)
    )
    entities = result.scalars().all()

    for entity in entities:
        if not entity.embedding:
            continue
        entity_vec = np.array(entity.embedding, dtype=np.float32)
        norm_product = np.linalg.norm(query_vec) * np.linalg.norm(entity_vec) + 1e-8
        sim = float(np.dot(query_vec, entity_vec) / norm_product)
        if sim >= threshold:
            matches.append((entity.id, sim))

    return matches


async def _match_by_location(
    db: AsyncSession,
    lat: float,
    lon: float,
    radius_km: float = 0.5,
) -> list[tuple[str, float]]:
    """Match entities seen near a location (simplified Haversine)."""
    # This is a simplified approach — in production use PostGIS
    # For now, just return empty (location data not stored on entities yet)
    return []


# ------------------------------------------------------------------ #
# Field mapping / normalization helpers
# ------------------------------------------------------------------ #


def _apply_field_mapping(raw_data: dict, mapping: dict) -> dict:
    """Apply source field mapping to normalize raw data."""
    normalized: dict[str, object] = {}
    for source_field, target_path in mapping.items():
        value = raw_data.get(source_field)
        if value is not None:
            # Flatten target path (e.g. "entity.attributes.plate" → "plate")
            key = target_path.split(".")[-1] if "." in target_path else target_path
            normalized[key] = value
    return normalized


def _extract_entity_hints(raw_data: dict, mapping: dict) -> dict:
    """Extract fields that could help identify an entity."""
    hints: dict[str, object] = {}
    identity_fields = {
        "license_plate", "plate", "name", "full_name", "face_embedding",
        "embedding", "mac_address", "imei", "badge_id", "ssn", "phone",
    }
    for source_field, target_path in mapping.items():
        key = target_path.split(".")[-1] if "." in target_path else target_path
        if key in identity_fields:
            value = raw_data.get(source_field)
            if value is not None:
                hints[key] = value

    # Also check raw data directly for common identity fields
    for field in identity_fields:
        if field in raw_data and field not in hints:
            hints[field] = raw_data[field]

    return hints


# ------------------------------------------------------------------ #
# Serializers
# ------------------------------------------------------------------ #


def _source_to_dict(ds: DataSource) -> dict:
    return {
        "id": ds.id,
        "name": ds.name,
        "display_name": ds.display_name,
        "description": ds.description,
        "source_type": ds.source_type,
        "adapter_type": ds.adapter_type,
        "connection_config": ds.connection_config,
        "field_mapping": ds.field_mapping,
        "reliability_rating": ds.reliability_rating,
        "credibility_rating": ds.credibility_rating,
        "confidence_weight": ds.confidence_weight,
        "status": ds.status,
        "last_heartbeat_at": ds.last_heartbeat_at.isoformat() if ds.last_heartbeat_at else None,
        "last_ingestion_at": ds.last_ingestion_at.isoformat() if ds.last_ingestion_at else None,
        "total_records_ingested": ds.total_records_ingested,
        "error_count": ds.error_count,
        "last_error": ds.last_error,
        "is_active": ds.is_active,
        "created_at": ds.created_at.isoformat(),
    }


def _ingested_record_to_dict(r: IngestedRecord) -> dict:
    return {
        "id": r.id,
        "data_source_id": r.data_source_id,
        "raw_data": r.raw_data,
        "raw_timestamp": r.raw_timestamp.isoformat() if r.raw_timestamp else None,
        "external_id": r.external_id,
        "normalized_data": r.normalized_data,
        "entity_hints": r.entity_hints,
        "processing_status": r.processing_status,
        "source_confidence": r.source_confidence,
        "location_name": r.location_name,
        "latitude": r.latitude,
        "longitude": r.longitude,
        "created_at": r.created_at.isoformat(),
    }


def _correlation_to_dict(c: CorrelationRecord) -> dict:
    return {
        "id": c.id,
        "ingested_record_id": c.ingested_record_id,
        "entity_id": c.entity_id,
        "data_source_id": c.data_source_id,
        "correlation_method": c.correlation_method,
        "correlation_score": c.correlation_score,
        "weighted_score": c.weighted_score,
        "matching_fields": c.matching_fields,
        "status": c.status,
        "reviewed_by": c.reviewed_by,
        "reviewed_at": c.reviewed_at.isoformat() if c.reviewed_at else None,
        "enrichment_applied": c.enrichment_applied,
        "created_at": c.created_at.isoformat(),
    }


def _fusion_summary_to_dict(fs: FusionSummary) -> dict:
    return {
        "id": fs.id,
        "entity_id": fs.entity_id,
        "source_count": fs.source_count,
        "correlation_count": fs.correlation_count,
        "fused_attributes": fs.fused_attributes,
        "source_breakdown": fs.source_breakdown,
        "overall_confidence": fs.overall_confidence,
        "last_computed_at": fs.last_computed_at.isoformat() if fs.last_computed_at else None,
        "created_at": fs.created_at.isoformat(),
    }
