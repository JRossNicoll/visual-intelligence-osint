"""Alert management and notification service."""

import logging
from datetime import datetime, timezone
from typing import Optional

import httpx
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.redis import redis_manager
from app.models.alert import Alert

logger = logging.getLogger(__name__)


class AlertService:
    """Handles alert creation, delivery, and management."""

    @staticmethod
    async def create_alert(
        db: AsyncSession,
        alert_type: str,
        severity: str,
        title: str,
        description: Optional[str] = None,
        entity_id: Optional[str] = None,
        target_id: Optional[str] = None,
        stream_id: Optional[str] = None,
        confidence: Optional[float] = None,
        similarity_score: Optional[float] = None,
        frame_number: Optional[int] = None,
        thumbnail_path: Optional[str] = None,
        webhook_url: Optional[str] = None,
        metadata_json: Optional[dict] = None,
    ) -> Alert:
        """Create a new alert and trigger notifications."""
        alert = Alert(
            alert_type=alert_type,
            severity=severity,
            title=title,
            description=description,
            entity_id=entity_id,
            target_id=target_id,
            stream_id=stream_id,
            confidence=confidence,
            similarity_score=similarity_score,
            frame_number=frame_number,
            thumbnail_path=thumbnail_path,
            webhook_url=webhook_url,
            metadata_json=metadata_json,
        )
        db.add(alert)
        await db.flush()
        await db.refresh(alert)

        # Publish alert to Redis for WebSocket delivery
        await redis_manager.publish(
            "alerts",
            {
                "alert_id": alert.id,
                "alert_type": alert.alert_type,
                "severity": alert.severity,
                "title": alert.title,
                "entity_id": alert.entity_id,
                "target_id": alert.target_id,
                "stream_id": alert.stream_id,
                "similarity_score": alert.similarity_score,
                "timestamp": alert.created_at.isoformat(),
            },
        )

        # Deliver webhook if configured
        if webhook_url:
            await AlertService._deliver_webhook(alert)

        logger.info("Alert created: [%s] %s", alert.severity, alert.title)
        return alert

    @staticmethod
    async def get_alert(db: AsyncSession, alert_id: str) -> Optional[Alert]:
        """Get an alert by ID."""
        result = await db.execute(select(Alert).where(Alert.id == alert_id))
        return result.scalar_one_or_none()

    @staticmethod
    async def list_alerts(
        db: AsyncSession,
        alert_type: Optional[str] = None,
        severity: Optional[str] = None,
        is_read: Optional[bool] = None,
        is_acknowledged: Optional[bool] = None,
        entity_id: Optional[str] = None,
        target_id: Optional[str] = None,
        stream_id: Optional[str] = None,
        from_time: Optional[datetime] = None,
        to_time: Optional[datetime] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[Alert]:
        """List alerts with filtering."""
        conditions = []
        if alert_type:
            conditions.append(Alert.alert_type == alert_type)
        if severity:
            conditions.append(Alert.severity == severity)
        if is_read is not None:
            conditions.append(Alert.is_read == is_read)
        if is_acknowledged is not None:
            conditions.append(Alert.is_acknowledged == is_acknowledged)
        if entity_id:
            conditions.append(Alert.entity_id == entity_id)
        if target_id:
            conditions.append(Alert.target_id == target_id)
        if stream_id:
            conditions.append(Alert.stream_id == stream_id)
        if from_time:
            conditions.append(Alert.created_at >= from_time)
        if to_time:
            conditions.append(Alert.created_at <= to_time)

        query = select(Alert)
        if conditions:
            query = query.where(and_(*conditions))
        query = query.order_by(Alert.created_at.desc()).limit(limit).offset(offset)

        result = await db.execute(query)
        return list(result.scalars().all())

    @staticmethod
    async def acknowledge_alert(db: AsyncSession, alert_id: str) -> Optional[Alert]:
        """Acknowledge an alert."""
        alert = await AlertService.get_alert(db, alert_id)
        if not alert:
            return None

        alert.is_acknowledged = True
        alert.acknowledged_at = datetime.now(timezone.utc)
        alert.is_read = True
        await db.flush()
        await db.refresh(alert)
        return alert

    @staticmethod
    async def mark_as_read(db: AsyncSession, alert_id: str) -> Optional[Alert]:
        """Mark an alert as read."""
        alert = await AlertService.get_alert(db, alert_id)
        if not alert:
            return None

        alert.is_read = True
        await db.flush()
        await db.refresh(alert)
        return alert

    @staticmethod
    async def get_unread_count(db: AsyncSession) -> int:
        """Get count of unread alerts."""
        from sqlalchemy import func

        result = await db.execute(
            select(func.count(Alert.id)).where(Alert.is_read == False)  # noqa: E712
        )
        return result.scalar() or 0

    @staticmethod
    async def _deliver_webhook(alert: Alert) -> None:
        """Deliver an alert via webhook."""
        if not alert.webhook_url:
            return

        payload = {
            "alert_id": alert.id,
            "alert_type": alert.alert_type,
            "severity": alert.severity,
            "title": alert.title,
            "description": alert.description,
            "entity_id": alert.entity_id,
            "target_id": alert.target_id,
            "stream_id": alert.stream_id,
            "confidence": alert.confidence,
            "similarity_score": alert.similarity_score,
            "timestamp": alert.created_at.isoformat(),
        }

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(alert.webhook_url, json=payload)
                if response.status_code < 300:
                    alert.webhook_delivered = True
                    logger.info("Webhook delivered for alert %s", alert.id)
                else:
                    logger.warning(
                        "Webhook delivery failed for alert %s: %d",
                        alert.id,
                        response.status_code,
                    )
        except Exception as e:
            logger.error("Webhook delivery error for alert %s: %s", alert.id, e)
