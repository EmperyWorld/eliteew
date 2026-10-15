# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# ESP TFT ComfyUI image generation: LLM random prompt → UGS wait → WebP (240×280) → RGB565.
# Invariants:
# - Same device-token surface as esp-display turn; WebP always produced before TFT payload.
# - Default path: LLM invents a fresh English prompt (preset = style seed); static preset is fallback only.
# - No JWT on device; principal from ELITEEW_ESP_DISPLAY_PRINCIPAL_ID.
# Related:
# - documentation/product/ewa/EWA-ESP-DISPLAY-AI.md
# - api/ewa_platform/gateways/routers/esp_display.py
# ---
"""ESP desk display: LLM prompt → ComfyUI image → WebP → RGB565."""

from __future__ import annotations

import io
import logging
import os
import secrets
import time
from typing import Any, Final, Literal

from PIL import Image  # type: ignore[import-untyped]
from sqlalchemy.ext.asyncio import AsyncSession

from api.ewa_platform.companion.observability.degrade_log import companion_degrade_debug
from api.services.ugs.unified_generation_service import UnifiedGenerationService
from api.utils.llm_json_extract import strip_llm_channel_markup, strip_llm_thinking_prefix

logger = logging.getLogger(__name__)

EspImagePreset = Literal["scene", "abstract", "mascot"]
EspPromptSource = Literal["custom", "llm", "fallback"]

TFT_W: Final[int] = 240
TFT_H: Final[int] = 280
_WEBP_QUALITY: Final[int] = 72
_UGS_TYPE_KEY: Final[str] = "desktop_ai_chat_image_01_top"
_UGS_WORKFLOW: Final[str] = "01_top"
_PROMPT_UGS_TYPE: Final[str] = "image_studio_image_prompt"
_IMAGE_RATE_LIMIT_SEC: Final[float] = 45.0
_PROMPT_TIMEOUT_SEC: Final[float] = 45.0
_PROMPT_MAX_CHARS: Final[int] = 500


def _principal_id() -> str:
    return (os.getenv("ELITEEW_ESP_DISPLAY_PRINCIPAL_ID") or "").strip()


_PRESET_PROMPTS: Final[dict[EspImagePreset, str]] = {
    "scene": (
        "cozy desk gadget on a wooden table, soft warm lamp light, shallow depth of field, "
        "cinematic still, no text, no watermark"
    ),
    "abstract": (
        "abstract flowing neon geometry, deep teal and amber, glossy material, "
        "centered composition, no text, no watermark"
    ),
    "mascot": (
        "friendly small robot companion mascot, soft studio lighting, cute stylized, "
        "simple background, no text, no watermark"
    ),
}

_PRESET_SEED_IDEAS: Final[dict[EspImagePreset, tuple[str, ...]]] = {
    "scene": (
        "tiny desk weather station glowing at night",
        "rainy cafe window with a warm lamp and plants",
        "wooden workbench with tools and soft morning light",
        "bookshelf corner with a cup of tea and headphones",
        "balcony at dusk with city lights far away",
    ),
    "abstract": (
        "liquid metal ribbons in deep teal and amber",
        "crystalline origami forms floating in fog",
        "aurora ribbons over a glossy black void",
        "impossible stairs made of neon glass",
        "ink blooms expanding in still water",
    ),
    "mascot": (
        "friendly round robot with big eyes holding a coffee cup",
        "tiny fox-like companion wearing a scarf",
        "cute desk drone with soft LED cheeks",
        "small owl bot perched on a keyboard",
        "cheerful capsule robot with antenna and backpack",
    ),
}

_PRESET_STYLE_HINTS: Final[dict[EspImagePreset, str]] = {
    "scene": "photoreal cinematic still life, shallow depth of field, warm practical lights",
    "abstract": "abstract surreal 3D, glossy materials, bold color contrast, centered composition",
    "mascot": "cute stylized character, soft studio lighting, simple clean background",
}

