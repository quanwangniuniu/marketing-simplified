"""Gemini API client — replaces Dify workflow calls.

All LLM inference in the agent pipeline now goes through this module.
The endpoint and key are read from settings / environment variables.
"""
import json
import logging
import os
import re

import requests
from django.conf import settings

logger = logging.getLogger(__name__)

GEMINI_MODEL = "gemini-2.5-flash-lite"
_GEMINI_BASE = "https://aiplatform.googleapis.com/v1/publishers/google/models"


def _get_api_key() -> str:
    return (
        getattr(settings, "GEMINI_API_KEY", "")
        or os.environ.get("GEMINI_API_KEY", "")
    )


def call_gemini(
    system_prompt: str,
    user_prompt: str,
    temperature: float = 0.3,
    timeout: int = 300,
) -> str:
    """Call Gemini and return the full text response as a string."""
    api_key = _get_api_key()
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is not configured")

    url = f"{_GEMINI_BASE}/{GEMINI_MODEL}:streamGenerateContent?key={api_key}"
    body = {
        "contents": [{"role": "user", "parts": [{"text": user_prompt}]}],
        "systemInstruction": {"parts": [{"text": system_prompt}]},
        "generationConfig": {"temperature": temperature},
    }

    logger.info(
        "Calling Gemini model=%s system_chars=%d user_chars=%d",
        GEMINI_MODEL,
        len(system_prompt),
        len(user_prompt),
    )

    response = requests.post(url, json=body, timeout=timeout, stream=True)
    response.raise_for_status()

    buffer = b""
    for chunk in response.iter_content(chunk_size=None):
        if chunk:
            buffer += chunk

    return _extract_text(buffer.decode("utf-8", errors="replace"))


def _extract_text(raw: str) -> str:
    """Concatenate all text parts from a Gemini streamGenerateContent response."""
    raw = raw.strip()
    try:
        responses = json.loads(raw)
        if not isinstance(responses, list):
            responses = [responses]
        parts = []
        for resp in responses:
            for candidate in resp.get("candidates", []):
                for part in candidate.get("content", {}).get("parts", []):
                    text = part.get("text", "")
                    if text:
                        parts.append(text)
        return "".join(parts).strip()
    except (json.JSONDecodeError, KeyError, TypeError):
        # Fallback: try SSE line-by-line
        parts = []
        for line in raw.splitlines():
            line = line.strip()
            if line.startswith("data:"):
                data = line[5:].strip()
                try:
                    obj = json.loads(data)
                    for candidate in obj.get("candidates", []):
                        for part in candidate.get("content", {}).get("parts", []):
                            text = part.get("text", "")
                            if text:
                                parts.append(text)
                except json.JSONDecodeError:
                    pass
        return "".join(parts).strip() or raw


def strip_json_fences(text: str) -> str:
    text = text.strip()
    text = re.sub(r"^```(?:json)?\n?", "", text)
    text = re.sub(r"\n?```$", "", text)
    return text.strip()


def call_gemini_json(
    system_prompt: str,
    user_prompt: str,
    temperature: float = 0.3,
    timeout: int = 300,
) -> dict:
    """Call Gemini and parse the response as JSON. Raises RuntimeError on failure."""
    text = call_gemini(
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        temperature=temperature,
        timeout=timeout,
    )
    clean = strip_json_fences(text)
    try:
        return json.loads(clean)
    except json.JSONDecodeError as exc:
        logger.error("Gemini returned non-JSON: %s...", clean[:300])
        raise RuntimeError(f"Gemini response is not valid JSON: {exc}") from exc
