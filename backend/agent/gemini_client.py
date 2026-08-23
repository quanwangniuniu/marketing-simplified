"""Gemini API client — replaces Dify workflow calls.

All LLM inference in the agent pipeline now goes through this module.
The endpoint and key are read from settings / environment variables.
"""
import json
import logging
import os
import re
import time

import requests
from django.conf import settings

from agent.log_redaction import redact_string

logger = logging.getLogger(__name__)

GEMINI_MODEL = "gemini-2.5-flash-lite"
_GEMINI_BASE = "https://aiplatform.googleapis.com/v1/projects/406201877905/locations/global/publishers/google/models"

# Retries for HTTP 429 (rate limit) before surfacing to callers.
_RATE_LIMIT_MAX_ATTEMPTS = 4
_RATE_LIMIT_BACKOFF_SECONDS = (2.0, 4.0, 8.0)


class GeminiRetriesExhausted(Exception):
    """Raised when Gemini's own HTTP 429 retries are exhausted."""
    pass


def _get_api_key() -> str:
    return (
        getattr(settings, "GEMINI_API_KEY", "")
        or os.environ.get("GEMINI_API_KEY", "")
    )


def _gemini_request_with_retry(
    url: str,
    body: dict,
    timeout: int = 300,
    stream: bool = False,
) -> requests.Response:
    """
    POST to a Gemini endpoint with exponential backoff on HTTP 429.
    Works for both streamGenerateContent (stream=True) and generateContent (stream=False).
    Raises RuntimeError on unrecoverable errors.
    """
    last_http_error: requests.exceptions.HTTPError | None = None
    for attempt in range(1, _RATE_LIMIT_MAX_ATTEMPTS + 1):
        try:
            response = requests.post(url, json=body, timeout=timeout, stream=stream)
            response.raise_for_status()
            return response
        except requests.exceptions.HTTPError as exc:
            last_http_error = exc
            status_code = exc.response.status_code if exc.response is not None else None
            if status_code == 429 and attempt < _RATE_LIMIT_MAX_ATTEMPTS:
                wait_seconds = _RATE_LIMIT_BACKOFF_SECONDS[
                    min(attempt - 1, len(_RATE_LIMIT_BACKOFF_SECONDS) - 1)
                ]
                logger.warning(
                    "Gemini rate-limited (429); retrying in %.1fs (attempt %s/%s)",
                    wait_seconds,
                    attempt + 1,
                    _RATE_LIMIT_MAX_ATTEMPTS,
                )
                time.sleep(wait_seconds)
                continue
            if status_code == 429:
                raise GeminiRetriesExhausted("Gemini rate limited (HTTP 429).") from exc
            raise RuntimeError(
                redact_string(f"Gemini request failed with HTTP {status_code or 'unknown'}.")
            ) from exc
        except requests.exceptions.RequestException as exc:
            raise RuntimeError(redact_string(f"Gemini network error: {exc}")) from exc
    raise GeminiRetriesExhausted("Gemini rate limited (HTTP 429).") from last_http_error


def call_gemini(
    system_prompt: str,
    user_prompt: str,
    temperature: float = 0.3,
    timeout: int = 300,
    response_mime_type: str | None = None,
) -> str:
    """Call Gemini via streamGenerateContent and return the full text response."""
    api_key = _get_api_key()
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is not configured")

    url = f"{_GEMINI_BASE}/{GEMINI_MODEL}:streamGenerateContent?key={api_key}"
    generation_config: dict = {"temperature": temperature}
    if response_mime_type:
        generation_config["responseMimeType"] = response_mime_type
    body = {
        "contents": [{"role": "user", "parts": [{"text": user_prompt}]}],
        "systemInstruction": {"parts": [{"text": system_prompt}]},
        "generationConfig": generation_config,
    }

    logger.info(
        "Calling Gemini model=%s system_chars=%d user_chars=%d",
        GEMINI_MODEL,
        len(system_prompt),
        len(user_prompt),
    )

    response = _gemini_request_with_retry(url, body, timeout=timeout, stream=True)
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


def _extract_json_block(text: str) -> str:
    """Extract the first complete {...} or [...] block from text."""
    for start_char, end_char in [('{', '}'), ('[', ']')]:
        start = text.find(start_char)
        if start == -1:
            continue
        depth = 0
        in_string = False
        escape = False
        for i, ch in enumerate(text[start:], start):
            if escape:
                escape = False
                continue
            if ch == '\\' and in_string:
                escape = True
                continue
            if ch == '"':
                in_string = not in_string
                continue
            if in_string:
                continue
            if ch == start_char:
                depth += 1
            elif ch == end_char:
                depth -= 1
                if depth == 0:
                    return text[start:i + 1]
    return text


def call_gemini_json(
    system_prompt: str,
    user_prompt: str,
    temperature: float = 0.3,
    timeout: int = 300,
    _attempt: int = 1,
    _max_attempts: int = 3,
) -> dict:
    """Call Gemini and parse the response as JSON. Raises RuntimeError on failure."""
    text = call_gemini(
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        temperature=temperature,
        timeout=timeout,
        response_mime_type="application/json",
    )
    clean = strip_json_fences(text)
    try:
        return json.loads(clean)
    except json.JSONDecodeError:
        extracted = _extract_json_block(clean)
        try:
            return json.loads(extracted)
        except json.JSONDecodeError as exc:
            logger.error("Gemini returned non-JSON: %s...", clean[:300])
            if _attempt < _max_attempts:
                wait_seconds = min(1.5 * _attempt, 3.0)
                logger.warning(
                    "Retrying Gemini call after JSON parse failure (attempt %s/%s, wait %.1fs)",
                    _attempt + 1,
                    _max_attempts,
                    wait_seconds,
                )
                time.sleep(wait_seconds)
                return call_gemini_json(
                    system_prompt=system_prompt,
                    user_prompt=user_prompt,
                    temperature=temperature,
                    timeout=timeout,
                    _attempt=_attempt + 1,
                    _max_attempts=_max_attempts,
                )
            raise RuntimeError(
                "Gemini returned malformed output. Please retry generation."
            ) from exc
