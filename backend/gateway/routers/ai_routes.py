import logging

import httpx
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import JSONResponse

import config

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["AI Services"])

# ── Speech-to-Text ──────────────────────────────────────────────

@router.post("/speech-to-text")
async def speech_to_text(audio: UploadFile = File(...)):
    """Convert Audio to Pivot Text"""
    try:
        audio_content = await audio.read()
        files = {"audio": (audio.filename, audio_content, audio.content_type)}
        async with httpx.AsyncClient(timeout=180.0) as client:
            stt_res = await client.post(config.STT_URL, headers=config.HEADERS, files=files)
            if stt_res.status_code != 200:
                raise HTTPException(status_code=stt_res.status_code, detail=f"STT Service Error: {stt_res.text}")
            return JSONResponse(content=stt_res.json())
    except httpx.RequestError as e:
        logger.error(f"STT microservice connection failed: {e}")
        raise HTTPException(status_code=503, detail=f"Microservice connection failed: {str(e)}")
    except Exception as e:
        logger.error(f"STT proxy error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ── Sign-to-Text ────────────────────────────────────────────────

@router.post("/sign-to-text")
async def sign_to_text(video: UploadFile = File(...)):
    """Convert Video to Pivot Text via inference_simple (port 8006)"""
    try:
        video_content = await video.read()
        files = {"file": (video.filename, video_content, video.content_type)}
        async with httpx.AsyncClient(timeout=180.0) as client:
            slr_res = await client.post(config.SLR_URL, files=files)
            if slr_res.status_code != 200:
                raise HTTPException(status_code=slr_res.status_code, detail=f"SLR Service Error: {slr_res.text}")
            result = slr_res.json()
            return JSONResponse(content={
                "status": result.get("status", "success"),
                "transcribed_text": result.get("transcript", ""),
                "confidence": 0.95,
                "language": "en"
            })
    except httpx.RequestError as e:
        logger.error(f"SLR microservice connection failed: {e}")
        raise HTTPException(status_code=503, detail=f"Microservice connection failed: {str(e)}")
    except Exception as e:
        logger.error(f"SLR proxy error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ── Text-to-Sign ────────────────────────────────────────────────

@router.post("/text-to-sign")
async def text_to_sign(text: str = Form(...)):
    """Proxy directly to Avatar API"""
    try:
        async with httpx.AsyncClient(timeout=180.0) as client:
            avatar_res = await client.post(config.AVATAR_URL, headers=config.HEADERS, json={"text": text})
            if avatar_res.status_code != 200:
                raise HTTPException(status_code=avatar_res.status_code, detail=f"Avatar Service Error: {avatar_res.text}")
            return JSONResponse(content=avatar_res.json())
    except httpx.RequestError as e:
        logger.error(f"Avatar microservice connection failed: {e}")
        raise HTTPException(status_code=503, detail=f"Microservice connection failed: {str(e)}")

# ── Text-to-Speech ──────────────────────────────────────────────

@router.post("/text-to-speech")
async def text_to_speech(text: str = Form(...)):
    """Proxy directly to TTS API"""
    try:
        async with httpx.AsyncClient(timeout=180.0) as client:
            tts_res = await client.post(config.TTS_URL, headers=config.HEADERS, json={"text": text})
            if tts_res.status_code != 200:
                raise HTTPException(status_code=tts_res.status_code, detail=f"TTS Service Error: {tts_res.text}")
            return JSONResponse(content=tts_res.json())
    except httpx.RequestError as e:
        logger.error(f"TTS microservice connection failed: {e}")
        raise HTTPException(status_code=503, detail=f"Microservice connection failed: {str(e)}")
