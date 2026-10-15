# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Validate companion chat image attachments and build OpenAI-compatible multimodal user ``content`` for llama-server
# (Gemma 4 vision via ``--mmproj``). Stored transcript keeps a text marker only — no base64 in ``desktop_friend_chat_v1``.
# Invariants:
# - Allowed MIME: JPEG/PNG/WebP (Gemma 4 + llama.cpp mtmd); decoded payload capped at 4 MiB.
# - Gated by ``EWA_COMPANION_VISION_ENABLED`` (default on); when off, callers get ``companion_vision_disabled``.
# - Multimodal stack2 (mmproj) is opt-in via ``EWA_COMPANION_VISION_MULTIMODAL``; otherwise OCR+LLM fallback.
# Related:
# - api/ewa_platform/companion/turn/chat_turn.py
# - api/utils/llm_openai_compat_http.py
# - docker/stack/stack2.yml (``LLAMA_CHAT_MMPROJ_FILE``)
# ---
"""Companion chat turn: optional image attachment → multimodal LLM user message."""

from __future__ import annotations

import base64
import binascii
import re
from collections.abc import Mapping
from typing import Any

from api.ewa_platform.companion.contracts.vision_formats import (
    COMPANION_VISION_ALLOWED_MIMES,
    companion_vision_mime_allowed,
    companion_vision_mime_from_magic,
)
from api.ewa_platform.settings.access import ewa_getenv

_COMPANION_VISION_MAX_BYTES = 4 * 1024 * 1024
_COMPANION_VISION_HISTORY_MARKER = "[Изображение]"
_DATA_URL_RE = re.compile(r"^data:(image/[a-z0-9.+-]+);base64,(.+)$", re.IGNORECASE | re.DOTALL)


def companion_vision_enabled() -> bool:
    raw = ewa_getenv("EWA_COMPANION_VISION_ENABLED", "1").strip().lower()
    return raw not in ("0", "false", "no", "off")


def companion_stored_user_line_for_turn(user_line: str, *, has_image: bool) -> str:
    """Persisted transcript line — image turns get a marker, never embedded bytes."""

    text = (user_line or "").strip()
    if not has_image:
        return text
    if not text:
        return _COMPANION_VISION_HISTORY_MARKER
    return f"{text}\n{_COMPANION_VISION_HISTORY_MARKER}"


def build_openai_user_content_with_image(user_text: str, data_url: str) -> list[dict[str, Any]]:
    """OpenAI-style multimodal ``content`` array for llama.cpp ``/v1/chat/completions``."""

    parts: list[dict[str, Any]] = []
    prompt = (user_text or "").strip()
    if not prompt:
        prompt = "Опиши изображение."
    parts.append({"type": "text", "text": prompt})
    parts.append({"type": "image_url", "image_url": {"url": data_url}})
    return parts


def inject_turn_vision_into_llm_messages(
    llm_messages: list[dict[str, Any]],
    *,
    user_text: str,
    data_url: str,
) -> None:
    """Replace the last ``user`` row in ``llm_messages`` with multimodal content (current turn)."""

    content = build_openai_user_content_with_image(user_text, data_url)
    for idx in range(len(llm_messages) - 1, -1, -1):
        if llm_messages[idx].get("role") == "user":
            llm_messages[idx] = {"role": "user", "content": content}
            return
    llm_messages.append({"role": "user", "content": content})


def companion_vision_multimodal_enabled() -> bool:
    """True when stack2 llama-chat is expected to accept ``image_url`` (mmproj loaded). Default **off**."""

    raw = ewa_getenv("EWA_COMPANION_VISION_MULTIMODAL", "0").strip().lower()
    return raw in ("1", "true", "yes", "on")


def decode_companion_image_attachment_bytes(raw: Mapping[str, Any]) -> tuple[bytes, str]:
    """Validate attachment and return decoded bytes + canonical MIME."""

    data_url = resolve_companion_vision_data_url(raw)
    match = _DATA_URL_RE.match(data_url)
    if match is None:
        msg = "companion_vision_invalid_data_url"
        raise ValueError(msg)
    mime_type = match.group(1).lower()
    payload_b64 = match.group(2).strip()
    decoded = base64.b64decode(payload_b64, validate=True)
    return decoded, mime_type


def resolve_companion_vision_data_url(raw: Mapping[str, Any] | None) -> str:
    """Validate inbound attachment and return ``data:<mime>;base64,...`` for the LLM."""

    if raw is None:
        msg = "companion_vision_attachment_required"
        raise ValueError(msg)
    if not companion_vision_enabled():
        msg = "companion_vision_disabled"
        raise ValueError(msg)

    mime_raw = str(raw.get("mime_type") or raw.get("mimeType") or "").strip().lower()
    b64_raw = str(raw.get("data_base64") or raw.get("dataBase64") or "").strip()
    if not b64_raw:
        msg = "companion_vision_data_required"
        raise ValueError(msg)

    if b64_raw.startswith("data:"):
        match = _DATA_URL_RE.match(b64_raw)
        if match is None:
            msg = "companion_vision_invalid_data_url"
            raise ValueError(msg)
        mime_from_url = match.group(1).lower()
        if mime_from_url not in COMPANION_VISION_ALLOWED_MIMES:
            msg = "companion_vision_mime_not_allowed"
            raise ValueError(msg)
        payload_b64 = match.group(2).strip()
        try:
            decoded = base64.b64decode(payload_b64, validate=True)
        except (binascii.Error, ValueError) as exc:
            msg = "companion_vision_invalid_base64"
            raise ValueError(msg) from exc
        magic_mime = companion_vision_mime_from_magic(decoded)
        if magic_mime is None or magic_mime != mime_from_url:
            msg = "companion_vision_magic_mismatch"
            raise ValueError(msg)
        if len(decoded) > _COMPANION_VISION_MAX_BYTES:
            msg = "companion_vision_too_large"
            raise ValueError(msg)
        return f"data:{mime_from_url};base64,{payload_b64}"

    if not companion_vision_mime_allowed(mime_raw):
        msg = "companion_vision_mime_not_allowed"
        raise ValueError(msg)

    try:
        decoded = base64.b64decode(b64_raw, validate=True)
    except (binascii.Error, ValueError) as exc:
        msg = "companion_vision_invalid_base64"
        raise ValueError(msg) from exc
    magic_mime = companion_vision_mime_from_magic(decoded)
    if magic_mime is None:
        msg = "companion_vision_unsupported_format"
        raise ValueError(msg)
    if magic_mime != mime_raw:
        msg = "companion_vision_magic_mismatch"
        raise ValueError(msg)
    if len(decoded) > _COMPANION_VISION_MAX_BYTES:
        msg = "companion_vision_too_large"
        raise ValueError(msg)
    return f"data:{magic_mime};base64,{b64_raw}"
