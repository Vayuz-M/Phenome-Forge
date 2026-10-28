"""
main.py — Phoneme Forge
FastAPI backend: audio upload, transcription, scoring, feedback.
"""

import os
import uuid
import logging
import tempfile
import shutil
from pathlib import Path
from contextlib import asynccontextmanager

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv

load_dotenv()

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)

# ── In-memory session store ───────────────────────────────────────────────────
sessions: dict = {}


# ── Lifespan ──────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🎙  Phoneme Forge starting…")
    # Pre-warm Whisper model in background
    try:
        from pronunciation_service import get_whisper_model
        get_whisper_model()
        logger.info("✅ Whisper model ready.")
    except Exception as e:
        logger.warning(f"Whisper pre-warm failed (will load on first request): {e}")
    yield
    logger.info("🛑 Server shutting down.")


# ── App ────────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Phoneme Forge",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Uploads temp dir ──────────────────────────────────────────────────────────
UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)


# ══════════════════════════════════════════════════════════════════════════════
# API ROUTES
# ══════════════════════════════════════════════════════════════════════════════

@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "Phoneme Forge"}


@app.get("/api/reference-sentences")
async def get_reference_sentences():
    """Return the list of practice sentences."""
    return {
        "sentences": [
            "Speech therapy helps people improve communication.",
            "The quick brown fox jumps over the lazy dog.",
            "She sells seashells by the seashore.",
            "How much wood would a woodchuck chuck?",
            "Peter Piper picked a peck of pickled peppers.",
            "The weather outside is frightful but the fire is delightful.",
            "Artificial intelligence is transforming the modern world.",
            "Practice makes perfect when learning a new language.",
            "Beautiful flowers bloom in the spring sunshine.",
            "Technology connects people across the entire globe.",
        ]
    }


@app.post("/api/record-audio")
async def record_audio(
    audio: UploadFile = File(...),
    session_id: str = Form(default=""),
):
    """
    Accept a recorded audio file, save it, return a session_id.
    """
    if not session_id:
        session_id = str(uuid.uuid4())

    # Validate content type
    allowed = {"audio/wav", "audio/webm", "audio/ogg", "audio/mpeg", "audio/mp4",
               "audio/x-wav", "audio/wave", "application/octet-stream"}
    ct = (audio.content_type or "").lower()

    suffix = ".webm"
    if "wav" in ct:     suffix = ".wav"
    elif "mp4" in ct:   suffix = ".mp4"
    elif "ogg" in ct:   suffix = ".ogg"

    save_path = UPLOAD_DIR / f"{session_id}{suffix}"
    with open(save_path, "wb") as f:
        shutil.copyfileobj(audio.file, f)

    file_size = save_path.stat().st_size
    if file_size < 100:
        save_path.unlink(missing_ok=True)
        raise HTTPException(400, "Audio file is too small or empty.")

    sessions[session_id] = {
        "audio_path": str(save_path),
        "transcription": None,
        "scores": None,
        "feedback": None,
    }

    logger.info(f"Audio saved: {save_path} ({file_size} bytes) — session {session_id}")
    return {"session_id": session_id, "file_size": file_size, "status": "received"}


@app.post("/api/analyze-pronunciation")
async def analyze_pronunciation(
    session_id: str = Form(...),
    reference: str = Form(...),
):
    """
    Full pipeline:
    1. Transcribe audio with Whisper
    2. Calculate similarity + scores
    3. Generate AI feedback
    Returns complete analysis.
    """
    if session_id not in sessions:
        raise HTTPException(404, f"Session '{session_id}' not found. Please record audio first.")

    session = sessions[session_id]
    audio_path = session["audio_path"]

    if not Path(audio_path).exists():
        raise HTTPException(404, "Audio file not found. Please re-record.")

    # ── Step 1: Transcribe ────────────────────────────────────────────────────
    logger.info(f"[{session_id}] Transcribing…")
    try:
        from pronunciation_service import transcribe_audio
        transcription = transcribe_audio(audio_path)
        spoken_text = transcription["text"]
        segments    = transcription["segments"]
        logger.info(f"[{session_id}] Transcribed: '{spoken_text[:80]}'")
    except Exception as e:
        import traceback
        logger.error(f"Transcription error: {e}")
        logger.error(traceback.format_exc())
        raise HTTPException(500, f"Transcription failed: {str(e)}")

    if not spoken_text:
        return JSONResponse({
            "session_id": session_id,
            "spoken_text": "",
            "reference": reference,
            "scores": {"total": 0, "accuracy": 0, "fluency": 0, "completeness": 0, "similarity_raw": 0},
            "feedback": "SUMMARY: No speech detected in your recording.\n\nIMPROVEMENTS:\n• Make sure your microphone is working\n• Speak clearly into the microphone\n• Check browser microphone permissions\n\nPRACTICE TIP: Try recording again in a quiet environment.",
            "word_diff": [],
        })

    # ── Step 2: Score ─────────────────────────────────────────────────────────
    from pronunciation_service import calculate_similarity, calculate_pronunciation_score, word_diff
    similarity = calculate_similarity(reference, spoken_text)
    scores     = calculate_pronunciation_score(similarity, segments)
    diff       = word_diff(reference, spoken_text)
    logger.info(f"[{session_id}] Score: {scores['total']}/100 (similarity: {similarity})")

    # ── Step 3: Feedback ──────────────────────────────────────────────────────
    from feedback_generator import generate_ai_feedback
    feedback = generate_ai_feedback(reference, spoken_text, scores, diff)

    # Cache in session
    session.update({
        "transcription": spoken_text,
        "scores": scores,
        "feedback": feedback,
        "reference": reference,
    })

    # Clean up audio file
    try:
        Path(audio_path).unlink(missing_ok=True)
    except Exception:
        pass

    return {
        "session_id": session_id,
        "spoken_text": spoken_text,
        "reference": reference,
        "scores": scores,
        "feedback": feedback,
        "word_diff": diff,
    }


@app.get("/api/score/{session_id}")
async def get_score(session_id: str):
    """Retrieve cached score for a session."""
    if session_id not in sessions:
        raise HTTPException(404, "Session not found.")
    s = sessions[session_id]
    if not s.get("scores"):
        raise HTTPException(400, "Analysis not yet complete for this session.")
    return {
        "session_id": session_id,
        "scores": s["scores"],
        "transcription": s["transcription"],
        "feedback": s["feedback"],
        "reference": s.get("reference", ""),
    }


# ══════════════════════════════════════════════════════════════════════════════
# STATIC FILE SERVING
# ══════════════════════════════════════════════════════════════════════════════

frontend_path = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "frontend")
)

if os.path.isdir(frontend_path):

    @app.get("/", include_in_schema=False)
    async def serve_index():
        return FileResponse(os.path.join(frontend_path, "index.html"))

    @app.get("/login", include_in_schema=False)
    async def serve_login():
        return FileResponse(os.path.join(frontend_path, "login.html"))

    @app.get("/app", include_in_schema=False)
    async def serve_app():
        return FileResponse(os.path.join(frontend_path, "app.html"))

    # Mount static LAST
    app.mount("/", StaticFiles(directory=frontend_path), name="static")


# ── Run ────────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
