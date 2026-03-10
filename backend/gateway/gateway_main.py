import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

import config
from routers import ai_routes, auth_routes, messaging_routes, ws_routes

# ── Logging ─────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s"
)
logger = logging.getLogger(__name__)

# ── FastAPI App ─────────────────────────────────────────────────

app = FastAPI(
    title="Bridge Platform Gateway API",
    description="Central router for the Bridge accessible messaging platform.",
    version="3.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Health Check ────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "service": "gateway", "version": "3.0.0"}

# ── Routers ─────────────────────────────────────────────────────

app.include_router(ai_routes.router)        # /api/*
app.include_router(auth_routes.router)       # /auth/*
app.include_router(messaging_routes.router)  # /conversations, /messages
app.include_router(ws_routes.router)         # /ws

# ── Run ─────────────────────────────────────────────────────────

if __name__ == "__main__":
    uvicorn.run("gateway_main:app", host="0.0.0.0", port=config.PORT, reload=False)