_last_image_monotonic: float = 0.0


def reset_esp_display_image_rate_limit_for_tests() -> None:
    global _last_image_monotonic
    _last_image_monotonic = 0.0


def image_rate_limit_allow(*, now: float | None = None) -> bool:
    global _last_image_monotonic
    t = time.monotonic() if now is None else now
    if _last_image_monotonic > 0.0 and (t - _last_image_monotonic) < _IMAGE_RATE_LIMIT_SEC:
        return False
    _last_image_monotonic = t
    return True


def resolve_image_prompt(preset: EspImagePreset, prompt: str | None) -> str:
    """Resolve custom override or static preset fallback (no LLM)."""

    custom = (prompt or "").strip()
    if len(custom) >= 3:
        return custom[:_PROMPT_MAX_CHARS]
    return _PRESET_PROMPTS[preset]


def sanitize_image_prompt_text(raw: str) -> str:
    """Strip llama channel/thinking wrappers; keep Comfy-ready prompt text."""

    original = raw or ""
    text = strip_llm_thinking_prefix(strip_llm_channel_markup(original)).strip()
    if not text:
        return ""
    low = original.lower()
    if "<|channel" in low or "<channel|" in low:
        lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
        if len(lines) >= 2:
            for i, ln in enumerate(lines):
                if "," in ln or len(ln) >= 48:
                    return "\n".join(lines[i:]).strip()
            return lines[-1]
    # Prefer single-line comma prompt when model added a short preamble.
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    if len(lines) >= 2:
        for ln in reversed(lines):
            if "," in ln or len(ln) >= 40:
                return ln[:_PROMPT_MAX_CHARS]
    return text[:_PROMPT_MAX_CHARS]


def _text_from_ugs_prompt_result(ugs_result: dict[str, Any]) -> str:
    block = ugs_result.get("result") or {}
    raw = ""
    if isinstance(block, dict):
        if isinstance(block.get("result"), dict):
            inner = block["result"]
            raw = str(inner.get("text") or inner.get("content") or inner.get("response") or "")
        else:
            raw = str(block.get("text") or block.get("content") or block.get("response") or "")
    return sanitize_image_prompt_text(raw)


def _ensure_no_text_clause(prompt: str) -> str:
    low = prompt.lower()
    if "no text" in low and "watermark" in low:
        return prompt
    suffix = "no text, no watermark"
    if prompt.endswith(","):
        return f"{prompt} {suffix}"
    return f"{prompt}, {suffix}"


def build_llm_prompt_messages(preset: EspImagePreset, *, entropy: str | None = None) -> list[dict[str, str]]:
    """Build Image Studio–style messages; entropy keeps each GEN roll unique."""

    idea = secrets.choice(_PRESET_SEED_IDEAS[preset])
    spice = (entropy or secrets.token_hex(3)).strip()
    style = _PRESET_STYLE_HINTS[preset]
    system_prompt = (
        "You are an expert prompt engineer for text-to-image diffusion models. "
        "Reply with ONLY the image prompt text: no titles, no quotes, no markdown, no explanations. "
        "Use comma-separated English keywords and short phrases. "
        "Include subject, style, lighting, composition, and quality hints. "
        "Never include readable text, letters, logos, or watermarks in the scene."
    )
    user_prompt = (
        f"Invent one fresh random scene for a 240x280 desk TFT wallpaper.\n"
        f"Theme family: {preset}\n"
        f"Seed idea (vary freely, do not copy verbatim): {idea}\n"
        f"Style hints: {style}\n"
        f"Entropy token (must change details): {spice}\n"
        "Write the final prompt in English only (comma-separated phrases)."
    )
    return [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]


