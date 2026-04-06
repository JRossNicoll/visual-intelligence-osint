"""Demo data seeding service.

Generates realistic synthetic data for demos and development:
- Streams (camera locations)
- Entities (people, vehicles, objects)
- Temporal events with realistic patterns
- Alerts (anomalies, coordinated behavior, reappearances)
- Cases with linked evidence
- Intelligence insights and behavior records
- Entity profiles with risk scores
"""

import logging
import random
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.alert import Alert
from app.models.case import AuditLog, Case, CaseEvidence, CaseNote
from app.models.entity import Entity, Sighting
from app.models.intelligence import (
    BehaviorRecord,
    EntityProfile,
    IntelligenceInsight,
    TemporalEvent,
)
from app.models.stream import Stream

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants for realistic data generation
# ---------------------------------------------------------------------------

LOCATIONS = [
    {"name": "Main Entrance - North", "lat": 51.5074, "lon": -0.1278},
    {"name": "Parking Lot B", "lat": 51.5080, "lon": -0.1285},
    {"name": "Loading Dock - East", "lat": 51.5068, "lon": -0.1265},
    {"name": "Perimeter Fence - South", "lat": 51.5060, "lon": -0.1280},
    {"name": "Reception Lobby", "lat": 51.5074, "lon": -0.1270},
    {"name": "Warehouse Entrance", "lat": 51.5065, "lon": -0.1290},
    {"name": "Staff Car Park", "lat": 51.5082, "lon": -0.1295},
    {"name": "Visitor Center", "lat": 51.5078, "lon": -0.1260},
]

PERSON_LABELS = [
    "Male, dark jacket, backpack",
    "Female, red coat, glasses",
    "Male, high-vis vest, hard hat",
    "Female, business suit, briefcase",
    "Male, hoodie, jeans",
    "Female, nurse uniform",
    "Male, security uniform",
    "Male, gray suit",
    "Female, green jacket, scarf",
    "Male, delivery uniform, clipboard",
]

VEHICLE_LABELS = [
    "White Toyota Hilux",
    "Black Range Rover",
    "Blue Ford Transit Van",
    "Red Honda Civic",
    "Silver BMW 3 Series",
    "Black Mercedes Sprinter",
    "White Volkswagen Caddy",
    "Dark Gray Audi A4",
]

VEHICLE_ATTRIBUTES = [
    {"color": "white", "make": "Toyota", "model": "Hilux", "type": "pickup"},
    {"color": "black", "make": "Range Rover", "model": "Sport", "type": "suv"},
    {"color": "blue", "make": "Ford", "model": "Transit", "type": "van"},
    {"color": "red", "make": "Honda", "model": "Civic", "type": "sedan"},
    {"color": "silver", "make": "BMW", "model": "3 Series", "type": "sedan"},
    {"color": "black", "make": "Mercedes", "model": "Sprinter", "type": "van"},
    {"color": "white", "make": "Volkswagen", "model": "Caddy", "type": "van"},
    {"color": "gray", "make": "Audi", "model": "A4", "type": "sedan"},
]


def _uid() -> str:
    return str(uuid.uuid4())


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _rand_past(days: int = 14) -> datetime:
    """Random timestamp within the last N days."""
    return _now() - timedelta(
        days=random.randint(0, days),
        hours=random.randint(0, 23),
        minutes=random.randint(0, 59),
        seconds=random.randint(0, 59),
    )


