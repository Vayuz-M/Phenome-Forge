"""
feedback_generator.py
Generates personalised pronunciation feedback using Groq (LLaMA-3).
Falls back to rule-based feedback if Groq is unavailable.
"""

import os
import logging
from groq import Groq

logger = logging.getLogger(__name__)

_groq_client = None

def get_groq_client():
    global _groq_client
    if _groq_client is None:
        api_key = os.getenv("GROQ_API_KEY", "")
        if api_key and api_key != "your_groq_api_key_here":
            _groq_client = Groq(api_key=api_key)
    return _groq_client


SYSTEM_PROMPT = """You are an expert speech coach and pronunciation specialist.
Your role is to give warm, encouraging, and highly specific pronunciation feedback.
Always structure your response in exactly this format:

SUMMARY: [1-2 sentences on overall performance]

STRENGTHS:
• [specific strength 1]
• [specific strength 2]

IMPROVEMENTS:
• [specific actionable tip 1]
• [specific actionable tip 2]
• [specific actionable tip 3]

PRACTICE TIP: [one memorable exercise or tip they can do right now]

Keep each bullet point concise (max 20 words). Be warm, specific, and motivating."""


def generate_ai_feedback(
    reference: str,
    spoken: str,
    scores: dict,
    word_diff: list,
) -> str:
    """Generate AI feedback via Groq. Falls back to rule-based if unavailable."""
    client = get_groq_client()

    missed_words = [d["word"] for d in word_diff if d["status"] == "missed"][:5]
    extra_words  = [d["word"] for d in word_diff if d["status"] == "extra"][:3]

    user_prompt = f"""Evaluate this pronunciation attempt:

Reference sentence: "{reference}"
What the user said: "{spoken}"

Scores:
- Overall pronunciation score: {scores['total']}/100
- Accuracy: {scores['accuracy']}/100
- Fluency: {scores['fluency']}/100  
- Completeness: {scores['completeness']}/100

Words missed or mispronounced: {missed_words if missed_words else 'none'}
Extra/substituted words: {extra_words if extra_words else 'none'}

Provide detailed pronunciation coaching feedback."""

    if client:
        try:
            response = client.chat.completions.create(
                model="llama3-8b-8192",
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user",   "content": user_prompt},
                ],
                max_tokens=500,
                temperature=0.7,
            )
            return response.choices[0].message.content.strip()
        except Exception as e:
            logger.warning(f"Groq API error: {e}. Using rule-based fallback.")

    return _rule_based_feedback(scores, missed_words, spoken, reference)


def _rule_based_feedback(scores: dict, missed_words: list, spoken: str, reference: str) -> str:
    """Deterministic fallback feedback based on score bands."""
    total = scores["total"]
    accuracy = scores["accuracy"]
    fluency  = scores["fluency"]

    if total >= 90:
        summary = "Excellent pronunciation! Your speech is clear, natural, and highly accurate."
        strengths = ["• Great word accuracy and pronunciation clarity", "• Natural pacing and rhythm throughout"]
        improvements = ["• Work on subtle intonation for an even more native-like delivery", "• Try shadowing native speakers to refine prosody", "• Practice connected speech — linking words smoothly"]
    elif total >= 75:
        summary = "Good pronunciation overall. You're clearly understandable with a few areas to polish."
        strengths = ["• Core pronunciation is solid and comprehensible", "• Good attempt at the full sentence"]
        improvements = [
            f"• Focus on these words: {', '.join(missed_words[:3]) if missed_words else 'all words were clear'}",
            "• Pay attention to syllable stress in longer words",
            "• Slow down slightly to improve clarity on consonant clusters"
        ]
    elif total >= 55:
        summary = "Fair attempt — the core message is understandable but needs more practice."
        strengths = ["• You attempted the full sentence", "• Some words were pronounced correctly"]
        improvements = [
            f"• Review these missed words carefully: {', '.join(missed_words[:4]) if missed_words else 'practice the full sentence again'}",
            "• Record yourself and compare to a native speaker",
            "• Break the sentence into smaller chunks and practice each part"
        ]
    else:
        summary = "Keep going — pronunciation takes consistent practice. You're on the right track!"
        strengths = ["• You attempted the exercise — that's the first step", "• Some recognisable words in your attempt"]
        improvements = [
            "• Start by practicing each word individually before the full sentence",
            "• Use a pronunciation dictionary to check each phoneme",
            "• Focus on mouth shape and tongue position for difficult sounds"
        ]

    fluency_tip = ""
    if fluency < 70:
        fluency_tip = "\nPRACTICE TIP: Read the sentence aloud 5 times at a comfortable pace, then gradually speed up while keeping every word clear."
    else:
        fluency_tip = "\nPRACTICE TIP: Record yourself saying this sentence, listen back, then try to match the rhythm of a native speaker."

    return f"""SUMMARY: {summary}

STRENGTHS:
{chr(10).join(strengths)}

IMPROVEMENTS:
{chr(10).join(improvements)}
{fluency_tip}"""
