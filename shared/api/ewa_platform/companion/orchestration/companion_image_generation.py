# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Companion **image generation/editing** via UGS (ComfyUI): intent gate, prompt extraction, durable background task-run.
# Invariants:
# - Gated by ``EWA_COMPANION_IMAGE_GENERATION_ENABLED`` in ``ewa_platform_setting`` (default off).
# - Uses main Postgres ``UnifiedGenerationService`` with ``content_catalog_user_id``; companion state on EWA pool.
# - Result ``result_payload`` carries ``image_tool_mode``, ``image_url``, ``unified_content_id``, ``prompt_preview`` for operations UI.
# Related:
# - api/ewa_platform/companion/orchestration/tool_registry.py
# - api/ewa_platform/settings/catalog_entries.py (EWA_COMPANION_IMAGE_GENERATION_*)
# - api/services/desktop_chat/tools/image_ugs.py
# - api/ewa_platform/companion/jobs/step_handlers.py
# ---
"""EWA companion image generation/editing (UGS background)."""

from __future__ import annotations

import base64
import binascii
import logging
import os
import re
import secrets
from collections.abc import Mapping
from typing import TYPE_CHECKING, Any
from uuid import UUID, uuid4

if TYPE_CHECKING:
    import asyncpg

logger = logging.getLogger(__name__)

IMAGE_GENERATION_INTENT = "image_generation_background"
IMAGE_EDIT_INTENT = "image_edit_background"
IMAGE_ASYNC_INTENT_KINDS = frozenset({IMAGE_GENERATION_INTENT, IMAGE_EDIT_INTENT})
IMAGE_STEP_KIND = "image_generation_pipeline"
IMAGE_TOOL_MODE_GENERATE = "generate"
IMAGE_TOOL_MODE_EDIT = "edit"
IMAGE_TOOL_MODES = frozenset({IMAGE_TOOL_MODE_GENERATE, IMAGE_TOOL_MODE_EDIT})
DEFAULT_IMAGE_EDIT_TYPE_KEY = "image_studio_image_edit"
_MAX_SOURCE_IMAGE_BYTES = 10 * 1024 * 1024

_ASPECT_PRESETS: dict[str, tuple[int, int]] = {
    "1:1": (1024, 1024),
    "16:9": (1344, 768),
    "9:16": (768, 1344),
    "4:3": (1024, 768),
    "3:4": (768, 1024),
}

_IMAGE_CMD_RE = re.compile(
    r"(?:"
    r"нарисуй(?:те)?|нарисовать|"
    r"сгенерируй(?:те)?\s+(?:картинку|изображение|арт|иллюстрацию)|"
    r"создай(?:те)?\s+(?:картинку|изображение|постер|арт)|"
    r"сделай(?:те)?\s+(?:картинку|изображение|постер|арт|иллюстрацию)|"
    r"generate\s+(?:an?\s+)?image|draw\s+(?:me\s+)?(?:a\s+)?(?:picture|image)"
    r")",
    re.IGNORECASE,
)

_VISION_ANALYZE_RE = re.compile(
    r"(?:"
    r"что\s+на|опиши|расскажи\s+о|разбер(?:и|ите)|"
    r"распозна(?:й|йте|ть)|recognize|analyze|describe"
    r")\s+(?:"
    r"(?:текст\s+)?(?:на\s+)?(?:картин|изображ|фото|picture|image)|"
    r"эт(?:ой|ом|у)\s+(?:картин|изображ|фото|картинк)"
    r")",
    re.IGNORECASE,
)

_IMAGE_EDIT_CMD_RE = re.compile(
    r"(?:"
    r"измени(?:ть|те)?|отредактируй(?:те)?|переделай(?:те)?|улучши(?:те)?|"
    r"сделай(?:те)?\s+(?:вариант|версию)|"
    r"убери(?:те)?|замени(?:те)?|добавь(?:те)?|"
    r"edit\s+(?:the\s+)?image|modify\s+(?:the\s+)?image|make\s+(?:a\s+)?variant"
    r")",
    re.IGNORECASE,
)

