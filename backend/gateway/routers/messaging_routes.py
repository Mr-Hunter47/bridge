import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel
from typing import List, Optional

from auth import get_current_user
from database import get_db

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Messaging"])


# ── Request / Response Models ───────────────────────────────────

class CreateConversationRequest(BaseModel):
    participants: List[str]  # list of user_ids


class SendMessageRequest(BaseModel):
    conversation_id: str
    type: str = "text"  # text | audio | sign | speech | system
    content: str  # encrypted message blob


# ── POST /conversations ────────────────────────────────────────

@router.post("/conversations", status_code=status.HTTP_201_CREATED)
async def create_conversation(
    body: CreateConversationRequest,
    current_user: dict = Depends(get_current_user),
):
    """Create a conversation and add participants (including the creator)."""
    db = get_db()

    conversation_id = str(uuid.uuid4())

    # Create conversation
    db.table("conversations").insert({
        "id": conversation_id,
    }).execute()

    # Ensure the creator is always included
    all_participants = set(body.participants)
    all_participants.add(current_user["user_id"])

    # Add members
    members = [
        {"conversation_id": conversation_id, "user_id": uid}
        for uid in all_participants
    ]
    db.table("conversation_members").insert(members).execute()

    logger.info(
        f"Conversation {conversation_id} created by {current_user['username']} "
        f"with {len(all_participants)} members"
    )

    return {
        "id": conversation_id,
        "participants": list(all_participants),
    }


# ── GET /conversations ─────────────────────────────────────────

@router.get("/conversations")
async def list_conversations(current_user: dict = Depends(get_current_user)):
    """List all conversations for the current user."""
    db = get_db()

    # Get conversation IDs where user is a member
    memberships = (
        db.table("conversation_members")
        .select("conversation_id")
        .eq("user_id", current_user["user_id"])
        .execute()
    )

    if not memberships.data:
        return []

    conv_ids = [m["conversation_id"] for m in memberships.data]

    # Fetch conversation details
    conversations = (
        db.table("conversations")
        .select("*")
        .in_("id", conv_ids)
        .order("created_at", desc=True)
        .execute()
    )

    return conversations.data


# ── POST /messages ──────────────────────────────────────────────

@router.post("/messages", status_code=status.HTTP_201_CREATED)
async def send_message(
    body: SendMessageRequest,
    current_user: dict = Depends(get_current_user),
):
    """Store a message in the database."""
    db = get_db()

    # Verify sender is a member of the conversation
    membership = (
        db.table("conversation_members")
        .select("user_id")
        .eq("conversation_id", body.conversation_id)
        .eq("user_id", current_user["user_id"])
        .execute()
    )
    if not membership.data:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this conversation",
        )

    message_id = str(uuid.uuid4())

    message_row = {
        "id": message_id,
        "conversation_id": body.conversation_id,
        "sender_id": current_user["user_id"],
        "message_type": body.type,
        "encrypted_content": body.content,
    }

    db.table("messages").insert(message_row).execute()

    logger.info(
        f"Message {message_id} sent by {current_user['username']} "
        f"in conversation {body.conversation_id}"
    )

    return {
        "id": message_id,
        "conversation_id": body.conversation_id,
        "sender_id": current_user["user_id"],
        "message_type": body.type,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }


# ── GET /conversations/{id}/messages ────────────────────────────

@router.get("/conversations/{conversation_id}/messages")
async def get_messages(
    conversation_id: str,
    limit: int = 50,
    current_user: dict = Depends(get_current_user),
):
    """Fetch messages in a conversation, ordered by creation time."""
    db = get_db()

    # Verify user is a member
    membership = (
        db.table("conversation_members")
        .select("user_id")
        .eq("conversation_id", conversation_id)
        .eq("user_id", current_user["user_id"])
        .execute()
    )
    if not membership.data:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this conversation",
        )

    messages = (
        db.table("messages")
        .select("*")
        .eq("conversation_id", conversation_id)
        .order("created_at", desc=False)
        .limit(limit)
        .execute()
    )

    return messages.data
