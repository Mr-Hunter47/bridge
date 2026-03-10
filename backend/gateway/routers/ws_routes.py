import logging
import json
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query

from auth import decode_access_token
from database import get_db

logger = logging.getLogger(__name__)

router = APIRouter(tags=["WebSocket"])


# ── Connection Manager ──────────────────────────────────────────

class ConnectionManager:
    """Manages active WebSocket connections, keyed by user_id."""

    def __init__(self):
        self.active_connections: dict[str, WebSocket] = {}

    async def connect(self, user_id: str, websocket: WebSocket):
        await websocket.accept()
        self.active_connections[user_id] = websocket
        logger.info(f"WebSocket connected: {user_id}")

    def disconnect(self, user_id: str):
        if user_id in self.active_connections:
            del self.active_connections[user_id]
            logger.info(f"WebSocket disconnected: {user_id}")

    async def send_to_user(self, user_id: str, message: dict):
        """Send a JSON message to a specific connected user."""
        ws = self.active_connections.get(user_id)
        if ws:
            await ws.send_json(message)

    def is_online(self, user_id: str) -> bool:
        return user_id in self.active_connections


manager = ConnectionManager()


# ── WebSocket Endpoint ──────────────────────────────────────────

@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token: str = Query(...),
):
    """
    JWT-authenticated WebSocket.

    Connect: ws://host/ws?token=<JWT>

    Message format (JSON):
    {
        "type": "message",
        "conversation_id": "uuid",
        "payload": "encrypted_message"
    }

    Server stores message and forwards to other conversation participants.
    """

    # ── Authenticate ────────────────────────────────────────────
    try:
        payload = decode_access_token(token)
        user_id = payload.get("sub")
        username = payload.get("username")
        if not user_id:
            await websocket.close(code=4001, reason="Invalid token payload")
            return
    except Exception:
        await websocket.close(code=4001, reason="Authentication failed")
        return

    await manager.connect(user_id, websocket)

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                await websocket.send_json({"error": "Invalid JSON"})
                continue

            msg_type = data.get("type", "message")
            conversation_id = data.get("conversation_id")
            msg_payload = data.get("payload", "")

            if not conversation_id:
                await websocket.send_json({"error": "conversation_id required"})
                continue

            # ── Persist message to database ─────────────────────
            db = get_db()
            message_id = str(uuid.uuid4())
            now = datetime.now(timezone.utc).isoformat()

            db.table("messages").insert({
                "id": message_id,
                "conversation_id": conversation_id,
                "sender_id": user_id,
                "message_type": msg_type,
                "encrypted_content": msg_payload,
            }).execute()

            # ── Forward to other participants ───────────────────
            members = (
                db.table("conversation_members")
                .select("user_id")
                .eq("conversation_id", conversation_id)
                .execute()
            )

            outgoing = {
                "type": msg_type,
                "id": message_id,
                "conversation_id": conversation_id,
                "sender_id": user_id,
                "sender_username": username,
                "payload": msg_payload,
                "created_at": now,
            }

            for member in members.data:
                recipient_id = member["user_id"]
                if recipient_id != user_id:
                    await manager.send_to_user(recipient_id, outgoing)

    except WebSocketDisconnect:
        manager.disconnect(user_id)
    except Exception as e:
        logger.error(f"WebSocket error for {user_id}: {e}")
        manager.disconnect(user_id)