_UUID_RE = re.compile(
    r"\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b",
    re.IGNORECASE,
)
_SOURCE_REF_RE = re.compile(
    r"(?:uc|content|content_id|unified_content_id|image|image_id)\s*[:=]\s*"
    r"([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})",
    re.IGNORECASE,
)


def companion_image_generation_enabled() -> bool:
    raw = os.getenv("EWA_COMPANION_IMAGE_GENERATION_ENABLED", "0").strip().lower()
    return raw in ("1", "true", "yes", "on")


def companion_image_generation_type_key() -> str:
    return (
        os.getenv("EWA_COMPANION_IMAGE_GENERATION_TYPE_KEY", "desktop_ai_chat_image_01_top").strip()
        or "desktop_ai_chat_image_01_top"
    )


def companion_image_generation_workflow_slug() -> str:
    return os.getenv("EWA_COMPANION_IMAGE_GENERATION_WORKFLOW_SLUG", "01_top").strip() or "01_top"


def companion_image_edit_type_key() -> str:
    return (
        os.getenv("EWA_COMPANION_IMAGE_EDIT_TYPE_KEY", DEFAULT_IMAGE_EDIT_TYPE_KEY).strip()
        or DEFAULT_IMAGE_EDIT_TYPE_KEY
    )


def user_line_requests_image_analysis(user_line: str) -> bool:
    return _VISION_ANALYZE_RE.search((user_line or "").strip()) is not None


def user_line_requests_attachment_image_edit(user_line: str) -> bool:
    text = (user_line or "").strip()
    if len(text) < 3:
        return False
    if user_line_requests_image_analysis(text):
        return False
    return _IMAGE_EDIT_CMD_RE.search(text) is not None


def user_line_requests_image_edit(user_line: str) -> bool:
    text = (user_line or "").strip()
    if len(text) < 6:
        return False
    if _VISION_ANALYZE_RE.search(text):
        return False
    if not _SOURCE_REF_RE.search(text) and not re.search(r"(?:картин|изображ|фото|picture|image)", text, re.IGNORECASE):
        return False
    return _IMAGE_EDIT_CMD_RE.search(text) is not None


def user_line_requests_image_generation(user_line: str) -> bool:
    text = (user_line or "").strip()
    if len(text) < 6:
        return False
    if _VISION_ANALYZE_RE.search(text):
        return False
    return _IMAGE_CMD_RE.search(text) is not None or user_line_requests_image_edit(text)


def extract_source_content_id(*, user_line: str, args: Mapping[str, Any] | None = None) -> str | None:
    for key in (
        "source_unified_content_id",
        "sourceUnifiedContentId",
        "source_content_id",
        "sourceContentId",
        "unified_content_id",
        "content_id",
        "image_content_id",
    ):
        raw = (args or {}).get(key)
        if raw is None:
            continue
        text = str(raw).strip()
        if _UUID_RE.fullmatch(text):
            return text
    match = _SOURCE_REF_RE.search((user_line or "").strip())
    if match:
        return match.group(1)
    return None


def resolve_companion_image_operation_mode(
    user_line: str,
    args: Mapping[str, Any] | None = None,
    *,
    has_source_image: bool = False,
) -> str:
    raw = str((args or {}).get("image_tool_mode") or (args or {}).get("operation_mode") or "").strip().lower()
    if raw in IMAGE_TOOL_MODES:
        return raw
    if user_line_requests_image_analysis(user_line):
        return IMAGE_TOOL_MODE_GENERATE
    if (
        (has_source_image and user_line_requests_attachment_image_edit(user_line))
        or extract_source_content_id(user_line=user_line, args=args)
        or user_line_requests_image_edit(user_line)
    ):
        return IMAGE_TOOL_MODE_EDIT
    return IMAGE_TOOL_MODE_GENERATE


