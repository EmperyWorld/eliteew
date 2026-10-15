"""Generate image via UGS (ComfyUI), опционально — вложение unified_content к чату."""

from __future__ import annotations

import asyncio
import logging
import secrets
from typing import Any
from uuid import UUID

import asyncpg  # type: ignore[import-untyped]
from sqlalchemy.ext.asyncio import AsyncSession

from api.services.desktop_chat.attachments import (
    attach_unified_content_to_desktop_ai_chat,
    parse_uuid_loose,
)
from api.services.ugs.unified_generation_service import UnifiedGenerationService

logger = logging.getLogger(__name__)

TOOL_NAME = "desktop_generate_image"

_ASPECT_PRESETS: dict[str, tuple[int, int]] = {
    "1:1": (1024, 1024),
    "16:9": (1344, 768),
    "9:16": (768, 1344),
    "4:3": (1024, 768),
    "3:4": (768, 1024),
}

LLAMA_TOOL = {
    "type": "function",
    "function": {
        "name": TOOL_NAME,
        "description": (
            "Сгенерировать изображение через UGS (очередь) и ComfyUI. "
            "Обязательно передай развёрнутый prompt (сцена, стиль, детали). "
            "Соотношение сторон — aspect_ratio; seed задаётся на сервере случайно, не передавай его. "
            "Не вызывай инструмент с пустым или односложным prompt."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "prompt": {
                    "type": "string",
                    "description": "Позитивный промпт: что изобразить (объект, свет, стиль, настроение).",
                },
                "aspect_ratio": {
                    "type": "string",
                    "description": "Соотношение сторон",
                    "enum": ["1:1", "16:9", "9:16", "4:3", "3:4"],
                    "default": "1:1",
                },
            },
            "required": ["prompt"],
        },
    },
}


def _public_url_from_result(result: dict[str, Any]) -> str | None:
    for key in ("result_url", "image_url", "url"):
        val = result.get(key)
        if isinstance(val, str) and val.strip():
            return val.strip()
    res = result.get("result")
    if isinstance(res, dict):
        for key in ("url", "image_url", "result_url"):
            val = res.get(key)
            if isinstance(val, str) and val.strip():
                return val.strip()
        images = res.get("images")
        if isinstance(images, list) and images:
            first = images[0]
            if isinstance(first, dict):
                for key in ("url", "image_url", "data_uri"):
                    val = first.get(key)
                    if isinstance(val, str) and val.strip():
                        return val.strip()
    return None


def _content_id_from_completed(result: dict[str, Any]) -> UUID | None:
    res = result.get("result")
    if isinstance(res, dict):
        images = res.get("images")
        if isinstance(images, list) and images:
            first = images[0]
            if isinstance(first, dict):
                cid = parse_uuid_loose(first.get("content_id"))
                if cid:
                    return cid
        cid = parse_uuid_loose(res.get("content_id"))
        if cid:
            return cid
    return None


