# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Image Studio SSE generation routes (UGS queue worker; API does not block on Comfy).
# Invariants:
# - Finalize + unified content persist on terminal SSE result event.
# Related:
# - api/services/image_studio/streaming.py
# - documentation/product/IMAGE-STUDIO.md
# ---

from __future__ import annotations

import base64
import logging
from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import StreamingResponse  # type: ignore[import-untyped]

from api.core.auth import User
from api.core.oauth2_auth import require_oauth2_user
from api.routers.creative_studio_utils import (
    build_image_edit_input_data,
    decode_base64_image,
    validate_image_bytes,
)
from api.routers.image_studio import (
    MAX_IMAGE_BYTES,
    ImageEditJsonRequest,
    SuggestImagePromptRequest,
    TextToImageRequest,
    _b64_from_bytes,
)
from api.routers.ugs.deps import _idempotency_key_from_body_or_headers, get_ugs_service
from api.routers.unified_content import get_content_service
from api.services.image_studio.response_finalize import (
    finalize_image_response,
    finalize_suggest_prompt_response,
    sanitize_image_prompt_text,
)
from api.services.image_studio.rotate_modes import (
    ROTATE_MODE_ALL,
    rotate_mode_label,
    validate_rotate_mode,
)
from api.services.image_studio.streaming import (
    IMAGE_STUDIO_SSE_HEADERS,
    iter_image_studio_generation_sse,
)
from api.services.ugs.unified_generation_service import UnifiedGenerationService
from api.services.unified_content.content_storage_service import ContentStorageService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/image-studio", tags=["Image Studio - SSE generation"])


def _datetime_str() -> str:
    return datetime.now(UTC).strftime("%Y%m%d_%H%M%S")


def _streaming_response(
    *,
    ugs: UnifiedGenerationService,
    user: User,
    content_service: ContentStorageService,
    type_key: str,
    input_data: dict[str, Any],
    idempotency_key: str | None,
    finalize_image_meta: dict[str, Any] | None = None,
    prompt_finalize: bool = False,
) -> StreamingResponse:
    async def finalize_image(ugs_payload: dict[str, Any]) -> dict[str, Any]:
        meta = finalize_image_meta or {}
        try:
            return await finalize_image_response(
                resp=ugs_payload,
                content_service=content_service,
                user=user,
                default_filename=str(meta.get("default_filename") or "image.png"),
                name=str(meta.get("name") or "Image Studio"),
                description=str(meta.get("description") or ""),
                tags=list(meta.get("tags") or ["image_studio"]),
            )
        except HTTPException as exc:
            detail = exc.detail if isinstance(exc.detail, str) else str(exc.detail)
            raise ValueError(detail) from exc

    async def event_stream() -> Any:
        try:
            async for frame in iter_image_studio_generation_sse(
                ugs=ugs,
                user=user,
                content_service=content_service,
                type_key=type_key,
                input_data=input_data,
                idempotency_key=idempotency_key,
                finalize_image=None if prompt_finalize else finalize_image,
                finalize_prompt=finalize_suggest_prompt_response if prompt_finalize else None,
            ):
                yield frame
        finally:
            await ugs.close()

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers=dict(IMAGE_STUDIO_SSE_HEADERS),
    )


@router.post("/text-to-image/stream")
async def text_to_image_stream(
    body: TextToImageRequest,
    http_request: Request,
    user: User = Depends(require_oauth2_user),
    content_service: ContentStorageService = Depends(get_content_service),
    ugs: UnifiedGenerationService = Depends(get_ugs_service),
) -> StreamingResponse:
    prompt = sanitize_image_prompt_text(body.prompt or "")
    if not prompt:
        raise HTTPException(status_code=400, detail="prompt is required")
    width = max(256, min(2048, body.width))
    height = max(256, min(2048, body.height))
    seed = body.seed if body.seed is not None else -1
    idem = _idempotency_key_from_body_or_headers(body.idempotency_key, http_request)
    return _streaming_response(
        ugs=ugs,
        user=user,
        content_service=content_service,
        type_key="image_studio_text_to_image",
        input_data={"prompt": prompt, "width": width, "height": height, "seed": seed},
        idempotency_key=idem,
        finalize_image_meta={
            "default_filename": "image.png",
            "name": f"Изображение {_datetime_str()}",
            "description": "Генерация по тексту",
            "tags": ["image_studio", "text_to_image"],
        },
    )


@router.post("/suggest-prompt/stream")
async def suggest_image_prompt_stream(
    body: SuggestImagePromptRequest,
    http_request: Request,
    user: User = Depends(require_oauth2_user),
    content_service: ContentStorageService = Depends(get_content_service),
    ugs: UnifiedGenerationService = Depends(get_ugs_service),
) -> StreamingResponse:
    idea = (body.idea or "").strip()
    if len(idea) < 2:
        raise HTTPException(status_code=400, detail="idea is required (min 2 characters)")
    if len(idea) > 600:
        idea = idea[:600] + "…"
    style_hint = (body.style_hint or "").strip()[:200]
    lang = (body.language or "en").strip().lower()[:8]
    if lang not in ("en", "ru"):
        lang = "en"

    system_prompt = (
        "You are an expert prompt engineer for text-to-image diffusion models (Z-Image, SDXL). "
        "Reply with ONLY the image prompt text: no titles, no quotes, no markdown, no explanations. "
        "Use comma-separated keywords and short phrases. "
        "Include subject, style, lighting, composition, and quality hints when relevant."
    )
    if lang == "ru":
        system_prompt = (
            "Ты эксперт по промптам для text-to-image (диффузионные модели). "
            "Ответь только текстом промпта: без заголовков, без кавычек, без markdown, без пояснений. "
            "Ключевые слова и короткие фразы через запятую. "
            "Укажи объект, стиль, освещение, композицию, качество — по смыслу."
        )

    if lang == "en":
        user_parts = [f"Subject / scene to depict: {idea}"]
        if style_hint:
            user_parts.append(f"Style hints: {style_hint}")
        user_parts.append("Write the final prompt in English only (comma-separated phrases).")
    else:
        user_parts = [f"Идея / что нарисовать: {idea}"]
        if style_hint:
            user_parts.append(f"Подсказки по стилю: {style_hint}")
        user_parts.append("Напиши финальный промпт на русском (фразы через запятую).")

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": "\n".join(user_parts)},
    ]
    idem = _idempotency_key_from_body_or_headers(body.idempotency_key, http_request)
    return _streaming_response(
        ugs=ugs,
        user=user,
        content_service=content_service,
        type_key="image_studio_image_prompt",
        input_data={"messages": messages},
        idempotency_key=idem,
        prompt_finalize=True,
    )