def extract_image_prompt(user_line: str, args: Mapping[str, Any] | None = None) -> str:
    from_args = str((args or {}).get("prompt") or "").strip()
    if len(from_args) >= 3:
        return from_args[:2000]
    text = (user_line or "").strip()
    for pattern in (
        r"^(?:нарисуй(?:те)?|нарисовать)\s+(.+)$",
        r"^(?:сгенерируй(?:те)?|создай(?:те)?|сделай(?:те)?)\s+(?:картинку|изображение|постер|арт|иллюстрацию)\s+(.+)$",
        r"^(?:generate\s+(?:an?\s+)?image|draw\s+(?:me\s+)?(?:a\s+)?(?:picture|image))\s*[:\-]?\s*(.+)$",
    ):
        m = re.match(pattern, text, flags=re.IGNORECASE)
        if m:
            prompt = m.group(1).strip(" .,:;")
            if len(prompt) >= 3:
                return prompt[:2000]
    cleaned = _IMAGE_CMD_RE.sub("", text, count=1).strip(" .,:;-")
    if len(cleaned) >= 3:
        return cleaned[:2000]
    return text[:2000]


def extract_image_edit_prompt(user_line: str, args: Mapping[str, Any] | None = None) -> str:
    from_args = str((args or {}).get("prompt") or (args or {}).get("edit_prompt") or "").strip()
    if len(from_args) >= 3:
        return from_args[:2000]
    text = _SOURCE_REF_RE.sub("", (user_line or "").strip())
    text = _IMAGE_EDIT_CMD_RE.sub("", text, count=1).strip(" .,:;-")
    text = re.sub(r"\b(?:картинку|изображение|фото|image|picture)\b", "", text, flags=re.IGNORECASE).strip(" .,:;-")
    if len(text) >= 3:
        return text[:2000]
    return (user_line or "").strip()[:2000]


def _public_url_from_ugs_result(result: Mapping[str, Any]) -> str | None:
    for key in ("result_url", "image_url", "url", "public_url"):
        val = result.get(key)
        if isinstance(val, str) and val.strip():
            return val.strip()
    res = result.get("result")
    if isinstance(res, Mapping):
        for key in ("url", "image_url", "result_url", "public_url"):
            val = res.get(key)
            if isinstance(val, str) and val.strip():
                return val.strip()
        images = res.get("images")
        if isinstance(images, list) and images:
            first = images[0]
            if isinstance(first, Mapping):
                for key in ("url", "image_url", "data_uri"):
                    val = first.get(key)
                    if isinstance(val, str) and val.strip():
                        return val.strip()
    return None


def _content_id_from_ugs_result(result: Mapping[str, Any]) -> str | None:
    direct = result.get("content_id")
    if direct is not None:
        return str(direct).strip() or None
    res = result.get("result")
    if isinstance(res, Mapping):
        images = res.get("images")
        if isinstance(images, list) and images:
            first = images[0]
            if isinstance(first, Mapping):
                cid = first.get("content_id")
                if cid is not None:
                    return str(cid).strip() or None
        cid = res.get("content_id")
        if cid is not None:
            return str(cid).strip() or None
    return None


def _mime_type_from_ugs_result(result: Mapping[str, Any]) -> str | None:
    res = result.get("result")
    if isinstance(res, Mapping):
        images = res.get("images")
        if isinstance(images, list) and images:
            first = images[0]
            if isinstance(first, Mapping):
                mime = str(first.get("mime_type") or "").strip()
                if mime:
                    return mime
        mime = str(res.get("mime_type") or "").strip()
        if mime:
            return mime
    return None


