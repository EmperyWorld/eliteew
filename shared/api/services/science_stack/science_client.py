# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# HTTP client for queue-worker science stack sidecar — used by stack0-api only.
# Invariants:
# - Never imports scipy/sklearn/opencv/pandas; degrades gracefully when sidecar is down.
# Related:
# - api/core/unified_config.py (science_stack_service_url)
# ---
from __future__ import annotations

import base64
import logging
from typing import Any

import httpx

from api.core.unified_config import unified_settings
from api.services.science_stack.science_contracts import (
    MergeWavChunksRequest,
    MergeWavChunksResponse,
    SemanticAnalyzeRequest,
    SemanticAnalyzeResponse,
)

logger = logging.getLogger(__name__)

DEFAULT_SCIENCE_TIMEOUT_SEC = 120.0


class ScienceStackUnavailableError(RuntimeError):
    """Raised when the science stack sidecar is unreachable."""


def science_stack_service_url() -> str:
    explicit = (unified_settings.science_stack_service_url or "").strip().rstrip("/")
    if explicit:
        return explicit
    host = (unified_settings.science_stack_worker_host or "").strip() or "stack0-eliteew-api-worker-prod"
    port = unified_settings.science_stack_service_port
    return f"http://{host}:{port}"


async def request_semantic_analyze(text: str, *, max_features: int = 20) -> dict[str, Any] | None:
    """POST semantic analysis to sidecar; returns None when sidecar is unavailable."""
    base_url = science_stack_service_url()
    if not base_url:
        return None

    payload = SemanticAnalyzeRequest(text=text, max_features=max_features)
    url = f"{base_url}/v1/science/semantic-analyze"
    try:
        async with httpx.AsyncClient(timeout=DEFAULT_SCIENCE_TIMEOUT_SEC) as client:
            response = await client.post(url, json=payload.model_dump())
            response.raise_for_status()
            body = SemanticAnalyzeResponse.model_validate(response.json())
    except httpx.HTTPError as exc:
        logger.debug("[STEP] science_stack_semantic_http_skip url=%s err=%s", url, exc)
        return None

    return body.model_dump()


async def request_merge_wav_chunks(chunks: list[bytes], *, pause_seconds: float = 0.1) -> bytes | None:
    """POST WAV merge job to sidecar; returns None when sidecar is unavailable."""
    base_url = science_stack_service_url()
    if not base_url or not chunks:
        return None

    payload = MergeWavChunksRequest(
        chunks_base64=[base64.b64encode(chunk).decode("ascii") for chunk in chunks],
        pause_seconds=pause_seconds,
    )
    url = f"{base_url}/v1/science/merge-wav-chunks"
    try:
        async with httpx.AsyncClient(timeout=DEFAULT_SCIENCE_TIMEOUT_SEC) as client:
            response = await client.post(url, json=payload.model_dump())
            response.raise_for_status()
            body = MergeWavChunksResponse.model_validate(response.json())
    except httpx.HTTPError as exc:
        logger.warning("[STEP] science_stack_wav_merge_http_fail url=%s err=%s", url, exc)
        return None

    return base64.b64decode(body.wav_base64)