@router.post("/image-edit/stream")
async def image_edit_stream(
    http_request: Request,
    prompt: str = Form(..., description="Edit instruction"),
    image: UploadFile = File(..., description="Image file to edit"),
    negative_prompt: str = Form(""),
    seed: str | None = Form(None),
    idempotency_key: str | None = Form(None),
    user: User = Depends(require_oauth2_user),
    content_service: ContentStorageService = Depends(get_content_service),
    ugs: UnifiedGenerationService = Depends(get_ugs_service),
) -> StreamingResponse:
    prompt_text = (prompt or "").strip()
    if not prompt_text:
        raise HTTPException(status_code=400, detail="prompt is required")
    image_bytes = await image.read()
    validate_image_bytes(image_bytes, MAX_IMAGE_BYTES)
    try:
        seed_int = int(seed) if (seed and str(seed).strip()) else -1
    except TypeError, ValueError:
        seed_int = -1
    idem = _idempotency_key_from_body_or_headers(idempotency_key, http_request)
    return _streaming_response(
        ugs=ugs,
        user=user,
        content_service=content_service,
        type_key="image_studio_image_edit",
        input_data=build_image_edit_input_data(
            prompt=prompt_text,
            image_base64=_b64_from_bytes(image_bytes),
            negative_prompt=negative_prompt or "",
            seed=seed_int,
        ),
        idempotency_key=idem,
        finalize_image_meta={
            "default_filename": "edited.png",
            "name": f"Редактирование {_datetime_str()}",
            "description": "Редактирование по инструкции",
            "tags": ["image_studio", "image_edit"],
        },
    )


@router.post("/image-edit-json/stream")
async def image_edit_json_stream(
    body: ImageEditJsonRequest,
    http_request: Request,
    user: User = Depends(require_oauth2_user),
    content_service: ContentStorageService = Depends(get_content_service),
    ugs: UnifiedGenerationService = Depends(get_ugs_service),
) -> StreamingResponse:
    prompt_text = (body.prompt or "").strip()
    if not prompt_text:
        raise HTTPException(status_code=400, detail="prompt is required")
    if not body.image:
        raise HTTPException(status_code=400, detail="image (base64) is required")
    image_bytes = decode_base64_image(body.image, MAX_IMAGE_BYTES)
    seed = body.seed if body.seed is not None else -1
    idem = _idempotency_key_from_body_or_headers(body.idempotency_key, http_request)
    return _streaming_response(
        ugs=ugs,
        user=user,
        content_service=content_service,
        type_key="image_studio_image_edit",
        input_data=build_image_edit_input_data(
            prompt=prompt_text,
            image_base64=base64.b64encode(image_bytes).decode("ascii"),
            negative_prompt=(body.negative_prompt or "").strip(),
            seed=seed,
        ),
        idempotency_key=idem,
        finalize_image_meta={
            "default_filename": "edited.png",
            "name": f"Редактирование {_datetime_str()}",
            "description": "Редактирование по инструкции",
            "tags": ["image_studio", "image_edit"],
        },
    )


@router.post("/image-rotate/stream")
async def image_rotate_stream(
    http_request: Request,
    image: UploadFile = File(..., description="Image file to transform"),
    mode: str = Form("angle90_right"),
    idempotency_key: str | None = Form(None),
    user: User = Depends(require_oauth2_user),
    content_service: ContentStorageService = Depends(get_content_service),
    ugs: UnifiedGenerationService = Depends(get_ugs_service),
) -> StreamingResponse:
    try:
        mode_key = validate_rotate_mode(mode)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    image_bytes = await image.read()
    validate_image_bytes(image_bytes, MAX_IMAGE_BYTES)
    label = rotate_mode_label(mode_key)
    idem = _idempotency_key_from_body_or_headers(idempotency_key, http_request)
    return _streaming_response(
        ugs=ugs,
        user=user,
        content_service=content_service,
        type_key="image_studio_image_rotate",
        input_data={
            "image_base64": _b64_from_bytes(image_bytes),
            "mode": mode_key,
        },
        idempotency_key=idem,
        finalize_image_meta={
            "default_filename": "rotated.png",
            "name": f"{label} {_datetime_str()}",
            "description": "Изменение ракурса / поворот камеры",
            "tags": [
                "image_studio",
                "rotate_image",
                (mode_key if mode_key != ROTATE_MODE_ALL else "all_views"),
            ],
        },
    )