def _decode_companion_image_attachment(raw: Mapping[str, Any]) -> tuple[bytes, str]:
    from api.ewa_platform.companion.contracts.vision_formats import (
        COMPANION_VISION_ALLOWED_MIMES,
        companion_vision_mime_allowed,
        companion_vision_mime_from_magic,
    )

    mime_raw = str(raw.get("mime_type") or raw.get("mimeType") or "").strip().lower()
    b64_raw = str(raw.get("data_base64") or raw.get("dataBase64") or "").strip()
    if not b64_raw:
        msg = "companion_image_attachment_data_required"
        raise ValueError(msg)
    if b64_raw.startswith("data:"):
        match = re.match(r"^data:(image/[a-z0-9.+-]+);base64,(.+)$", b64_raw, flags=re.IGNORECASE | re.DOTALL)
        if match is None:
            msg = "companion_image_attachment_invalid_data_url"
            raise ValueError(msg)
        mime_raw = match.group(1).lower()
        b64_raw = match.group(2).strip()
    if not companion_vision_mime_allowed(mime_raw):
        msg = "companion_image_attachment_mime_not_allowed"
        raise ValueError(msg)
    try:
        decoded = base64.b64decode(b64_raw, validate=True)
    except (binascii.Error, ValueError) as exc:
        msg = "companion_image_attachment_invalid_base64"
        raise ValueError(msg) from exc
    if len(decoded) > _MAX_SOURCE_IMAGE_BYTES:
        msg = "companion_image_attachment_too_large"
        raise ValueError(msg)
    magic_mime = companion_vision_mime_from_magic(decoded)
    if magic_mime is None or magic_mime not in COMPANION_VISION_ALLOWED_MIMES:
        msg = "companion_image_attachment_unsupported_format"
        raise ValueError(msg)
    if magic_mime != mime_raw:
        msg = "companion_image_attachment_magic_mismatch"
        raise ValueError(msg)
    return decoded, magic_mime


async def persist_companion_image_attachment_source(
    *,
    catalog_user_id: str,
    image_attachment: Mapping[str, Any],
) -> str:
    """Persist a one-turn image attachment to Unified Content and return its source content id for background edit."""

    from api.core.database_manager import get_asyncpg_pool
    from api.schemas.unified_content import ContentType, Visibility, build_content_create
    from api.services.unified_content.audit_logger import AuditLogger
    from api.services.unified_content.content_storage_service import ContentStorageService
    from api.services.unified_content.storage_backends.factory import get_storage_factory

    image_bytes, mime_type = _decode_companion_image_attachment(image_attachment)
    pool = await get_asyncpg_pool()
    storage_factory = get_storage_factory(pool)
    storage = ContentStorageService(pool, storage_factory, AuditLogger(pool))
    suffix = "jpg" if mime_type == "image/jpeg" else mime_type.split("/", 1)[-1]
    content = await storage.create_content(
        content_data=build_content_create(
            user_id=str(catalog_user_id),
            name=f"companion-source-image-{uuid4().hex[:8]}.{suffix}",
            description="EWA companion image edit source",
            content_type=ContentType.IMAGE,
            mime_type=mime_type,
            sub_type="ewa_companion_image_source",
            original_filename=f"companion-source-image.{suffix}",
            tags=["ewa-companion", "image-source"],
            visibility=Visibility.PRIVATE,
            source_service="ewa_companion_image_tool",
            source_id=str(uuid4()),
            metadata={"ewa_companion_image_tool_role": "edit_source"},
        ),
        file_data=image_bytes,
        user_id=str(catalog_user_id),
    )
    return str(content.id)