async def run_image_ugs(
    db: AsyncSession,
    db_pool: asyncpg.Pool,
    *,
    user_id: UUID,
    type_key: str,
    arguments: dict[str, Any],
    company_id: UUID | None,
    project_id: UUID | None,
    defaults: dict[str, Any],
    desktop_chat_id: UUID | None = None,
    tool_progress_queue: asyncio.Queue[dict[str, Any]] | None = None,
) -> str:
    prompt = str(arguments.get("prompt") or "").strip()
    if len(prompt) < 3:
        return "Ошибка: укажи осмысленный prompt для изображения (что нарисовать)."

    if not defaults.get("tools_image_enabled", True):
        return "Инструмент генерации изображений отключён администратором."

    eff_type_key = str(type_key or "").strip() or "desktop_ai_chat_image_01_top"
    workflow_template = str(
        arguments.get("workflow_template") or defaults.get("image_generation_workflow_slug") or "01_top"
    ).strip()

    ar_key = str(arguments.get("aspect_ratio") or "1:1").strip()
    width, height = _ASPECT_PRESETS.get(ar_key, (1024, 1024))

    max_seed = 2**31 - 1
    seed = secrets.randbelow(max_seed) + 1

    input_data: dict[str, Any] = {
        "prompt": prompt,
        "width": width,
        "height": height,
        "seed": seed,
        "workflow_template": workflow_template,
    }

    logger.info(
        "[STEP] desktop_generate_image start user_id=%s type_key=%s workflow=%sar=%s",
        user_id,
        eff_type_key,
        workflow_template,
        ar_key,
    )

    async def _on_status(status_payload: dict[str, Any]) -> None:
        if tool_progress_queue is None:
            return
        slim = {
            "request_id": status_payload.get("request_id"),
            "status": status_payload.get("status"),
            "stage": status_payload.get("stage"),
            "progress": status_payload.get("progress"),
            "progress_message": status_payload.get("progress_message"),
            "queue_status": status_payload.get("queue_status"),
        }
        try:
            tool_progress_queue.put_nowait({"event": "tools_progress", "ugs": slim})
        except Exception as q_err:
            logger.debug("desktop_generate_image progress queue: %s", q_err)

    try:
        ugs = UnifiedGenerationService(db)
        result = await ugs.generate_and_wait(
            user_id=str(user_id),
            type_key=eff_type_key,
            input_data=input_data,
            project_id=str(project_id) if project_id else None,
            company_id=str(company_id) if company_id else None,
            timeout_seconds=180.0,
            poll_interval=1.0,
            on_status=_on_status,
        )
    except TimeoutError as e:
        logger.warning("[STEP] desktop_generate_image timeout: %s", e)
        return "Ошибка: превышено время ожидания генерации (UGS/Comfy). Попробуй позже или упрости запрос."
    except Exception as e:
        logger.exception("[STEP] desktop_generate_image UGS failed: %s", e)
        return f"Ошибка генерации изображения (UGS/Comfy): {e!s}"

    status = str(result.get("status") or "")
    if status != "completed":
        detail = result.get("error") or result.get("message") or result
        logger.warning(
            "[STEP] desktop_generate_image incomplete status=%s detail=%s",
            status,
            detail,
        )
        return f"Генерация изображения не завершена (status={status}). Детали: {detail}"

    url = _public_url_from_result(result)
    cid = _content_id_from_completed(result)

    attach_note = ""
    if desktop_chat_id is not None and cid is not None:
        try:
            created_att, rag_ok = await attach_unified_content_to_desktop_ai_chat(
                db,
                db_pool,
                chat_id=desktop_chat_id,
                user_id=user_id,
                content_id=cid,
                source_label=f"UGS image {workflow_template}",
            )
            if created_att:
                attach_note = "\nВложение к чату добавлено." + (
                    " Индекс RAG чата: ок."
                    if rag_ok
                    else " Индекс RAG: не выполнен (текст content короткий или Qdrant недоступен)."
                )
            else:
                attach_note = "\nВложение уже было у этого чата; при необходимости обновлён индекс RAG."
            logger.info(
                "[STEP] desktop_generate_image attached content_id=%s chat_id=%s rag_ok=%s created=%s",
                cid,
                desktop_chat_id,
                rag_ok,
                created_att,
            )
        except Exception as att_e:
            logger.exception("[STEP] desktop_generate_image attach failed: %s", att_e)
            attach_note = f"\nНе удалось привязать к чату: {att_e!s}"

    if url:
        logger.info("[STEP] desktop_generate_image completed url_present=1 content_id=%s", cid)
        base = f"Изображение готово. URL: {url}"
        if cid:
            base += f"\nunified_content_id: {cid}"
        return base + attach_note

    if cid:
        logger.info("[STEP] desktop_generate_image completed url_present=0 content_id=%s", cid)
        return f"Изображение сохранено в файловом менеджере. content_id: {cid}" + attach_note

    logger.info("[STEP] desktop_generate_image completed url_present=0 keys=%s", list(result.keys()))
    return f"Изображение создано, но нет URL и content_id в ответе. raw_keys={list(result.keys())}"
