import os
from dotenv import load_dotenv

load_dotenv()

# ── Microservice Endpoints ──────────────────────────────────────
# Input Layer
STT_URL = os.getenv("STT_URL", "http://localhost:8002/speech-to-text")

# AI Processing Layer
SLR_URL = os.getenv("SLR_URL", "http://localhost:8006/generate-transcript")

# Output Layer
TTS_URL = os.getenv("TTS_URL", "http://localhost:8001/generate-speech")
AVATAR_URL = os.getenv("AVATAR_URL", "http://localhost:5000/generate-sign-video")

# Internal microservice auth token
AUTH_TOKEN = os.getenv("AUTH_TOKEN", "bridge-dev-token-123")
HEADERS = {
    "Authorization": f"Bearer {AUTH_TOKEN}"
}

# ── Server ──────────────────────────────────────────────────────
PORT = int(os.getenv("PORT", "8000"))

# ── Supabase ────────────────────────────────────────────────────
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")

# ── JWT ─────────────────────────────────────────────────────────
JWT_SECRET = os.getenv("JWT_SECRET", "bridge-jwt-secret-change-in-production")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
JWT_EXPIRE_MINUTES = int(os.getenv("JWT_EXPIRE_MINUTES", "15"))
