# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Server-side OCR fallback for companion image attachments when stack2 chat has no mmproj (e.g. Gemma 26B).
# Invariants:
# - OCR text is injected into the LLM prompt only; transcript keeps ``[Изображение]`` marker without full OCR body.
# - Uses Stack4 Tesseract via ``Stack4DocumentGateway``; empty OCR yields an explicit limitation block.
# Related:
# - api/ewa_platform/companion/turn/vision_attachment.py
# - documentation/product/ewa/EWA-COMPANION-VISION-MULTIMODAL.md
# ---

from __future__ import annotations

import logging
from collections.abc import Mapping

from api.ewa_platform.companion.turn.phases.visible_reply import truncate_text
from api.ewa_platform.companion.turn.vision_attachment import decode_companion_image_attachment_bytes
from api.ewa_platform.settings.access import ewa_getenv

logger = logging.getLogger(__name__)

_MAX_OCR_PROMPT_CHARS = 12_000
_OCR_MARKER = "[Изображение — распознанный текст (OCR)]"
_OCR_EMPTY_MARKER = (
    "[Изображение — OCR: текст на картинке не найден. "
    "Pixel-level vision на текущем stack2 недоступен; ответь по вопросу пользователя и честно укажи ограничение.]"
)


def companion_vision_ocr_language() -> str:
    raw = ewa_getenv("EWA_COMPANION_VISION_OCR_LANG", "rus+eng").strip()
    return raw or "rus+eng"


def format_companion_image_ocr_context(*, ocr_text: str) -> str:
    """LLM-only block appended to the current user turn (not stored verbatim in transcript)."""

    body = truncate_text(ocr_text.strip(), _MAX_OCR_PROMPT_CHARS)
    if body:
        return f"{_OCR_MARKER}\n{body}"
    return _OCR_EMPTY_MARKER


def build_llm_user_line_with_image_ocr(*, user_line: str, image_ocr_context: str) -> str:
    prompt = (user_line or "").strip() or "Опиши, что на изображении."
    ctx = (image_ocr_context or "").strip()
    if not ctx:
        return prompt
    return f"{prompt}\n\n{ctx}"


async def companion_ocr_text_from_image_attachment(raw: Mapping[str, object]) -> str:
    """Run Stack4 OCR on a validated companion image attachment."""

    image_bytes, mime_type = decode_companion_image_attachment_bytes(raw)
    suffix = "jpg" if mime_type == "image/jpeg" else mime_type.rsplit("/", 1)[-1]
    filename = f"companion-attach.{suffix}"
    lang = companion_vision_ocr_language()

    from api.services.stack4.document_gateway import (  # noqa: PLC0415
        Stack4ServiceUnavailable,
        get_stack4_document_gateway,
    )

    gateway = get_stack4_document_gateway()
    try:
        text = await gateway.ocr_image_to_text(image_bytes, filename, lang=lang)
    except Stack4ServiceUnavailable as exc:
        logger.warning("[STEP] companion_vision_ocr_fallback_skip reason=stack4_unavailable err=%s", exc)
        return ""
    except Exception as exc:  # noqa: BLE001
        logger.warning("[STEP] companion_vision_ocr_fallback_failed err=%s", exc)
        return ""
    return text.strip()


__all__ = (
    "build_llm_user_line_with_image_ocr",
    "companion_ocr_text_from_image_attachment",
    "companion_vision_ocr_language",
    "format_companion_image_ocr_context",
)
