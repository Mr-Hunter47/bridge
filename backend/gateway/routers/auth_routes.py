import logging
import uuid

from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel

from auth import hash_password, verify_password, create_access_token, get_current_user
from database import get_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["Authentication"])


# ── Request / Response Models ───────────────────────────────────

class RegisterRequest(BaseModel):
    username: str
    password: str
    profile_type: str = "general"  # general | deaf | blind | mute


class LoginRequest(BaseModel):
    username: str
    password: str


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    username: str


# ── POST /auth/register ────────────────────────────────────────

@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(body: RegisterRequest):
    """Create a new user account."""
    db = get_db()

    # Check if username already exists
    existing = db.table("users").select("id").eq("username", body.username).execute()
    if existing.data:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username already taken",
        )

    user_id = str(uuid.uuid4())
    password_hash = hash_password(body.password)

    db.table("users").insert({
        "id": user_id,
        "username": body.username,
        "password_hash": password_hash,
        "profile_type": body.profile_type,
    }).execute()

    logger.info(f"User registered: {body.username} ({user_id})")

    token = create_access_token(user_id, body.username)

    return {
        "access_token": token,
        "token_type": "bearer",
        "user_id": user_id,
        "username": body.username,
    }


# ── POST /auth/login ───────────────────────────────────────────

@router.post("/login")
async def login(body: LoginRequest):
    """Authenticate and return a JWT token."""
    db = get_db()

    result = db.table("users").select("*").eq("username", body.username).execute()
    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )

    user = result.data[0]

    if not verify_password(body.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )

    token = create_access_token(user["id"], user["username"])

    logger.info(f"User logged in: {user['username']}")

    return {
        "access_token": token,
        "token_type": "bearer",
        "user_id": user["id"],
        "username": user["username"],
    }


# ── GET /auth/me ────────────────────────────────────────────────

@router.get("/me")
async def me(current_user: dict = Depends(get_current_user)):
    """Return the current authenticated user's profile."""
    db = get_db()

    result = (
        db.table("users")
        .select("id, username, profile_type, public_key, created_at")
        .eq("id", current_user["user_id"])
        .execute()
    )

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    return result.data[0]