async def _load_source_image_for_edit(*, content_id: str, catalog_user_id: str) -> tuple[bytes, str]:
    from api.core.database_manager import get_asyncpg_pool
    from api.ewa_platform.companion.contracts.vision_formats import (
        companion_vision_mime_allowed,
        companion_vision_mime_from_magic,
    )
    from api.services.unified_content.audit_logger import AuditLogger
    from api.services.unified_content.content_storage_service import ContentStorageService
    from api.services.unified_content.storage_backends.factory import get_storage_factory

    pool = await get_asyncpg_pool()
    storage_factory = get_storage_factory(pool)
    storage = ContentStorageService(pool, storage_factory, AuditLogger(pool))
    image_bytes, meta = await storage.read_file_bytes_for_owner(UUID(str(content_id)), str(catalog_user_id))
    if not image_bytes:
        msg = "source_image_empty"
        raise ValueError(msg)
    if len(image_bytes) > _MAX_SOURCE_IMAGE_BYTES:
        msg = "source_image_too_large"
        raise ValueError(msg)
    magic_mime = companion_vision_mime_from_magic(image_bytes)
    meta_mime = str(meta.get("mime_type") or "").strip().lower()
    if magic_mime is None or not companion_vision_mime_allowed(magic_mime):
        msg = "source_image_unsupported_format"
        raise ValueError(msg)
    if meta_mime and meta_mime.startswith("image/") and meta_mime != magic_mime:
        msg = "source_image_magic_mismatch"
        raise ValueError(msg)
    return image_bytes, magic_mime