async def llm_compose_image_prompt(
    db: AsyncSession,
    *,
    principal_id: str,
    preset: EspImagePreset,
    timeout_seconds: float = _PROMPT_TIMEOUT_SEC,
) -> str | None:
    """Ask UGS Llama (image_studio_image_prompt) for a fresh English Comfy prompt."""

    ugs = UnifiedGenerationService(db)
    try:
        result = await ugs.generate_and_wait(
            user_id=principal_id,
            type_key=_PROMPT_UGS_TYPE,
            input_data={"messages": build_llm_prompt_messages(preset)},
            timeout_seconds=timeout_seconds,
            poll_interval=1.0,
        )
    except Exception as e:
        companion_degrade_debug(
            logger,
            "esp_display_image_llm_prompt",
            "ugs_prompt_call_failed",
            exc=e,
            preset=preset,
        )
        return None

    status = str(result.get("status") or "")
    if status != "completed":
        companion_degrade_debug(
            logger,
            "esp_display_image_llm_prompt_incomplete",
            "ugs_prompt_not_completed",
            preset=preset,
            status=status,
        )
        return None

    text = _text_from_ugs_prompt_result(result)
    if len(text) < 12:
        companion_degrade_debug(
            logger,
            "esp_display_image_llm_prompt_empty",
            "ugs_prompt_too_short",
            preset=preset,
            prompt_len=len(text),
        )
        return None
    return _ensure_no_text_clause(text[:_PROMPT_MAX_CHARS])


async def compose_image_prompt(
    db: AsyncSession,
    *,
    principal_id: str,
    preset: EspImagePreset,
    prompt: str | None,
) -> tuple[str, EspPromptSource]:
    """Custom override → LLM random → static preset fallback."""

    custom = (prompt or "").strip()
    if len(custom) >= 3:
        return custom[:_PROMPT_MAX_CHARS], "custom"

    llm = await llm_compose_image_prompt(db, principal_id=principal_id, preset=preset)
    if llm:
        return llm, "llm"

    companion_degrade_debug(
        logger,
        "esp_display_image_prompt_fallback_preset",
        "using_static_preset_prompt",
        preset=preset,
    )
    return _PRESET_PROMPTS[preset], "fallback"


