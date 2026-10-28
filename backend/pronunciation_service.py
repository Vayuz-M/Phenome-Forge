"""
pronunciation_service.py
Handles Whisper transcription and pronunciation scoring.
"""

import os
import re
import tempfile
import logging
import numpy as np
from difflib import SequenceMatcher
from pathlib import Path

logger = logging.getLogger(__name__)

_whisper_model = None

def get_whisper_model():
    global _whisper_model
    if _whisper_model is None:
        import whisper
        model_name = os.getenv("WHISPER_MODEL", "base")
        cache_dir = os.getenv("WHISPER_CACHE", os.path.join(os.path.dirname(__file__), "whisper_cache"))
        os.makedirs(cache_dir, exist_ok=True)
        logger.info(f"Loading Whisper model: {model_name} (cache: {cache_dir})")
        _whisper_model = whisper.load_model(model_name, download_root=cache_dir)
        logger.info("Whisper model loaded.")
    return _whisper_model


def normalize_text(text: str) -> str:
    """Lowercase, strip punctuation, collapse whitespace."""
    text = text.lower()
    text = re.sub(r"[^\w\s']", "", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def transcribe_audio(audio_path: str) -> dict:
    """
    Transcribe an audio file using OpenAI Whisper.
    Returns a dict with 'text' and 'segments'.
    """
    model = get_whisper_model()
    result = model.transcribe(audio_path, language="en", fp16=False)
    return {
        "text": result.get("text", "").strip(),
        "segments": result.get("segments", []),
        "language": result.get("language", "en"),
    }


def calculate_similarity(reference: str, spoken: str) -> float:
    """
    Calculate normalized similarity between reference and spoken text.
    Uses SequenceMatcher for character-level similarity.
    Returns a float between 0 and 1.
    """
    ref_norm = normalize_text(reference)
    spk_norm = normalize_text(spoken)

    if not ref_norm or not spk_norm:
        return 0.0

    # Character-level similarity
    char_sim = SequenceMatcher(None, ref_norm, spk_norm).ratio()

    # Word-level similarity
    ref_words = ref_norm.split()
    spk_words = spk_norm.split()
    word_sim = SequenceMatcher(None, ref_words, spk_words).ratio()

    # Word coverage: how many reference words appear in spoken
    ref_set = set(ref_words)
    spk_set = set(spk_words)
    coverage = len(ref_set & spk_set) / max(len(ref_set), 1)

    # Weighted combination
    similarity = (char_sim * 0.35) + (word_sim * 0.45) + (coverage * 0.20)
    return round(min(similarity, 1.0), 4)


def calculate_pronunciation_score(similarity: float, segments: list) -> dict:
    """
    Convert similarity score to a 0-100 pronunciation score.
    Also computes sub-scores for fluency, accuracy, completeness.
    """
    # Base score from similarity
    base = similarity * 100

    # Fluency bonus: reward longer, more fluid speech (many segments = more pauses)
    fluency_penalty = 0
    if segments:
        avg_pause = 0
        for i in range(1, len(segments)):
            gap = segments[i].get("start", 0) - segments[i - 1].get("end", 0)
            avg_pause += max(gap, 0)
        if len(segments) > 1:
            avg_pause /= (len(segments) - 1)
        # Penalise if average pause > 0.8s
        if avg_pause > 0.8:
            fluency_penalty = min((avg_pause - 0.8) * 8, 12)

    fluency_score = max(0, 100 - fluency_penalty)

    # Accuracy = similarity-based
    accuracy_score = base

    # Completeness: penalise if spoken is much shorter than reference (handled in similarity)
    completeness_score = min(similarity * 110, 100)  # slight boost

    # Final weighted score
    final = (accuracy_score * 0.55) + (fluency_score * 0.25) + (completeness_score * 0.20)
    final = round(max(0, min(final, 100)))

    return {
        "total": final,
        "accuracy": round(accuracy_score),
        "fluency": round(fluency_score),
        "completeness": round(completeness_score),
        "similarity_raw": similarity,
    }


def word_diff(reference: str, spoken: str) -> list:
    """
    Produce a word-level diff between reference and spoken text.
    Returns list of dicts: {word, status} where status is 'correct'|'missed'|'extra'
    """
    ref_words = normalize_text(reference).split()
    spk_words = normalize_text(spoken).split()

    matcher = SequenceMatcher(None, ref_words, spk_words)
    diff = []

    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag == "equal":
            for w in ref_words[i1:i2]:
                diff.append({"word": w, "status": "correct"})
        elif tag == "replace":
            for w in ref_words[i1:i2]:
                diff.append({"word": w, "status": "missed"})
            for w in spk_words[j1:j2]:
                diff.append({"word": w, "status": "extra"})
        elif tag == "delete":
            for w in ref_words[i1:i2]:
                diff.append({"word": w, "status": "missed"})
        elif tag == "insert":
            for w in spk_words[j1:j2]:
                diff.append({"word": w, "status": "extra"})

    return diff
