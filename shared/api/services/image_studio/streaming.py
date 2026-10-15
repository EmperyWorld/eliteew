# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Image Studio SSE bridge: UGS queue/stream events → product finalize payloads.
# Invariants:
# - Comfy/Llama execution runs in queue worker (skip_queue removed for image_studio types).
# - API holds only lightweight SSE poll loop; no direct_inline Comfy wait on API worker.
# Related:
# - api/routers/image_studio_stream.py
# - documentation/product/IMAGE-STUDIO.md
# ---

from __future__ import annotations

import logging
from collections.abc import AsyncIterator, Awaitable, Callable
from typing import Any

from fastapi import HTTPException

from api.core.auth import User
from api.routers.creative_studio_utils import find_studio_ugs_idempotent_reuse
from api.routers.ugs.common import _sse_message
from api.services.ugs.unified_generation_service import UnifiedGenerationService
from api.services.unified_content.content_storage_service import ContentStorageService

logger = logging.getLogger(__name__)

IMAGE_STUDIO_SSE_HEADERS = {
    "Cache-Control": "no-cache, no-store, must-revalidate",
    "X-Accel-Buffering": "no",
    "Connection": "keep-alive",
}

_IN_PROGRESS_STATUSES = frozenset({"pending", "queued", "processing", "running", "in_progress", "retrying"})

FinalizeImageFn = Callable[[dict[str, Any]], Awaitable[dict[str, Any]]]
FinalizePromptFn = Callable[[dict[str, Any]], dict[str, str]]


async def iter_image_studio_generation_sse(
    *,
    ugs: UnifiedGenerationService,
    user: User,
    content_service: ContentStorageService,
    type_key: str,
    input_data: dict[str, Any],
    idempotency_key: str | None,
    finalize_image: FinalizeImageFn | None = None,
    finalize_prompt: FinalizePromptFn | None = None,
    poll_interval: float = 2.5,
    keep_alive_interval: float = 8.0,
) -> AsyncIterator[str]:
    """Yield SSE frames for one Image Studio generation (queued UGS worker path)."""
    user_id = str(user.id)

    try:
        if idempotency_key:
            reused = await find_studio_ugs_idempotent_reuse(
                ugs,
                user_id=user_id,
                type_key=type_key,
                idempotency_key=idempotency_key,
            )
            if reused is not None:
                status = str(reused.get("status") or "")
                if status == "completed":
                    product = await _finalize_from_ugs_payload(
                        reused,
                        user=user,
                        content_service=content_service,
                        finalize_image=finalize_image,
                        finalize_prompt=finalize_prompt,
                    )
                    yield _sse_message("result", product)
                    return
                if status in _IN_PROGRESS_STATUSES:
                    request_id = reused.get("request_id")
                    if request_id:
                        yield _sse_message(
                            "started",
                            {
                                "request_id": request_id,
                                "status": status,
                                "reused": True,
                                "idempotency_key": idempotency_key,
                            },
                        )
                        async for frame in _stream_until_product(
                            ugs=ugs,
                            request_id=str(request_id),
                            user_id=user_id,
                            user=user,
                            content_service=content_service,
                            finalize_image=finalize_image,
                            finalize_prompt=finalize_prompt,
                            poll_interval=poll_interval,
                            keep_alive_interval=keep_alive_interval,
                        ):
                            yield frame
                        return

        start_payload = await ugs.start_generation_for_stream(
            user_id=user_id,
            type_key=type_key,
            input_data=input_data,
            priority=5,
            idempotency_key=idempotency_key,
        )
    except ValueError as exc:
        yield _sse_message("error", {"error": str(exc), "code": "validation_error"})
        return
    except HTTPException as exc:
        detail = exc.detail
        if isinstance(detail, dict):
            yield _sse_message("error", detail)
        else:
            yield _sse_message("error", {"error": str(detail)})
        return
    except Exception as exc:  # noqa: BLE001
        logger.exception("Image Studio stream start failed type_key=%s", type_key)
        yield _sse_message("error", {"error": str(exc)})
        return

    if start_payload.get("status") == "completed":
        try:
            product = await _finalize_from_ugs_payload(
                start_payload,
                user=user,
                content_service=content_service,
                finalize_image=finalize_image,
                finalize_prompt=finalize_prompt,
            )
        except ValueError as exc:
            yield _sse_message("error", {"error": str(exc)})
            return
        yield _sse_message("result", product)
        return

    request_id = start_payload.get("request_id")
    if not request_id:
        yield _sse_message("error", {"error": "No request_id returned"})
        return

    yield _sse_message(
        "started",
        {
            "request_id": request_id,
            "status": start_payload.get("status", "processing"),
            "idempotency_key": idempotency_key,
        },
    )

    async for frame in _stream_until_product(
        ugs=ugs,
        request_id=str(request_id),
        user_id=user_id,
        user=user,
        content_service=content_service,
        finalize_image=finalize_image,
        finalize_prompt=finalize_prompt,
        poll_interval=poll_interval,
        keep_alive_interval=keep_alive_interval,
    ):
        yield frame


async def _stream_until_product(
    *,
    ugs: UnifiedGenerationService,
    request_id: str,
    user_id: str,
    user: User,
    content_service: ContentStorageService,
    finalize_image: FinalizeImageFn | None,
    finalize_prompt: FinalizePromptFn | None,
    poll_interval: float,
    keep_alive_interval: float,
) -> AsyncIterator[str]:
    try:
        async for event in ugs.stream_generation_events(
            request_id,
            user_id,
            poll_interval=poll_interval,
            keep_alive_interval=keep_alive_interval,
        ):
            event_type = str(event.get("event") or "progress")
            if event_type == "result":
                try:
                    product = await _finalize_from_ugs_payload(
                        event,
                        user=user,
                        content_service=content_service,
                        finalize_image=finalize_image,
                        finalize_prompt=finalize_prompt,
                    )
                except ValueError as exc:
                    yield _sse_message("error", {"error": str(exc), "request_id": request_id})
                    return
                yield _sse_message("result", product)
                return
            if event_type == "error":
                yield _sse_message("error", {**event, "request_id": request_id})
                return
            if event_type == "cancelled":
                yield _sse_message(
                    "error",
                    {
                        "error": str(event.get("progress_message") or "Generation cancelled"),
                        "code": "cancelled",
                        "request_id": request_id,
                    },
                )
                return
            yield _sse_message(event_type, event)
    except Exception as exc:  # noqa: BLE001
        logger.exception("Image Studio stream poll failed request_id=%s", request_id)
        yield _sse_message("error", {"error": str(exc), "request_id": request_id})


async def _finalize_from_ugs_payload(
    payload: dict[str, Any],
    *,
    user: User,
    content_service: ContentStorageService,
    finalize_image: FinalizeImageFn | None,
    finalize_prompt: FinalizePromptFn | None,
) -> dict[str, Any]:
    ugs_payload = payload
    if isinstance(payload.get("data"), dict):
        ugs_payload = payload["data"]
    elif isinstance(payload.get("result"), dict) and (
        "images" in payload["result"] or "result" in payload["result"] or "text" in payload["result"]
    ):
        ugs_payload = payload
    elif isinstance(payload.get("result"), dict):
        ugs_payload = {"result": payload["result"], "status": payload.get("status")}
    if finalize_prompt is not None:
        return finalize_prompt(ugs_payload)
    if finalize_image is None:
        msg = "Image finalize callback missing"
        raise ValueError(msg)
    return await finalize_image(ugs_payload)