async def run_companion_image_generation_job(
    *,
    companion_pool: asyncpg.Pool,
    principal_id: str,
    run_id: str,
    step_id: str,
    catalog_user_id: str,
    prompt: str,
    aspect_ratio: str = "1:1",
    operation_mode: str = IMAGE_TOOL_MODE_GENERATE,
    source_content_id: str | None = None,
    negative_prompt: str = "",
) -> None:
    """Execute UGS image generation/editing and terminalize companion task run/step."""

    from api.ewa_platform.persistence_pg import companion_asyncpg as companion_pg

    mode = operation_mode if operation_mode in IMAGE_TOOL_MODES else IMAGE_TOOL_MODE_GENERATE
    intent_kind = IMAGE_EDIT_INTENT if mode == IMAGE_TOOL_MODE_EDIT else IMAGE_GENERATION_INTENT
    ar_key = (aspect_ratio or "1:1").strip()
    width, height = _ASPECT_PRESETS.get(ar_key, (1024, 1024))
    type_key = (
        companion_image_edit_type_key() if mode == IMAGE_TOOL_MODE_EDIT else companion_image_generation_type_key()
    )
    workflow_template = companion_image_generation_workflow_slug()
    seed = secrets.randbelow(2**31 - 1) + 1
    input_data: dict[str, Any]
    try:
        if mode == IMAGE_TOOL_MODE_EDIT:
            if not source_content_id:
                msg = "source_image_required"
                raise ValueError(msg)
            source_bytes, source_mime = await _load_source_image_for_edit(
                content_id=source_content_id,
                catalog_user_id=catalog_user_id,
            )
            from api.routers.creative_studio_utils import build_image_edit_input_data

            input_data = build_image_edit_input_data(
                prompt=prompt,
                image_base64=base64.b64encode(source_bytes).decode("ascii"),
                negative_prompt=negative_prompt,
                seed=seed,
                extra={
                    "ewa_companion_run_id": run_id,
                    "source_content_id": source_content_id,
                    "source_mime_type": source_mime,
                },
            )
        else:
            input_data = {
                "prompt": prompt,
                "width": width,
                "height": height,
                "seed": seed,
                "workflow_template": workflow_template,
                "ewa_companion_run_id": run_id,
            }
    except (OSError, RuntimeError, ValueError, PermissionError) as exc:
        logger.exception("[STEP] companion_image_source_prepare_failed run_id=%s err=%s", run_id, exc)
        await _fail_image_run(
            companion_pool,
            principal_id=principal_id,
            run_id=run_id,
            step_id=step_id,
            message=str(exc)[:400] or "image_source_prepare_failed",
            stage="source_prepare",
            intent_kind=intent_kind,
        )
        return

    logger.info(
        "[STEP] companion_image_job start run_id=%s mode=%s type_key=%s workflow=%s ar=%s",
        run_id,
        mode,
        type_key,
        workflow_template,
        ar_key,
    )

    try:
        from api.core.database_manager import DatabaseConnectionError, get_database_manager
        from api.services.ugs.unified_generation_service import UnifiedGenerationService

        manager = await get_database_manager()
        if not manager.postgres_session_factory:
            raise RuntimeError("postgres_session_factory_unavailable")
        async with manager.get_postgres_session() as db:
            ugs = UnifiedGenerationService(db)
            result = await ugs.generate_and_wait(
                user_id=str(catalog_user_id),
                type_key=type_key,
                input_data=input_data,
                timeout_seconds=180.0,
                poll_interval=1.0,
            )
    except TimeoutError:
        await _fail_image_run(
            companion_pool,
            principal_id=principal_id,
            run_id=run_id,
            step_id=step_id,
            message="image_generation_timeout",
            stage="ugs_wait",
            intent_kind=intent_kind,
        )
        return
    except (DatabaseConnectionError, OSError, RuntimeError, ValueError) as exc:
        logger.exception("[STEP] companion_image_generation_job_failed run_id=%s err=%s", run_id, exc)
        await _fail_image_run(
            companion_pool,
            principal_id=principal_id,
            run_id=run_id,
            step_id=step_id,
            message=str(exc)[:400] or "image_generation_failed",
            stage="ugs_call",
            intent_kind=intent_kind,
        )
        return

    status = str(result.get("status") or "")
    if status != "completed":
        detail = result.get("error") or result.get("message") or status
        await _fail_image_run(
            companion_pool,
            principal_id=principal_id,
            run_id=run_id,
            step_id=step_id,
            message=str(detail)[:400],
            stage="ugs_status",
            intent_kind=intent_kind,
        )
        return

    image_url = _public_url_from_ugs_result(result)
    content_id = _content_id_from_ugs_result(result)
    result_payload: dict[str, Any] = {
        "image_tool_mode": mode,
        "operation_mode": mode,
        "prompt_preview": prompt[:240],
        "type_key": type_key,
    }
    if mode == IMAGE_TOOL_MODE_EDIT:
        result_payload["source_content_id"] = source_content_id
        result_payload["source_unified_content_id"] = source_content_id
    else:
        result_payload["aspect_ratio"] = ar_key
        result_payload["workflow_template"] = workflow_template
    mime = _mime_type_from_ugs_result(result)
    if mime:
        result_payload["mime_type"] = mime
    if image_url:
        result_payload["image_url"] = image_url
    if content_id:
        result_payload["content_id"] = content_id
        result_payload["unified_content_id"] = content_id

    from api.ewa_platform.companion.jobs.task_events import publish_task_event_async
    from api.ewa_platform.companion.orchestration.run_lifecycle import apply_companion_run_terminal

    # E2: OCC before step/run terminalize so user cancel wins over late worker completion.
    run_row = await companion_pg.companion_task_run_fetch(companion_pool, run_id=run_id)
    if run_row is None:
        return
    updated = await apply_companion_run_terminal(
        companion_pool,
        run=run_row,
        status="completed",
        context="image_job_complete",
        result_payload=result_payload,
    )
    if updated is None:
        return
    await companion_pg.companion_task_step_update(
        companion_pool,
        step_id=step_id,
        status="completed",
        output_payload=result_payload,
    )

    await publish_task_event_async(
        principal_id=principal_id,
        event_name="task_completed",
        payload={
            "run_id": run_id,
            "status": "completed",
            "intent_kind": intent_kind,
            "result_payload": result_payload,
        },
    )
    from api.ewa_platform.companion.workflows.dag.dag_async_resume import maybe_advance_workflow_from_child_run

    if await maybe_advance_workflow_from_child_run(
        companion_pool,
        child_run_id=run_id,
        result_payload=result_payload,
    ):
        logger.info(
            "[STEP] companion_image_job_completed run_id=%s workflow=advanced mode=%s content_id=%s",
            run_id,
            mode,
            content_id or "",
        )
        from api.ewa_platform.agentic.jobs.child_reconcile import (
            maybe_complete_agentic_awaiting_child_from_run,
        )

        await maybe_complete_agentic_awaiting_child_from_run(
            companion_pool,
            child_run_id=run_id,
            principal_id=principal_id,
        )
        return
    from api.ewa_platform.agentic.jobs.child_reconcile import (
        maybe_complete_agentic_awaiting_child_from_run,
    )

    await maybe_complete_agentic_awaiting_child_from_run(
        companion_pool,
        child_run_id=run_id,
        principal_id=principal_id,
    )
    logger.info(
        "[STEP] companion_image_job_completed run_id=%s mode=%s content_id=%s url=%s",
        run_id,
        mode,
        content_id or "",
        "yes" if image_url else "no",
    )