def encode_cover_webp(raw: bytes, *, width: int = TFT_W, height: int = TFT_H) -> bytes:
    """Resize/crop to TFT size and encode WebP (light transfer + display pipeline)."""

    with Image.open(io.BytesIO(raw)) as im:
        img = im.convert("RGB")
        src_w, src_h = img.size
        scale = max(width / max(src_w, 1), height / max(src_h, 1))
        new_w = max(1, int(src_w * scale + 0.5))
        new_h = max(1, int(src_h * scale + 0.5))
        img = img.resize((new_w, new_h), Image.Resampling.LANCZOS)
        left = max(0, (new_w - width) // 2)
        top = max(0, (new_h - height) // 2)
        img = img.crop((left, top, left + width, top + height))
        out = io.BytesIO()
        img.save(out, format="WEBP", quality=_WEBP_QUALITY, method=4)
        return out.getvalue()


def webp_to_rgb565_le(webp_bytes: bytes) -> bytes:
    """Decode WebP → little-endian RGB565 rows for ST7789 blit."""

    with Image.open(io.BytesIO(webp_bytes)) as im:
        img = im.convert("RGB")
        if img.size != (TFT_W, TFT_H):
            img = img.resize((TFT_W, TFT_H), Image.Resampling.LANCZOS)
        px = img.load()
        if px is None:
            msg = "PIL PixelAccess unavailable after WebP decode"
            raise RuntimeError(msg)
        out = bytearray(TFT_W * TFT_H * 2)
        i = 0
        for y in range(TFT_H):
            for x in range(TFT_W):
                r, g, b = px[x, y]
                value = ((r & 0xF8) << 8) | ((g & 0xFC) << 3) | (b >> 3)
                out[i] = value & 0xFF
                out[i + 1] = (value >> 8) & 0xFF
                i += 2
        return bytes(out)


def _content_id_from_ugs(result: dict[str, Any]) -> str | None:
    res = result.get("result")
    if isinstance(res, dict):
        images = res.get("images")
        if isinstance(images, list) and images:
            first = images[0]
            if isinstance(first, dict) and first.get("content_id"):
                return str(first["content_id"])
        if res.get("content_id"):
            return str(res["content_id"])
    return None


async def _load_unified_bytes(content_id: str) -> bytes | None:
    from uuid import UUID

    from api.core.database_manager import get_asyncpg_pool
    from api.services.unified_content.storage_backends.minio_storage import SeaweedFSStorage

    try:
        cid = UUID(content_id)
    except ValueError:
        return None
    pool = await get_asyncpg_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT file_path, storage_backend::text AS storage_backend, file_data
            FROM unified_content
            WHERE id = $1 AND deleted_at IS NULL
            """,
            cid,
        )
    if not row:
        return None
    sb = (row["storage_backend"] or "postgresql").lower()
    file_data = row["file_data"]
    if sb in ("minio", "seaweedfs") and row["file_path"]:
        storage = SeaweedFSStorage()
        file_data = await storage.retrieve(row["file_path"] or "", cid)
    if not file_data:
        return None
    return bytes(file_data)


async def run_esp_display_image(
    db: AsyncSession,
    *,
    preset: EspImagePreset = "scene",
    prompt: str | None = None,
    timeout_seconds: float = 150.0,
) -> dict[str, Any]:
    """LLM prompt (unless custom) → UGS/Comfy → WebP → RGB565 payloads."""

    principal_id = _principal_id()
    if not principal_id:
        raise RuntimeError("esp_display_principal_unconfigured")

    text, prompt_source = await compose_image_prompt(
        db,
        principal_id=principal_id,
        preset=preset,
        prompt=prompt,
    )
    seed = secrets.randbelow(2**31 - 2) + 1
    input_data: dict[str, Any] = {
        "prompt": text,
        "width": 512,
        "height": 512,
        "seed": seed,
        "workflow_template": _UGS_WORKFLOW,
    }
    logger.info(
        "[STEP] esp_display_image_start principal=%s preset=%s prompt_source=%s prompt_len=%s",
        principal_id,
        preset,
        prompt_source,
        len(text),
    )
    ugs = UnifiedGenerationService(db)
    result = await ugs.generate_and_wait(
        user_id=principal_id,
        type_key=_UGS_TYPE_KEY,
        input_data=input_data,
        timeout_seconds=timeout_seconds,
        poll_interval=1.5,
    )
    status = str(result.get("status") or "")
    if status != "completed":
        detail = result.get("error") or result.get("message") or status
        raise RuntimeError(f"esp_display_image_incomplete:{detail}")

    cid = _content_id_from_ugs(result)
    if not cid:
        raise RuntimeError("esp_display_image_no_content")
    raw = await _load_unified_bytes(cid)
    if not raw:
        raise RuntimeError("esp_display_image_bytes_missing")

    webp = encode_cover_webp(raw)
    rgb565 = webp_to_rgb565_le(webp)
    logger.info(
        "[STEP] esp_display_image_ok content_id=%s prompt_source=%s webp_bytes=%s rgb565_bytes=%s",
        cid,
        prompt_source,
        len(webp),
        len(rgb565),
    )
    return {
        "ok": True,
        "preset": preset,
        "prompt": text,
        "prompt_source": prompt_source,
        "content_id": cid,
        "width": TFT_W,
        "height": TFT_H,
        "webp": webp,
        "rgb565": rgb565,
        "webp_bytes": len(webp),
    }


__all__ = (
    "EspImagePreset",
    "EspPromptSource",
    "TFT_H",
    "TFT_W",
    "build_llm_prompt_messages",
    "compose_image_prompt",
    "encode_cover_webp",
    "image_rate_limit_allow",
    "llm_compose_image_prompt",
    "reset_esp_display_image_rate_limit_for_tests",
    "resolve_image_prompt",
    "run_esp_display_image",
    "sanitize_image_prompt_text",
    "webp_to_rgb565_le",
)
