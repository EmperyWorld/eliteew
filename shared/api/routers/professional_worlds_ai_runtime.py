# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Professional Worlds text AI SSE helpers (UGS stream → professional artifact).
# Invariants:
# - No FastAPI route registration here — safe for unit tests without full router import.
# Related:
# - api/routers/professional_worlds_ai_streams.py
# - api/routers/professional_worlds_deps.py
# ---

from __future__ import annotations

import json
import logging
from collections.abc import AsyncGenerator
from typing import Any
from uuid import UUID

from api.routers.professional_worlds_deps import _sse
from api.services.professional_worlds.service import ProfessionalWorldsService
from api.services.ugs.unified_generation_service import UnifiedGenerationService

logger = logging.getLogger(__name__)


def _extract_result_text(event: dict[str, Any]) -> str:
    """Extract readable text from a UGS result event."""
    result = event.get("result")
    preview = event.get("result_preview")
    if isinstance(result, str):
        return result.strip()
    if isinstance(result, dict):
        for key in ("text", "content", "result", "output", "message"):
            value = result.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
        if isinstance(preview, str) and preview.strip():
            return preview.strip()
        if result:
            return json.dumps(result, ensure_ascii=False, default=str)
    if isinstance(preview, str) and preview.strip():
        return preview.strip()
    return ""


async def _stream_ugs_text_artifact(
    *,
    user_id: UUID,
    service: ProfessionalWorldsService,
    ugs_service: UnifiedGenerationService,
    type_key: str,
    prompt: str,
    recipe_key: str,
    artifact_title: str,
    source_type: str,
    source_id: UUID | None,
    idempotency_key: str | None,
) -> AsyncGenerator[str]:
    """Start a UGS stream and persist the final result as a professional artifact."""
    logger.info(
        "[STEP] professional_worlds.ai_sse start user_id=%s type_key=%s idempotency_key=%s",
        user_id,
        type_key,
        idempotency_key or "",
    )
    try:
        start_payload = await ugs_service.start_generation_for_stream(
            user_id=str(user_id),
            type_key=type_key,
            input_data=service.build_ugs_input(prompt),
            project_id=None,
            company_id=None,
            priority=5,
            idempotency_key=idempotency_key,
        )
    except ValueError as exc:
        logger.warning(
            "[STEP] professional_worlds.ai_sse fail user_id=%s type_key=%s error=%s",
            user_id,
            type_key,
            str(exc)[:240],
        )
        yield _sse("error", {"error": str(exc)})
        return

    if start_payload.get("status") == "completed":
        text_out = _extract_result_text(
            {"result": start_payload.get("result"), "result_preview": start_payload.get("result_preview")}
        )
        if not text_out:
            yield _sse("error", {"error": "UGS completed without result text"})
            return
        artifact = await service.save_artifact(
            user_id=user_id,
            source_type=source_type,
            source_id=source_id,
            recipe_key=recipe_key,
            title=artifact_title,
            content=text_out,
            artifact_data={"prompt": prompt, "stream": True},
        )
        yield _sse("result", {"text": text_out, "artifact": artifact})
        return

    request_id = start_payload.get("request_id")
    if not request_id:
        yield _sse("error", {"error": "UGS did not return request_id"})
        return

    yield _sse("started", {"request_id": request_id, "status": start_payload.get("status", "processing")})
    async for event in ugs_service.stream_generation_events(
        str(request_id), str(user_id), poll_interval=2.5, keep_alive_interval=2.0
    ):
        event_type = str(event.get("event") or "message")
        if event_type == "keep_alive":
            yield ": keep-alive\n\n"
            continue
        if event_type == "result":
            text_out = _extract_result_text(event)
            if not text_out:
                yield _sse("error", {"error": "UGS stream completed without result text"})
                return
            artifact = await service.save_artifact(
                user_id=user_id,
                source_type=source_type,
                source_id=source_id,
                recipe_key=recipe_key,
                title=artifact_title,
                content=text_out,
                artifact_data={"prompt": prompt, "stream": True},
                ugs_request_id=UUID(str(event.get("request_id"))) if event.get("request_id") else None,
            )
            yield _sse("result", {"text": text_out, "artifact": artifact})
            return
        if event_type == "error":
            yield _sse("error", {"error": event.get("error") or "UGS generation failed"})
            return
        yield _sse(event_type, event)
    yield _sse("error", {"error": "UGS stream finished without final result"})