async def _fail_image_run(
    pool: asyncpg.Pool,
    *,
    principal_id: str,
    run_id: str,
    step_id: str,
    message: str,
    stage: str,
    intent_kind: str = IMAGE_GENERATION_INTENT,
) -> None:
    from api.ewa_platform.companion.jobs.task_events import publish_task_event_async
    from api.ewa_platform.companion.orchestration.run_lifecycle import apply_companion_run_terminal
    from api.ewa_platform.persistence_pg import companion_asyncpg as companion_pg

    err = {"message": message[:400], "stage": stage[:80]}
    run = await companion_pg.companion_task_run_fetch(pool, run_id=run_id)
    if run is None:
        return
    updated = await apply_companion_run_terminal(
        pool,
        run=run,
        status="failed",
        context="image_job_fail",
        error_payload=err,
    )
    if updated is None:
        return
    await companion_pg.companion_task_step_update(
        pool,
        step_id=step_id,
        status="failed",
        error_payload=err,
    )
    await publish_task_event_async(
        principal_id=principal_id,
        event_name="task_failed",
        payload={
            "run_id": run_id,
            "status": "failed",
            "intent_kind": intent_kind,
            "error_payload": err,
        },
    )
    from api.ewa_platform.companion.workflows.dag.dag_async_resume import maybe_fail_workflow_from_child_run

    await maybe_fail_workflow_from_child_run(
        pool,
        child_run_id=run_id,
        error_payload=err,
    )
    from api.ewa_platform.agentic.jobs.child_reconcile import (
        maybe_complete_agentic_awaiting_child_from_run,
    )

    await maybe_complete_agentic_awaiting_child_from_run(
        pool,
        child_run_id=run_id,
        principal_id=principal_id,
    )


