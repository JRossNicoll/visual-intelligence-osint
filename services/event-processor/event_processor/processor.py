"""Event Processor - Consumes detection events from Redis Streams.

Processes detection events in both real-time and batch modes:
- Real-time: Processes individual detection events as they arrive
- Batch: Periodically runs full analysis on entities with sufficient data

The processor bridges the CV pipeline (detection events) with the
intelligence engine (pattern analysis, anomaly detection, etc.).
"""

import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import Optional

import httpx
import redis.asyncio as redis

from event_processor.config import settings

logger = logging.getLogger(__name__)


class EventProcessor:
    """Processes detection events from Redis Streams.

    Consumes events from the detection stream, transforms them into
    temporal events, and triggers intelligence analysis.
    """

    def __init__(self) -> None:
        """Initialize the event processor."""
        self.redis_client: Optional[redis.Redis] = None
        self.http_client: Optional[httpx.AsyncClient] = None
        self._running = False

    async def start(self) -> None:
        """Start the event processor."""
        logger.info("Starting event processor...")

        self.redis_client = redis.Redis(
            host=settings.redis_host,
            port=settings.redis_port,
            db=settings.redis_db,
            decode_responses=True,
        )

        self.http_client = httpx.AsyncClient(
            base_url=settings.backend_api_url,
            timeout=30.0,
        )

        # Create consumer group if it doesn't exist
        try:
            await self.redis_client.xgroup_create(
                settings.detection_stream,
                settings.consumer_group,
                id="0",
                mkstream=True,
            )
            logger.info("Created consumer group: %s", settings.consumer_group)
        except redis.ResponseError as e:
            if "BUSYGROUP" in str(e):
                logger.info("Consumer group already exists: %s", settings.consumer_group)
            else:
                raise

        self._running = True
        logger.info("Event processor started successfully.")

        # Run both real-time and batch processing
        await asyncio.gather(
            self._consume_events(),
            self._batch_analysis_loop(),
        )

    async def stop(self) -> None:
        """Stop the event processor."""
        self._running = False
        if self.http_client:
            await self.http_client.aclose()
        if self.redis_client:
            await self.redis_client.aclose()
        logger.info("Event processor stopped.")

    async def _consume_events(self) -> None:
        """Consume events from Redis Streams in real-time."""
        logger.info("Starting real-time event consumption...")

        while self._running:
            try:
                # Read from the stream
                messages = await self.redis_client.xreadgroup(
                    groupname=settings.consumer_group,
                    consumername=settings.consumer_name,
                    streams={settings.detection_stream: ">"},
                    count=settings.batch_size,
                    block=settings.block_ms,
                )

                if not messages:
                    continue

                for stream_name, entries in messages:
                    for entry_id, data in entries:
                        try:
                            await self._process_detection_event(data)
                            # Acknowledge the message
                            await self.redis_client.xack(
                                settings.detection_stream,
                                settings.consumer_group,
                                entry_id,
                            )
                        except Exception as e:
                            logger.error(
                                "Failed to process event %s: %s", entry_id, e
                            )

            except redis.ConnectionError:
                logger.warning("Redis connection lost, reconnecting in 5s...")
                await asyncio.sleep(5)
            except Exception as e:
                logger.error("Event consumption error: %s", e)
                await asyncio.sleep(1)

    async def _process_detection_event(self, data: dict) -> None:
        """Process a single detection event.

        Transforms a CV pipeline detection into a temporal event
        and stores it via the backend API.
        """
        try:
            # Extract event data
            entity_id = data.get("entity_id", "")
            stream_id = data.get("stream_id", "")
            timestamp_str = data.get("timestamp", "")
            confidence = float(data.get("confidence", 0.0))
            label = data.get("label", "")
            location_name = data.get("location_name", "")

            if not entity_id or not stream_id:
                return

            # Parse timestamp
            try:
                timestamp = datetime.fromisoformat(timestamp_str)
            except (ValueError, TypeError):
                timestamp = datetime.now(timezone.utc)

            # Create temporal event via backend API
            event_data = {
                "entity_id": entity_id,
                "stream_id": stream_id,
                "event_type": "appearance",
                "timestamp": timestamp.isoformat(),
                "confidence": confidence,
                "location_name": location_name,
                "hour_of_day": timestamp.hour,
                "day_of_week": timestamp.weekday(),
                "is_weekend": timestamp.weekday() >= 5,
            }

            # Parse co-occurring entities if present
            co_entities_str = data.get("co_occurring_entities", "")
            if co_entities_str:
                try:
                    event_data["co_occurring_entities"] = json.loads(co_entities_str)
                except (json.JSONDecodeError, TypeError):
                    pass

            # Parse duration if present
            duration = data.get("duration_seconds")
            if duration:
                try:
                    event_data["duration_seconds"] = float(duration)
                except (ValueError, TypeError):
                    pass

            # Store via backend API
            try:
                response = await self.http_client.post(
                    "/api/v1/intelligence/events",
                    json=event_data,
                )
                if response.status_code not in (200, 201):
                    logger.warning(
                        "Failed to store temporal event: %s", response.text
                    )
            except httpx.HTTPError as e:
                logger.warning("Backend API error: %s", e)

            # Publish to insight stream for downstream consumers
            await self.redis_client.xadd(
                settings.insight_stream,
                {
                    "type": "detection_processed",
                    "entity_id": entity_id,
                    "timestamp": timestamp.isoformat(),
                },
            )

        except Exception as e:
            logger.error("Error processing detection event: %s", e)

    async def _batch_analysis_loop(self) -> None:
        """Periodically trigger batch analysis for entities."""
        logger.info("Starting batch analysis loop (interval: %ds)...",
                     settings.analysis_interval_seconds)

        while self._running:
            try:
                await asyncio.sleep(settings.analysis_interval_seconds)

                # Trigger batch analysis via backend API
                try:
                    response = await self.http_client.post(
                        "/api/v1/intelligence/analyze-batch",
                        json={"min_events": settings.min_events_for_analysis},
                    )
                    if response.status_code == 200:
                        result = response.json()
                        analyzed = result.get("entities_analyzed", 0)
                        if analyzed > 0:
                            logger.info("Batch analysis completed: %d entities", analyzed)
                    else:
                        logger.warning("Batch analysis failed: %s", response.text)
                except httpx.HTTPError as e:
                    logger.debug("Batch analysis API error (backend may not be ready): %s", e)

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error("Batch analysis loop error: %s", e)
                await asyncio.sleep(10)


async def main() -> None:
    """Main entry point for the event processor."""
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )

    processor = EventProcessor()
    try:
        await processor.start()
    except KeyboardInterrupt:
        logger.info("Shutting down...")
    finally:
        await processor.stop()


if __name__ == "__main__":
    asyncio.run(main())
