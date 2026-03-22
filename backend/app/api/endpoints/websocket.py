"""WebSocket endpoints for real-time updates."""

import json
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.services.websocket_manager import ws_manager

logger = logging.getLogger(__name__)

router = APIRouter(tags=["websocket"])


@router.websocket("/ws")
async def websocket_general(websocket: WebSocket) -> None:
    """General WebSocket endpoint for all real-time updates."""
    await ws_manager.connect(websocket, "general")
    try:
        while True:
            data = await websocket.receive_text()
            # Handle client messages (e.g., subscribe to specific streams)
            try:
                msg = json.loads(data)
                msg_type = msg.get("type")

                if msg_type == "ping":
                    await websocket.send_text(json.dumps({"type": "pong"}))
                elif msg_type == "subscribe_stream":
                    stream_id = msg.get("stream_id")
                    if stream_id:
                        await ws_manager.connect(websocket, f"stream:{stream_id}", accept=False)
                        await websocket.send_text(
                            json.dumps(
                                {
                                    "type": "subscribed",
                                    "channel": f"stream:{stream_id}",
                                }
                            )
                        )
            except json.JSONDecodeError:
                pass
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket, "general")


@router.websocket("/ws/stream/{stream_id}")
async def websocket_stream(websocket: WebSocket, stream_id: str) -> None:
    """WebSocket endpoint for stream-specific real-time updates."""
    channel = f"stream:{stream_id}"
    await ws_manager.connect(websocket, channel)
    try:
        while True:
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
                if msg.get("type") == "ping":
                    await websocket.send_text(json.dumps({"type": "pong"}))
            except json.JSONDecodeError:
                pass
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket, channel)


@router.websocket("/ws/alerts")
async def websocket_alerts(websocket: WebSocket) -> None:
    """WebSocket endpoint for alert notifications."""
    await ws_manager.connect(websocket, "alerts")
    try:
        while True:
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
                if msg.get("type") == "ping":
                    await websocket.send_text(json.dumps({"type": "pong"}))
            except json.JSONDecodeError:
                pass
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket, "alerts")