class SeedService:
    """Generates and inserts realistic demo data."""

    # ------------------------------------------------------------------ #
    # Public entry point
    # ------------------------------------------------------------------ #

    @staticmethod
    async def seed_demo_data(
        db: AsyncSession,
        *,
        num_streams: int = 8,
        num_people: int = 15,
        num_vehicles: int = 10,
        num_events_per_entity: int = 25,
        num_alerts: int = 30,
        num_cases: int = 5,
        num_insights: int = 12,
        clear_existing: bool = True,
    ) -> dict:
        """Generate all demo data in a single transaction.

        Returns a summary of what was created.
        """
        logger.info("Starting demo data seeding...")

        if clear_existing:
            await SeedService._clear_tables(db)

        # 1. Streams (camera sources)
        streams = await SeedService._seed_streams(db, num_streams)
        stream_ids = [s.id for s in streams]

        # 2. Entities (people + vehicles)
        people = await SeedService._seed_people(db, num_people, stream_ids)
        vehicles = await SeedService._seed_vehicles(db, num_vehicles, stream_ids)
        all_entities = people + vehicles

        # 3. Temporal events with patterns
        events = await SeedService._seed_temporal_events(
            db, all_entities, stream_ids, num_events_per_entity
        )

        # 4. Sightings
        sightings = await SeedService._seed_sightings(db, all_entities, stream_ids)

        # 5. Behavior records
        behaviors = await SeedService._seed_behaviors(db, all_entities, stream_ids)

        # 6. Entity profiles with risk scores
        profiles = await SeedService._seed_entity_profiles(db, all_entities)

        # 7. Alerts
        alerts = await SeedService._seed_alerts(db, all_entities, stream_ids, num_alerts)

        # 8. Intelligence insights
        insights = await SeedService._seed_insights(db, all_entities, num_insights)

        # 9. Cases with evidence, notes, audit logs
        cases = await SeedService._seed_cases(db, all_entities, alerts, events, num_cases)

        await db.flush()

        summary = {
            "streams": len(streams),
            "entities": len(all_entities),
            "people": len(people),
            "vehicles": len(vehicles),
            "temporal_events": len(events),
            "sightings": len(sightings),
            "behaviors": len(behaviors),
            "profiles": len(profiles),
            "alerts": len(alerts),
            "insights": len(insights),
            "cases": len(cases),
        }
        logger.info("Demo data seeding complete: %s", summary)
        return summary

    # ------------------------------------------------------------------ #
    # Check if data already exists
    # ------------------------------------------------------------------ #

    @staticmethod
    async def is_seeded(db: AsyncSession) -> bool:
        """Return True if the database already contains demo data."""
        result = await db.execute(select(func.count()).select_from(Entity))
        count = result.scalar() or 0
        return count > 0

    # ------------------------------------------------------------------ #
    # Clear existing data
    # ------------------------------------------------------------------ #

    @staticmethod
    async def _clear_tables(db: AsyncSession) -> None:
        """Truncate all tables in dependency-safe order."""
        logger.info("Clearing existing data...")
        for model in [
            AuditLog,
            CaseNote,
            CaseEvidence,
            Case,
            IntelligenceInsight,
            BehaviorRecord,
            EntityProfile,
            TemporalEvent,
            Sighting,
            Alert,
            Entity,
            Stream,
        ]:
            await db.execute(model.__table__.delete())
        await db.flush()

    # ------------------------------------------------------------------ #
    # Streams
    # ------------------------------------------------------------------ #

    @staticmethod
    async def _seed_streams(db: AsyncSession, count: int) -> list[Stream]:
        streams: list[Stream] = []
        for i in range(min(count, len(LOCATIONS))):
            loc = LOCATIONS[i]
            started = _rand_past(30)
            s = Stream(
                id=_uid(),
                name=f"CAM-{i + 1:02d}: {loc['name']}",
                source_type="rtsp",
                source_url=f"rtsp://10.0.1.{10 + i}:554/stream1",
                status="active",
                fps=15.0,
                width=1920,
                height=1080,
                location_name=loc["name"],
                latitude=loc["lat"],
                longitude=loc["lon"],
                is_live=True,
                started_at=started,
                total_frames_processed=random.randint(100_000, 2_000_000),
                total_detections=random.randint(5_000, 50_000),
            )
            db.add(s)
            streams.append(s)
        await db.flush()
        return streams

    # ------------------------------------------------------------------ #
    # Entities — People
    # ------------------------------------------------------------------ #

    @staticmethod
    async def _seed_people(
        db: AsyncSession, count: int, stream_ids: list[str]
    ) -> list[Entity]:
        entities: list[Entity] = []
        for i in range(count):
            label = PERSON_LABELS[i % len(PERSON_LABELS)]
            first_seen = _rand_past(14)
            last_seen = first_seen + timedelta(
                hours=random.randint(1, 72), minutes=random.randint(0, 59)
            )
            if last_seen > _now():
                last_seen = _now()
            e = Entity(
                id=_uid(),
                entity_type="person",
                label=label,
                confidence=round(random.uniform(0.75, 0.98), 3),
                attributes={
                    "description": label,
                    "height_estimate": random.choice(["short", "medium", "tall"]),
                    "build": random.choice(["slim", "medium", "heavy"]),
                },
                first_seen=first_seen,
                last_seen=last_seen,
                total_sightings=random.randint(3, 80),
                first_stream_id=random.choice(stream_ids),
                last_stream_id=random.choice(stream_ids),
            )
            db.add(e)
            entities.append(e)
        await db.flush()
        return entities

    # ------------------------------------------------------------------ #
    # Entities — Vehicles
    # ------------------------------------------------------------------ #

    @staticmethod
    async def _seed_vehicles(
        db: AsyncSession, count: int, stream_ids: list[str]
    ) -> list[Entity]:
        entities: list[Entity] = []
        for i in range(count):
            idx = i % len(VEHICLE_LABELS)
            label = VEHICLE_LABELS[idx]
            attrs = VEHICLE_ATTRIBUTES[idx].copy()
            first_seen = _rand_past(14)
            last_seen = first_seen + timedelta(
                hours=random.randint(1, 48), minutes=random.randint(0, 59)
            )
            if last_seen > _now():
                last_seen = _now()
            e = Entity(
                id=_uid(),
                entity_type="vehicle",
                label=label,
                confidence=round(random.uniform(0.80, 0.97), 3),
                attributes=attrs,
                first_seen=first_seen,
                last_seen=last_seen,
                total_sightings=random.randint(2, 50),
                first_stream_id=random.choice(stream_ids),
                last_stream_id=random.choice(stream_ids),
            )
            db.add(e)
            entities.append(e)
        await db.flush()
        return entities

    # ------------------------------------------------------------------ #
    # Temporal Events — with realistic patterns
    # ------------------------------------------------------------------ #

    @staticmethod
    async def _seed_temporal_events(
        db: AsyncSession,
        entities: list[Entity],
        stream_ids: list[str],
        events_per_entity: int,
    ) -> list[TemporalEvent]:
        all_events: list[TemporalEvent] = []
        event_types = ["appearance", "departure", "reappearance", "co_occurrence"]

        for entity in entities:
            # Build a realistic pattern: some entities are periodic, some random
            is_periodic = random.random() < 0.4
            interval_hours = random.choice([4, 8, 12, 24]) if is_periodic else 0

            for j in range(events_per_entity):
                if is_periodic:
                    # Periodic entity: appears at regular intervals with jitter
                    ts = entity.first_seen + timedelta(
                        hours=interval_hours * j,
                        minutes=random.randint(-30, 30),
                    )
                else:
                    # Random entity: scattered appearances
                    ts = entity.first_seen + timedelta(
                        hours=random.randint(0, 336),  # up to 14 days
                        minutes=random.randint(0, 59),
                    )

                if ts > _now():
                    ts = _now() - timedelta(minutes=random.randint(1, 60))

                loc_idx = random.randint(0, len(LOCATIONS) - 1)
                loc = LOCATIONS[loc_idx]

                # Pick co-occurring entities for some events
                co_occurring: Optional[list[str]] = None
                if random.random() < 0.2 and len(entities) > 1:
                    others = [e.id for e in entities if e.id != entity.id]
                    co_occurring = random.sample(others, min(random.randint(1, 3), len(others)))

                ev = TemporalEvent(
                    id=_uid(),
                    entity_id=entity.id,
                    stream_id=random.choice(stream_ids),
                    location_id=stream_ids[loc_idx % len(stream_ids)],
                    location_name=loc["name"],
                    event_type=random.choice(event_types),
                    timestamp=ts,
                    duration_seconds=round(random.uniform(5.0, 600.0), 1),
                    confidence=round(random.uniform(0.70, 0.99), 3),
                    co_occurring_entities=co_occurring,
                    hour_of_day=ts.hour,
                    day_of_week=ts.weekday(),
                    is_weekend=ts.weekday() >= 5,
                )
                db.add(ev)
                all_events.append(ev)

        await db.flush()
        return all_events

    # ------------------------------------------------------------------ #
    # Sightings
    # ------------------------------------------------------------------ #

    @staticmethod
    async def _seed_sightings(
        db: AsyncSession, entities: list[Entity], stream_ids: list[str]
    ) -> list[Sighting]:
        sightings: list[Sighting] = []
        for entity in entities:
            num_sightings = random.randint(2, 8)
            for _ in range(num_sightings):
                first_ts = _rand_past(14)
                last_ts = first_ts + timedelta(
                    minutes=random.randint(1, 30),
                    seconds=random.randint(0, 59),
                )
                if last_ts > _now():
                    last_ts = _now()
                s = Sighting(
                    id=_uid(),
                    entity_id=entity.id,
                    stream_id=random.choice(stream_ids),
                    first_frame=random.randint(1, 10000),
                    last_frame=random.randint(10001, 50000),
                    first_timestamp=first_ts,
                    last_timestamp=last_ts,
                    detection_count=random.randint(10, 500),
                    avg_confidence=round(random.uniform(0.75, 0.96), 3),
                )
                db.add(s)
                sightings.append(s)
        await db.flush()
        return sightings

    # ------------------------------------------------------------------ #
    # Behavior Records
    # ------------------------------------------------------------------ #

    @staticmethod
    async def _seed_behaviors(
        db: AsyncSession, entities: list[Entity], stream_ids: list[str]
    ) -> list[BehaviorRecord]:
        records: list[BehaviorRecord] = []
        behavior_types = [
            ("routine", "Consistent daily appearance pattern", "low"),
            ("repeated_visit", "Multiple visits to same location within short window", "medium"),
            ("loitering", "Extended stay exceeding normal dwell time", "medium"),
            ("convoy", "Moves in coordination with associated entity", "high"),
            ("anomaly", "Deviation from established behavioral baseline", "high"),
            ("short_stay", "Brief stop significantly below average duration", "low"),
        ]

        for entity in entities:
            # Each entity gets 1-3 behavior records
            num_behaviors = random.randint(1, 3)
            chosen = random.sample(behavior_types, min(num_behaviors, len(behavior_types)))
            for btype, desc, severity in chosen:
                loc_idx = random.randint(0, len(LOCATIONS) - 1)
                loc = LOCATIONS[loc_idx]
                started = _rand_past(10)
                ended = started + timedelta(
                    hours=random.randint(0, 4), minutes=random.randint(0, 59)
                )
                if ended > _now():
                    ended = _now()

                associated: Optional[list[str]] = None
                if btype == "convoy":
                    others = [e.id for e in entities if e.id != entity.id]
                    if others:
                        associated = random.sample(others, min(random.randint(1, 2), len(others)))

                br = BehaviorRecord(
                    id=_uid(),
                    entity_id=entity.id,
                    behavior_type=btype,
                    description=desc,
                    confidence=round(random.uniform(0.60, 0.95), 3),
                    severity=severity,
                    location_id=stream_ids[loc_idx % len(stream_ids)],
                    location_name=loc["name"],
                    stream_id=random.choice(stream_ids),
                    started_at=started,
                    ended_at=ended,
                    duration_seconds=round((ended - started).total_seconds(), 1),
                    associated_entity_ids=associated,
                    pattern_data={
                        "frequency": random.choice(["daily", "weekly", "irregular"]),
                        "typical_time": f"{random.randint(6, 20):02d}:00",
                        "variance_minutes": random.randint(5, 60),
                    },
                    is_active=random.random() < 0.3,
                )
                db.add(br)
                records.append(br)
        await db.flush()
        return records

    # ------------------------------------------------------------------ #
    # Entity Profiles
    # ------------------------------------------------------------------ #

    @staticmethod
    async def _seed_entity_profiles(
        db: AsyncSession, entities: list[Entity]
    ) -> list[EntityProfile]:
        profiles: list[EntityProfile] = []
        for entity in entities:
            risk = round(random.uniform(0.0, 1.0), 3)
            risk_level = (
                "critical" if risk > 0.8
                else "high" if risk > 0.6
                else "medium" if risk > 0.3
                else "low"
            )
            loc_idx = random.randint(0, len(LOCATIONS) - 1)
            loc = LOCATIONS[loc_idx]
            profile = EntityProfile(
                id=_uid(),
                entity_id=entity.id,
                entity_type=entity.entity_type,
                first_seen=entity.first_seen,
                last_seen=entity.last_seen,
                visit_count=entity.total_sightings,
                total_duration_seconds=round(random.uniform(300, 36000), 1),
                common_locations=[
                    {
                        "location_name": LOCATIONS[k]["name"],
                        "visit_count": random.randint(2, 20),
                        "avg_duration": random.randint(60, 3600),
                    }
                    for k in random.sample(range(len(LOCATIONS)), min(3, len(LOCATIONS)))
                ],
                last_location_name=loc["name"],
                behavior_summary={
                    "primary_behavior": random.choice(
                        ["routine_visitor", "irregular", "one_time", "frequent"]
                    ),
                    "loitering_score": round(random.uniform(0, 0.5), 2),
                    "regularity_score": round(random.uniform(0.1, 1.0), 2),
                },
                behavior_tags=random.sample(
                    ["routine_visitor", "daytime_only", "short_stay", "long_stay", "weekday_only"],
                    k=random.randint(1, 3),
                ),
                temporal_pattern={
                    "peak_hours": sorted(random.sample(range(6, 20), 2)),
                    "peak_days": random.sample(["mon", "tue", "wed", "thu", "fri"], 3),
                    "avg_interval_hours": round(random.uniform(4, 48), 1),
                },
                association_count=random.randint(0, 8),
                risk_score=risk,
                risk_factors=[
                    {"factor": f, "weight": round(random.uniform(0.1, 0.5), 2)}
                    for f in random.sample(
                        [
                            "unusual_time",
                            "new_location",
                            "frequent_reappearance",
                            "association_with_high_risk",
                            "behavioral_anomaly",
                        ],
                        k=random.randint(1, 3),
                    )
                ],
                risk_level=risk_level,
                profile_completeness=round(random.uniform(0.4, 1.0), 2),
                last_analyzed_at=_now() - timedelta(minutes=random.randint(5, 120)),
            )
            db.add(profile)
            profiles.append(profile)
        await db.flush()
        return profiles

    # ------------------------------------------------------------------ #
    # Alerts
    # ------------------------------------------------------------------ #

    @staticmethod
    async def _seed_alerts(
        db: AsyncSession,
        entities: list[Entity],
        stream_ids: list[str],
        count: int,
    ) -> list[Alert]:
        alerts: list[Alert] = []
        alert_templates = [
            {
                "type": "anomaly",
                "title": "Unusual time of appearance — {entity}",
                "desc": "Entity appeared far outside normal time pattern. Observed at {hour}:00, typical window is 08:00-17:00.",
                "severity_pool": ["medium", "high"],
            },
            {
                "type": "anomaly",
                "title": "Location anomaly — {entity}",
                "desc": "Entity detected at {location}, a location not in their established pattern.",
                "severity_pool": ["medium", "high"],
            },
            {
                "type": "reappearance",
                "title": "High-risk entity reappeared — {entity}",
                "desc": "Previously flagged entity reappeared at {location} after {days} days absence.",
                "severity_pool": ["high", "critical"],
            },
            {
                "type": "target_match",
                "title": "Target match — {entity}",
                "desc": "Entity matches active target profile with {conf}% similarity.",
                "severity_pool": ["high", "critical"],
            },
            {
                "type": "anomaly",
                "title": "Coordinated movement detected",
                "desc": "Multiple entities ({count}) appeared together at {location} within a 5-minute window.",
                "severity_pool": ["medium", "high", "critical"],
            },
            {
                "type": "anomaly",
                "title": "Loitering detected — {entity}",
                "desc": "Entity present at {location} for {mins} minutes, exceeding normal dwell time by {factor}x.",
                "severity_pool": ["low", "medium"],
            },
        ]

        for _ in range(count):
            template = random.choice(alert_templates)
            entity = random.choice(entities)
            loc = random.choice(LOCATIONS)
            severity = random.choice(template["severity_pool"])
            conf = random.randint(70, 98)
            hour = random.randint(0, 23)
            days = random.randint(2, 30)
            mins = random.randint(15, 120)
            factor = round(random.uniform(1.5, 5.0), 1)

            title = template["title"].format(
                entity=entity.label[:40], count=random.randint(2, 5)
            )
            desc = template["desc"].format(
                entity=entity.label[:40],
                location=loc["name"],
                hour=hour,
                conf=conf,
                days=days,
                count=random.randint(2, 5),
                mins=mins,
                factor=factor,
            )

            is_read = random.random() < 0.3
            created = _rand_past(7)

            alert = Alert(
                id=_uid(),
                alert_type=template["type"],
                severity=severity,
                title=title,
                description=desc,
                entity_id=entity.id,
                stream_id=random.choice(stream_ids),
                confidence=round(conf / 100.0, 3),
                is_read=is_read,
                is_acknowledged=is_read and random.random() < 0.5,
                acknowledged_at=created + timedelta(minutes=random.randint(1, 60)) if is_read else None,
                metadata_json={
                    "location": loc["name"],
                    "entity_type": entity.entity_type,
                    "entity_label": entity.label,
                },
            )
            db.add(alert)
            alerts.append(alert)

        await db.flush()
        return alerts

    # ------------------------------------------------------------------ #
    # Intelligence Insights
    # ------------------------------------------------------------------ #

    @staticmethod
    async def _seed_insights(
        db: AsyncSession, entities: list[Entity], count: int
    ) -> list[IntelligenceInsight]:
        insights: list[IntelligenceInsight] = []
        insight_templates = [
            {
                "type": "pattern",
                "title": "Periodic behavior detected for {entity}",
                "desc": "Entity shows a {freq} appearance pattern with {conf}% confidence. Peak activity at {hour}:00.",
                "severity": "info",
            },
            {
                "type": "anomaly",
                "title": "Behavioral anomaly cluster at {location}",
                "desc": "{count} anomalous events detected at this location in the past 48 hours, exceeding baseline by {factor}x.",
                "severity": "high",
            },
            {
                "type": "association",
                "title": "Strong association: {entity1} and {entity2}",
                "desc": "Entities co-occurred {cooc} times across {locs} locations. Relationship strength: {strength}.",
                "severity": "medium",
            },
            {
                "type": "risk_change",
                "title": "Risk escalation — {entity}",
                "desc": "Risk score increased from {old} to {new} due to {reason}.",
                "severity": "high",
            },
            {
                "type": "prediction",
                "title": "Predicted reappearance — {entity}",
                "desc": "Based on historical pattern, entity is predicted to appear at {location} within the next {hours} hours ({conf}% confidence).",
                "severity": "info",
            },
        ]

        for _ in range(count):
            template = random.choice(insight_templates)
            entity = random.choice(entities)
            entity2 = random.choice([e for e in entities if e.id != entity.id])
            loc = random.choice(LOCATIONS)

            title = template["title"].format(
                entity=entity.label[:30],
                entity1=entity.label[:20],
                entity2=entity2.label[:20],
                location=loc["name"],
            )
            desc = template["desc"].format(
                entity=entity.label[:30],
                freq=random.choice(["daily", "12-hour", "weekly"]),
                conf=random.randint(65, 95),
                hour=random.randint(6, 20),
                count=random.randint(3, 12),
                factor=round(random.uniform(1.5, 4.0), 1),
                cooc=random.randint(5, 25),
                locs=random.randint(2, 5),
                strength=round(random.uniform(0.5, 0.95), 2),
                old=round(random.uniform(0.1, 0.4), 2),
                new=round(random.uniform(0.5, 0.9), 2),
                reason=random.choice([
                    "new anomaly",
                    "increased frequency",
                    "association with flagged entity",
                ]),
                location=loc["name"],
                hours=random.randint(2, 24),
            )

            insight = IntelligenceInsight(
                id=_uid(),
                insight_type=template["type"],
                title=title,
                description=desc,
                severity=template["severity"],
                entity_ids=[entity.id],
                confidence=round(random.uniform(0.55, 0.98), 3),
                evidence={
                    "supporting_events": random.randint(5, 30),
                    "pattern_strength": round(random.uniform(0.4, 0.95), 2),
                    "time_span_hours": random.randint(24, 336),
                },
                recommendation=random.choice([
                    "Continue monitoring. Pattern is consistent.",
                    "Add to watchlist for closer surveillance.",
                    "Recommend investigation — behavior deviates significantly from baseline.",
                    "Low priority — within expected behavioral parameters.",
                    "Escalate to analyst — potential coordinated activity.",
                ]),
                is_reviewed=random.random() < 0.3,
                is_dismissed=False,
            )
            db.add(insight)
            insights.append(insight)

        await db.flush()
        return insights

    # ------------------------------------------------------------------ #
    # Cases with evidence, notes, audit logs
    # ------------------------------------------------------------------ #

    @staticmethod
    async def _seed_cases(
        db: AsyncSession,
        entities: list[Entity],
        alerts: list[Alert],
        events: list[TemporalEvent],
        count: int,
    ) -> list[Case]:
        cases: list[Case] = []
        case_templates = [
            {
                "title": "Suspicious Recurring Vehicle at Loading Dock",
                "desc": "White van observed repeatedly at Loading Dock outside business hours. Pattern suggests potential surveillance or unauthorized deliveries.",
                "priority": "high",
                "severity": "high",
                "status": "active",
                "tags": ["vehicle", "recurring", "after-hours"],
            },
            {
                "title": "Coordinated Group Activity — Parking Lot B",
                "desc": "Three individuals consistently arriving within minutes of each other at Parking Lot B. Staggered arrival pattern suggests deliberate coordination.",
                "priority": "critical",
                "severity": "critical",
                "status": "active",
                "tags": ["coordination", "group", "investigation"],
            },
            {
                "title": "Perimeter Breach Attempt — South Fence",
                "desc": "Individual detected near perimeter fence during restricted hours. Loitering behavior exceeds 45 minutes. No authorized access on record.",
                "priority": "high",
                "severity": "high",
                "status": "open",
                "tags": ["perimeter", "loitering", "unauthorized"],
            },
            {
                "title": "Unknown Entity — Repeated Visits to Warehouse",
                "desc": "Unidentified person making repeated short visits to Warehouse Entrance. Pattern is irregular and does not match any known personnel schedule.",
                "priority": "medium",
                "severity": "medium",
                "status": "open",
                "tags": ["unknown", "warehouse", "repeated-visits"],
            },
            {
                "title": "High-Risk Entity Reappearance — Main Entrance",
                "desc": "Previously flagged individual returned after 12-day absence. Risk score elevated due to prior association with coordinated activity case.",
                "priority": "critical",
                "severity": "high",
                "status": "active",
                "tags": ["high-risk", "reappearance", "flagged"],
            },
        ]

        for i in range(min(count, len(case_templates))):
            tmpl = case_templates[i]
            # Link 2-4 entities and 2-5 alerts per case
            case_entities = random.sample(entities, min(random.randint(2, 4), len(entities)))
            case_alerts = random.sample(alerts, min(random.randint(2, 5), len(alerts)))
            opened = _rand_past(7)

            case = Case(
                id=_uid(),
                title=tmpl["title"],
                description=tmpl["desc"],
                status=tmpl["status"],
                priority=tmpl["priority"],
                severity=tmpl["severity"],
                entity_count=len(case_entities),
                alert_count=len(case_alerts),
                evidence_count=0,
                linked_entity_ids=[e.id for e in case_entities],
                linked_alert_ids=[a.id for a in case_alerts],
                created_by="operator",
                assigned_to=random.choice(["analyst-1", "analyst-2", "operator-1"]),
                tags=tmpl["tags"],
                source_type="alert" if case_alerts else "manual",
                source_id=case_alerts[0].id if case_alerts else None,
                opened_at=opened,
                closed_at=None,
            )
            db.add(case)
            await db.flush()

            # Add evidence items
            evidence_count = 0
            for alert in case_alerts[:3]:
                ev = CaseEvidence(
                    id=_uid(),
                    case_id=case.id,
                    evidence_type="alert",
                    source_table="alerts",
                    source_id=alert.id,
                    title=alert.title,
                    description=alert.description or "",
                    data_snapshot={
                        "alert_type": alert.alert_type,
                        "severity": alert.severity,
                        "confidence": alert.confidence,
                    },
                    confidence=alert.confidence,
                    added_by="system",
                )
                db.add(ev)
                evidence_count += 1

            # Add some event evidence
            case_entity_ids = {e.id for e in case_entities}
            related_events = [ev for ev in events if ev.entity_id in case_entity_ids][:3]
            for event in related_events:
                ev = CaseEvidence(
                    id=_uid(),
                    case_id=case.id,
                    evidence_type="event",
                    source_table="temporal_events",
                    source_id=event.id,
                    title=f"{event.event_type} at {event.location_name or 'unknown'}",
                    description=f"Entity {event.entity_id[:8]} — {event.event_type}",
                    data_snapshot={
                        "event_type": event.event_type,
                        "location": event.location_name,
                        "timestamp": event.timestamp.isoformat(),
                    },
                    confidence=event.confidence,
                    added_by="system",
                )
                db.add(ev)
                evidence_count += 1

            case.evidence_count = evidence_count

            # Add analyst notes
            notes_data = [
                ("Initial triage — alert correlation looks strong. Assigning for deeper analysis.", "finding", "operator-1"),
                ("Reviewed timeline. Pattern is consistent with previous incident (Case #3). Recommend escalation.", "finding", "analyst-1"),
                ("Checked camera footage manually. Confirmed visual match.", "action", "analyst-2"),
            ]
            for content, note_type, author in notes_data[:random.randint(1, 3)]:
                note = CaseNote(
                    id=_uid(),
                    case_id=case.id,
                    author=author,
                    content=content,
                    note_type=note_type,
                )
                db.add(note)

            # Add audit log entries
            audit_entries = [
                ("case_created", "operator-1", "operator", f"Case created: {tmpl['title']}"),
                ("evidence_added", "system", "system", f"Auto-attached {evidence_count} evidence items"),
                ("case_updated", "analyst-1", "investigator", f"Status changed to {tmpl['status']}"),
            ]
            for action, actor, role, detail in audit_entries:
                audit = AuditLog(
                    id=_uid(),
                    actor=actor,
                    role=role,
                    action=action,
                    resource_type="case",
                    resource_id=case.id,
                    detail=detail,
                    performed_at=opened + timedelta(minutes=random.randint(1, 120)),
                )
                db.add(audit)

            cases.append(case)

        await db.flush()
        return cases
