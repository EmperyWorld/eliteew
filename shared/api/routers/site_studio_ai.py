# ------------------------------------------------------------------------------
#  EliteEW · Empery World
#  https://eliteew.ru
#  Author: po&T <keysray70@gmail.com>
# ------------------------------------------------------------------------------
# Purpose:
#   HTTP API `api/routers/site_studio_ai.py`: эндпоинты и контракт — в коде и OpenAPI.
# Invariants:
#   - Маршруты и авторизация — как реализовано в модуле; секреты не в исходниках.
# Related:
#   - shared/api/main.py (регистрация роутеров); см. затронутые services/models.
# ------------------------------------------------------------------------------
from __future__ import annotations

import asyncio
import json
from collections.abc import AsyncGenerator, Awaitable, Callable
from typing import Any
from urllib.parse import urlencode
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, status  # type: ignore[import-untyped]
from fastapi.responses import StreamingResponse  # type: ignore[import-untyped]
from pydantic import BaseModel, Field
from sqlalchemy import select  # type: ignore[import-not-found]
from sqlalchemy.ext.asyncio import AsyncSession  # type: ignore[import-not-found]

from api.core.auth import User as AuthUser
from api.core.database_manager import get_postgres_session
from api.core.oauth2_auth import require_oauth2_user
from api.core.user_identity import resolve_db_user_uuid_with_session
from api.models.desktop import UserSiteInstance
from api.services.site_studio_ai_service import SiteStudioAIError, SiteStudioAIService
from api.services.ugs.unified_generation_service import UnifiedGenerationService

router = APIRouter(prefix="/desktop/site-studio/ai", tags=["desktop-site-studio-ai"])


class SiteStudioBriefGenerateRequest(BaseModel):
    prompt: str | None = Field(default=None, max_length=4000)


class SiteStudioAssistRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)


class SiteStudioContentGenerateRequest(BaseModel):
    pack_key: str = Field(min_length=1, max_length=80)


class SiteStudioImageGenerateRequest(BaseModel):
    slot_id: str = Field(min_length=3, max_length=120)
    prompt: str | None = Field(default=None, max_length=4000)
    negative_prompt: str | None = Field(default=None, max_length=4000)
    width: int | None = Field(default=None, ge=512, le=2048)
    height: int | None = Field(default=None, ge=512, le=2048)
    steps: int | None = Field(default=None, ge=1, le=50)
    idempotency_key: str | None = Field(default=None, min_length=8, max_length=120)


class SiteStudioImageSaveRequest(BaseModel):
    slot_id: str = Field(min_length=3, max_length=120)
    image_url: str = Field(min_length=1, max_length=12000)
    prompt: str = Field(min_length=1, max_length=4000)
    negative_prompt: str | None = Field(default=None, max_length=4000)
    width: int | None = Field(default=None, ge=1, le=4096)
    height: int | None = Field(default=None, ge=1, le=4096)


async def _current_db_user_id(
    current_user: AuthUser,
    db: AsyncSession,
) -> UUID:
    return await resolve_db_user_uuid_with_session(current_user, db)


async def _require_instance_for_current_user(
    current_user: AuthUser,
    db: AsyncSession,
) -> UserSiteInstance:
    user_id = await _current_db_user_id(current_user, db)
    result = await db.execute(select(UserSiteInstance).where(UserSiteInstance.user_id == user_id))
    instance = result.scalar_one_or_none()
    if instance is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Site Studio instance not found",
        )
    return instance


async def get_site_studio_ai_service(
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
) -> AsyncGenerator[SiteStudioAIService]:
    service = SiteStudioAIService(db)
    try:
        yield service
    finally:
        await service.close()


def _sse_message(event: str, data: dict[str, Any]) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