async def kick_stalled_companion_image_runs_for_principal(
    pool: asyncpg.Pool,
    *,
    principal_id: str,
    min_age_seconds: float = 45.0,
) -> int:
    """Re-enqueue image runs stuck in ``running`` without ever starting UGS (orphaned asyncio tasks)."""

    import asyncio
    from datetime import UTC, datetime

    from api.ewa_platform.companion.jobs.config import companion_async_jobs_enabled
    from api.ewa_platform.companion.jobs.enqueue import enqueue_companion_run
    from api.ewa_platform.persistence_pg import companion_asyncpg as companion_pg

    pid = str(principal_id or "").strip()
    if not pid:
        return 0
    runs = await companion_pg.companion_task_runs_list(pool, principal_id=pid, limit=16)
    kicked = 0
    now = datetime.now(tz=UTC)
    for run in runs:
        intent_kind = str(run.get("intent_kind") or "")
        if intent_kind not in IMAGE_ASYNC_INTENT_KINDS:
            continue
        if str(run.get("status") or "").strip().lower() != "running":
            continue
        run_id = str(run.get("id") or "").strip()
        if not run_id:
            continue
        created = run.get("created_at")
        updated = run.get("updated_at")
        if not isinstance(created, datetime):
            continue
        # E8 / V-M2: do not skip merely because updated_at > created_at (post-claim heartbeats).
        # Stall = age past min_age AND step still active without meaningful UGS/output progress.
        age_anchor = updated if isinstance(updated, datetime) else created
        age = (now - age_anchor.astimezone(UTC)).total_seconds()
        if age < min_age_seconds:
            continue
        steps = await companion_pg.companion_task_steps_list(pool, run_id=run_id)
        step = next((s for s in steps if int(s.get("step_index") or 0) == 1), steps[0] if steps else None)
        if step is None:
            continue
        st = str(step.get("status") or "").strip().lower()
        if st not in {"running", "pending", "in_progress"}:
            continue
        out = step.get("output_payload")
        if isinstance(out, Mapping) and out:
            # Progress already recorded — leave to UGS/image reaper, not kick.
            continue
        plan = run.get("plan_payload")
        if not isinstance(plan, Mapping):
            plan = {}
        catalog_uid = ""
        parent_id = str(plan.get("workflow_parent_run_id") or "").strip()
        if parent_id:
            parent = await companion_pg.companion_task_run_fetch(pool, run_id=parent_id)
            parent_plan = parent.get("plan_payload") if parent else None
            if isinstance(parent_plan, Mapping):
                raw = parent_plan.get("content_catalog_user_id")
                if raw is not None:
                    catalog_uid = str(raw).strip()
        if not catalog_uid:
            inp = step.get("input_payload")
            if isinstance(inp, Mapping):
                catalog_uid = str(inp.get("catalog_user_id") or "").strip()
        if not catalog_uid:
            continue
        operation_mode = str(plan.get("image_tool_mode") or plan.get("operation_mode") or "").strip() or (
            IMAGE_TOOL_MODE_EDIT if intent_kind == IMAGE_EDIT_INTENT else IMAGE_TOOL_MODE_GENERATE
        )
        source_content_id = str(plan.get("source_content_id") or plan.get("source_unified_content_id") or "").strip()
        prompt = str(plan.get("prompt_preview") or "").strip()
        inp = step.get("input_payload")
        if isinstance(inp, Mapping):
            if not prompt:
                prompt = str(inp.get("prompt") or inp.get("prompt_preview") or "").strip()
            if not source_content_id:
                source_content_id = str(inp.get("source_content_id") or "").strip()
        if len(prompt) < 3:
            prompt = str(run.get("user_message") or "").strip()
        aspect_ratio = str(plan.get("aspect_ratio") or "1:1").strip() or "1:1"
        if isinstance(inp, Mapping) and aspect_ratio == "1:1":
            aspect_ratio = str(inp.get("aspect_ratio") or aspect_ratio).strip() or "1:1"
        celery_id = enqueue_companion_run(
            run_id=run_id,
            step_index=1,
            job_payload={
                "catalog_user_id": catalog_uid,
                "prompt": prompt,
                "aspect_ratio": aspect_ratio,
                "operation_mode": operation_mode,
                "source_content_id": source_content_id or None,
            },
        )
        if celery_id:
            kicked += 1
            logger.info(
                "[STEP] companion_image_run_kick_enqueued run_id=%s celery_task_id=%s parent_run_id=%s",
                run_id,
                celery_id,
                parent_id or "",
            )
        elif not companion_async_jobs_enabled():
            step_id = str(step.get("id") or "")
            asyncio.create_task(
                run_companion_image_generation_job(
                    companion_pool=pool,
                    principal_id=pid,
                    run_id=run_id,
                    step_id=step_id,
                    catalog_user_id=catalog_uid,
                    prompt=prompt,
                    aspect_ratio=aspect_ratio,
                    operation_mode=operation_mode,
                    source_content_id=source_content_id or None,
                )
            )
            kicked += 1
            logger.info(
                "[STEP] companion_image_run_kick_inprocess run_id=%s parent_run_id=%s",
                run_id,
                parent_id or "",
            )
    return kicked
