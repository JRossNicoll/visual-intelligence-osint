"""Redis connection management for real-time state and caching."""

import json
import logging
from typing import Any, Optional

import redis.asyncio as aioredis

from app.core.config import settings

logger = logging.getLogger(__name__)


class RedisManager:
    """Manages Redis connections and provides utility methods."""

    def __init__(self) -> None:
        self._redis: Optional[aioredis.Redis] = None

    async def connect(self) -> None:
        """Initialize the Redis connection pool."""
        try:
            self._redis = aioredis.from_url(
                settings.redis_url,
                encoding="utf-8",
                decode_responses=True,
                max_connections=50,
            )
            await self._redis.ping()
            logger.info("Redis connection established")
        except Exception as e:
            logger.warning("Redis connection failed: %s. Continuing without Redis.", e)
            self._redis = None

    async def disconnect(self) -> None:
        """Close the Redis connection."""
        if self._redis:
            await self._redis.close()
            logger.info("Redis connection closed")

    @property
    def client(self) -> Optional[aioredis.Redis]:
        return self._redis

    async def publish(self, channel: str, message: dict) -> None:
        """Publish a message to a Redis channel."""
        if self._redis:
            await self._redis.publish(channel, json.dumps(message))

    async def set_json(self, key: str, value: Any, ttl: Optional[int] = None) -> None:
        """Store a JSON-serializable value."""
        if self._redis:
            data = json.dumps(value)
            if ttl:
                await self._redis.setex(key, ttl, data)
            else:
                await self._redis.set(key, data)

    async def get_json(self, key: str) -> Optional[Any]:
        """Retrieve a JSON value."""
        if self._redis:
            data = await self._redis.get(key)
            if data:
                return json.loads(data)
        return None

    async def delete(self, key: str) -> None:
        """Delete a key."""
        if self._redis:
            await self._redis.delete(key)

    async def add_to_stream(self, stream: str, data: dict, maxlen: int = 10000) -> Optional[str]:
        """Add an entry to a Redis stream."""
        if self._redis:
            return await self._redis.xadd(stream, data, maxlen=maxlen)
        return None

    async def get_stream(
        self, stream: str, count: int = 100, last_id: str = "0-0"
    ) -> list[tuple[str, dict]]:
        """Read entries from a Redis stream."""
        if self._redis:
            return await self._redis.xrange(stream, min=last_id, count=count)
        return []


redis_manager = RedisManager()