def _as_non_empty_string(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _is_inline_data_url(value: str | None) -> bool:
    return bool(value and value.startswith("data:"))


def _build_comfyui_proxy_url(filename: str, *, subfolder: str = "", image_type: str = "output") -> str:
    return (
        f"/api/doc-editor/ai/image/view?{urlencode({'filename': filename, 'subfolder': subfolder, 'type': image_type})}"
    )


def _strip_inline_image_data(payload: Any) -> Any:
    if isinstance(payload, dict):
        compact: dict[str, Any] = {}
        for key, value in payload.items():
            if key in {"data", "image_data", "data_uri", "data_preview", "data_truncated"}:
                continue
            compact[key] = _strip_inline_image_data(value)
        return compact
    if isinstance(payload, list):
        return [_strip_inline_image_data(item) for item in payload]
    return payload


def _extract_site_studio_image_asset(payload: Any) -> dict[str, Any] | None:
    if isinstance(payload, dict):
        direct_url = None
        for key in ("image_url", "imageUrl", "url", "download_url", "signed_url"):
            candidate = _as_non_empty_string(payload.get(key))
            if candidate and not _is_inline_data_url(candidate):
                direct_url = candidate
                break

        storage_reference = payload.get("storage_reference")
        filename = _as_non_empty_string(payload.get("filename")) or _as_non_empty_string(payload.get("name"))
        subfolder = ""
        image_type = "output"
        if isinstance(storage_reference, dict):
            filename = filename or _as_non_empty_string(storage_reference.get("filename"))
            subfolder = _as_non_empty_string(storage_reference.get("subfolder")) or ""
            image_type = _as_non_empty_string(storage_reference.get("type")) or image_type

        if filename:
            image_url = direct_url or _build_comfyui_proxy_url(
                filename,
                subfolder=subfolder,
                image_type=image_type,
            )
            return {
                "image_url": image_url,
                "imageUrl": image_url,
                "filename": filename,
                "subfolder": subfolder,
                "type": image_type,
                "width": payload.get("width"),
                "height": payload.get("height"),
                "storage_reference": storage_reference if isinstance(storage_reference, dict) else None,
            }

        if direct_url:
            return {
                "image_url": direct_url,
                "imageUrl": direct_url,
                "width": payload.get("width"),
                "height": payload.get("height"),
                "storage_reference": storage_reference if isinstance(storage_reference, dict) else None,
            }

        preferred_keys = ("result", "data", "payload", "output_data", "images", "assets")
        for key in preferred_keys:
            if key in payload:
                candidate = _extract_site_studio_image_asset(payload.get(key))
                if candidate is not None:
                    return candidate

        for value in payload.values():
            candidate = _extract_site_studio_image_asset(value)
            if candidate is not None:
                return candidate
        return None

    if isinstance(payload, list):
        for item in payload:
            candidate = _extract_site_studio_image_asset(item)
            if candidate is not None:
                return candidate
    return None


def _normalize_site_studio_image_result(payload: Any) -> dict[str, Any]:
    base_payload = _strip_inline_image_data(payload)
    normalized = dict(base_payload) if isinstance(base_payload, dict) else {"result": base_payload}
    asset = _extract_site_studio_image_asset(payload)
    if asset:
        normalized.update({key: value for key, value in asset.items() if value is not None})
    return normalized


def _stream_site_studio_operation(
    *,
    operation_label: str,
    operation: Callable[[], Awaitable[dict[str, Any]]],
) -> StreamingResponse:
    request_id = str(uuid4())

    async def event_stream() -> Any:
        yield _sse_message(
            "started",
            {
                "request_id": request_id,
                "status": "processing",
                "progress_message": f"{operation_label} started",
            },
        )
        task = asyncio.create_task(operation())
        while True:
            try:
                async with asyncio.timeout(2.0):
                    result = await asyncio.shield(task)
            except TimeoutError:
                yield _sse_message(
                    "keep_alive",
                    {
                        "request_id": request_id,
                        "status": "processing",
                        "progress_message": f"{operation_label} in progress",
                    },
                )
                continue
            except SiteStudioAIError as exc:
                yield _sse_message(
                    "error",
                    {
                        "request_id": request_id,
                        "status": "failed",
                        "error": str(exc),
                    },
                )
                return
            except Exception as exc:  # noqa: BLE001
                yield _sse_message(
                    "error",
                    {
                        "request_id": request_id,
                        "status": "failed",
                        "error": str(exc),
                    },
                )
                return

            yield _sse_message(
                "result",
                {
                    "request_id": request_id,
                    "status": "completed",
                    "data": result,
                },
            )
            return

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/catalog")
async def get_site_studio_ai_catalog(
    current_user: AuthUser = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
    service: SiteStudioAIService = Depends(get_site_studio_ai_service),
) -> dict[str, Any]:
    await _require_instance_for_current_user(current_user, db)
    return service.get_catalog()


@router.get("/drafts")
async def get_site_studio_drafts(
    current_user: AuthUser = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
    service: SiteStudioAIService = Depends(get_site_studio_ai_service),
) -> dict[str, Any]:
    instance = await _require_instance_for_current_user(current_user, db)
    return service.get_draft_state(instance)


@router.post("/brief/generate")
async def generate_site_studio_brief(
    body: SiteStudioBriefGenerateRequest,
    current_user: AuthUser = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
    service: SiteStudioAIService = Depends(get_site_studio_ai_service),
) -> dict[str, Any]:
    instance = await _require_instance_for_current_user(current_user, db)
    try:
        return await service.generate_brief_blueprint(
            instance,
            user_id=str(current_user.id),
            prompt=body.prompt,
        )
    except SiteStudioAIError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.post("/brief/generate/stream")
async def generate_site_studio_brief_stream(
    body: SiteStudioBriefGenerateRequest,
    current_user: AuthUser = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
    service: SiteStudioAIService = Depends(get_site_studio_ai_service),
) -> StreamingResponse:
    instance = await _require_instance_for_current_user(current_user, db)
    return _stream_site_studio_operation(
        operation_label="site_studio_brief_generate",
        operation=lambda: service.generate_brief_blueprint(
            instance,
            user_id=str(current_user.id),
            prompt=body.prompt,
        ),
    )


@router.post("/assist")
async def assist_site_studio(
    body: SiteStudioAssistRequest,
    current_user: AuthUser = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
    service: SiteStudioAIService = Depends(get_site_studio_ai_service),
) -> dict[str, Any]:
    instance = await _require_instance_for_current_user(current_user, db)
    try:
        return await service.assist(
            instance,
            user_id=str(current_user.id),
            message=body.message,
        )
    except SiteStudioAIError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.post("/assist/stream")
async def assist_site_studio_stream(
    body: SiteStudioAssistRequest,
    current_user: AuthUser = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
    service: SiteStudioAIService = Depends(get_site_studio_ai_service),
) -> StreamingResponse:
    instance = await _require_instance_for_current_user(current_user, db)
    return _stream_site_studio_operation(
        operation_label="site_studio_assist",
        operation=lambda: service.assist(
            instance,
            user_id=str(current_user.id),
            message=body.message,
        ),
    )


@router.post("/content/generate")
async def generate_site_studio_content_pack(
    body: SiteStudioContentGenerateRequest,
    current_user: AuthUser = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
    service: SiteStudioAIService = Depends(get_site_studio_ai_service),
) -> dict[str, Any]:
    instance = await _require_instance_for_current_user(current_user, db)
    try:
        return await service.generate_content_pack(
            instance,
            user_id=str(current_user.id),
            pack_key=body.pack_key,
        )
    except SiteStudioAIError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.post("/content/generate/stream")
async def generate_site_studio_content_pack_stream(
    body: SiteStudioContentGenerateRequest,
    current_user: AuthUser = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
    service: SiteStudioAIService = Depends(get_site_studio_ai_service),
) -> StreamingResponse:
    instance = await _require_instance_for_current_user(current_user, db)
    return _stream_site_studio_operation(
        operation_label="site_studio_content_generate",
        operation=lambda: service.generate_content_pack(
            instance,
            user_id=str(current_user.id),
            pack_key=body.pack_key,
        ),
    )


@router.post("/seo/generate")
async def generate_site_studio_seo_pack(
    current_user: AuthUser = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
    service: SiteStudioAIService = Depends(get_site_studio_ai_service),
) -> dict[str, Any]:
    instance = await _require_instance_for_current_user(current_user, db)
    try:
        return await service.generate_seo_pack(
            instance,
            user_id=str(current_user.id),
        )
    except SiteStudioAIError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.post("/seo/generate/stream")
async def generate_site_studio_seo_pack_stream(
    current_user: AuthUser = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
    service: SiteStudioAIService = Depends(get_site_studio_ai_service),
) -> StreamingResponse:
    instance = await _require_instance_for_current_user(current_user, db)
    return _stream_site_studio_operation(
        operation_label="site_studio_seo_generate",
        operation=lambda: service.generate_seo_pack(
            instance,
            user_id=str(current_user.id),
        ),
    )


@router.post("/images/save")
async def save_site_studio_image_draft(
    body: SiteStudioImageSaveRequest,
    current_user: AuthUser = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
    service: SiteStudioAIService = Depends(get_site_studio_ai_service),
) -> dict[str, Any]:
    instance = await _require_instance_for_current_user(current_user, db)
    try:
        return await service.save_image_draft(
            instance,
            slot_id=body.slot_id,
            image_url=body.image_url,
            prompt=body.prompt,
            negative_prompt=body.negative_prompt,
            width=body.width,
            height=body.height,
        )
    except SiteStudioAIError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.post("/images/generate/stream")
async def generate_site_studio_image_stream(
    body: SiteStudioImageGenerateRequest,
    current_user: AuthUser = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
    service: SiteStudioAIService = Depends(get_site_studio_ai_service),
) -> StreamingResponse:
    instance = await _require_instance_for_current_user(current_user, db)
    try:
        generation_payload = service.build_image_generation_input(
            instance,
            slot_id=body.slot_id,
            prompt=body.prompt,
            negative_prompt=body.negative_prompt,
            width=body.width,
            height=body.height,
            steps=body.steps,
        )
    except SiteStudioAIError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    slot = generation_payload["slot"]
    input_data = generation_payload["input"]

    async def event_stream() -> Any:
        ugs_service = UnifiedGenerationService(db)
        try:
            start_payload = await ugs_service.start_generation_for_stream(
                user_id=str(current_user.id),
                type_key="image_generation_comfyui",
                input_data=input_data,
                priority=5,
                idempotency_key=body.idempotency_key,
            )
        except ValueError as exc:
            yield _sse_message("error", {"error": str(exc), "slotId": body.slot_id})
            await ugs_service.close()
            return
        except Exception as exc:  # noqa: BLE001
            yield _sse_message("error", {"error": str(exc), "slotId": body.slot_id})
            await ugs_service.close()
            return

        if start_payload.get("status") == "completed":
            normalized_result = _normalize_site_studio_image_result(start_payload)
            yield _sse_message(
                "result",
                {
                    **normalized_result,
                    "data": normalized_result,
                    "result": normalized_result,
                    "slotId": body.slot_id,
                    "slotTitle": slot["title"],
                    "prompt": input_data["prompt"],
                    "negativePrompt": input_data["negative_prompt"],
                    "width": input_data["width"],
                    "height": input_data["height"],
                },
            )
            await ugs_service.close()
            return

        request_id = start_payload.get("request_id")
        if not request_id:
            yield _sse_message("error", {"error": "No request_id returned", "slotId": body.slot_id})
            await ugs_service.close()
            return

        yield _sse_message(
            "started",
            {
                "request_id": request_id,
                "status": start_payload.get("status", "processing"),
                "slotId": body.slot_id,
                "slotTitle": slot["title"],
                "prompt": input_data["prompt"],
                "negativePrompt": input_data["negative_prompt"],
                "width": input_data["width"],
                "height": input_data["height"],
            },
        )

        try:
            async for event in ugs_service.stream_generation_events(
                request_id,
                str(current_user.id),
                poll_interval=2.5,
                keep_alive_interval=8.0,
            ):
                event_type = event.get("event") or "progress"
                common_payload = {
                    "slotId": body.slot_id,
                    "slotTitle": slot["title"],
                    "prompt": input_data["prompt"],
                    "negativePrompt": input_data["negative_prompt"],
                    "width": input_data["width"],
                    "height": input_data["height"],
                }
                if event_type == "result":
                    normalized_result = _normalize_site_studio_image_result(
                        event.get("data") or event.get("result") or event
                    )
                    payload = {
                        "request_id": event.get("request_id"),
                        "status": event.get("status", "completed"),
                        "data": normalized_result,
                        "result": normalized_result,
                        "result_preview": _strip_inline_image_data(event.get("result_preview")),
                        "metadata": _strip_inline_image_data(event.get("metadata")),
                        **common_payload,
                    }
                else:
                    payload = {
                        **event,
                        **common_payload,
                    }
                yield _sse_message(str(event_type), payload)
        finally:
            await ugs_service.close()

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
