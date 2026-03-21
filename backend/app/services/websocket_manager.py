"""WebSocket connection manager for real-time updates."""

import json
import logging
from typing import Any

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Manages WebSocket connections and broadcasts."""

    def __init__(self) -> None:
        # General connections (receive all updates)
        self.active_connections: list[WebSocket] = []
        # Stream-specific connections
        self.stream_connections: dict[str, list[WebSocket]] = {}
        # Alert connections
        self.alert_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket, channel: str = "general") -> None:
        """Accept and register a WebSocket connection."""
        await websocket.accept()

        if channel == "general":
            self.active_connections.append(websocket)
        elif channel == "alerts":
            self.alert_connections.append(websocket)
        elif channel.startswith("stream:"):
            stream_id = channel.split(":", 1)[1]
            if stream_id not in self.stream_connections:
                self.stream_connections[stream_id] = []
            self.stream_connections[stream_id].append(websocket)

        logger.info("WebSocket connected: channel=%s, total=%d", channel, self.total_connections)

    def disconnect(self, websocket: WebSocket, channel: str = "general") -> None:
        """Remove a WebSocket connection."""
        if channel == "general":
            if websocket in self.active_connections:
                self.active_connections.remove(websocket)
        elif channel == "alerts":
            if websocket in self.alert_connections:
                self.alert_connections.remove(websocket)
        elif channel.startswith("stream:"):
            stream_id = channel.split(":", 1)[1]
            if stream_id in self.stream_connections:
                if websocket in self.stream_connections[stream_id]:
                    self.stream_connections[stream_id].remove(websocket)
                if not self.stream_connections[stream_id]:
                    del self.stream_connections[stream_id]

        logger.info("WebSocket disconnected: channel=%s", channel)

    @property
    def total_connections(self) -> int:
        stream_count = sum(len(v) for v in self.stream_connections.values())
        return len(self.active_connections) + len(self.alert_connections) + stream_count

    async def broadcast(self, message: dict[str, Any]) -> None:
        """Broadcast a message to all general connections."""
        await self._send_to_list(self.active_connections, message)

    async def broadcast_to_stream(self, stream_id: str, message: dict[str, Any]) -> None:
        """Broadcast a message to all connections watching a specific stream."""
        connections = self.stream_connections.get(stream_id, [])
        await self._send_to_list(connections, message)
        # Also send to general connections
        await self._send_to_list(self.active_connections, message)

    async def broadcast_alert(self, message: dict[str, Any]) -> None:
        """Broadcast an alert to all alert connections and general connections."""
        await self._send_to_list(self.alert_connections, message)
        await self._send_to_list(self.active_connections, message)

    async def _send_to_list(
        self, connections: list[WebSocket], message: dict[str, Any]
    ) -> None:
        """Send a message to a list of WebSocket connections."""
        disconnected: list[WebSocket] = []
        data = json.dumps(message, default=str)

        for connection in connections:
            try:
                await connection.send_text(data)
            except Exception:
                disconnected.append(connection)

        # Clean up disconnected clients
        for conn in disconnected:
            if conn in connections:
                connections.remove(conn)


# Global singleton
ws_manager = ConnectionManager()
