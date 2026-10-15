# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# ESP TFT desk-display companion surface: display-safe intents, reply truncation, rate limit, turn runner.
# Invariants:
# - Default feature flag off; device token auth only; orchestration skipped via surface=esp_display.
# - No voice/STT; ambient scalars are optional context only.
# Related:
# - documentation/product/ewa/EWA-ESP-DISPLAY-AI.md
# - api/ewa_platform/gateways/routers/esp_display.py
# ---
"""ESP TFT ↔ EWA companion (button intents, no voice)."""

from __future__ import annotations

import hmac
import logging
import os
import re
import time
from collections.abc import Mapping
from typing import Any, Final, Literal

import asyncpg

from api.core.auth import User
from api.ewa_platform.companion.turn.chat_turn import execute_companion_chat_message

logger = logging.getLogger(__name__)

EspDisplayIntent = Literal["status", "encourage", "next_step", "ambient"]

ESP_DISPLAY_SURFACE: Final[str] = "esp_display"
_MAX_REPLY_CHARS: Final[int] = 78  # 3 TFT lines × ~26 cells (Cyrillic GFX font)
_MAX_REPLY_LINES: Final[int] = 3
_MAX_LINE_COLS: Final[int] = 26
_RATE_LIMIT_SEC: Final[float] = 8.0

_INTENT_PROMPTS: Final[dict[EspDisplayIntent, str]] = {
    "status": (
        "Кратко скажи, как у тебя дела как у спутника, и одним предложением — "
        "на чём сейчас полезно сфокусироваться. Без списков."
    ),
    "encourage": ("Поддержи меня коротко и тепло — одно-два предложения, без советов-списков."),
    "next_step": ("Назови один конкретный следующий шаг на сегодня. Одно-два предложения."),
    "ambient": (
        "Учти показания датчиков с устройства (если есть) и ответь коротко: "
        "как обстоят дела в комнате и что мягко посоветуешь. Без списков."
    ),
}

_DISPLAY_INSTRUCTION: Final[str] = (
    "[Поверхность ESP TFT 240×280: ответь по-русски очень кратко — "
    "не больше трёх коротких фраз, суммарно до ~70 символов. "
    "Без markdown, ссылок, списков и эмодзи.]"
)

_last_turn_monotonic: float = 0.0


def esp_display_ai_enabled() -> bool:
    return (os.getenv("ELITEEW_ESP_DISPLAY_AI_ENABLED") or "").strip().lower() in {
        "1",
        "true",
        "yes",
        "on",
    }


def esp_display_device_token_expected() -> str:
    return (os.getenv("ELITEEW_ESP_DISPLAY_DEVICE_TOKEN") or "").strip()


def esp_display_principal_id() -> str:
    return (os.getenv("ELITEEW_ESP_DISPLAY_PRINCIPAL_ID") or "").strip()


def verify_esp_display_token(provided: str | None) -> bool:
    expected = esp_display_device_token_expected()
    if not expected or not provided:
        return False
    return hmac.compare_digest(provided.strip(), expected)


def rate_limit_allow(*, now: float | None = None) -> bool:
    """Process-local spacing between ESP display turns."""

    global _last_turn_monotonic
    t = time.monotonic() if now is None else now
    if _last_turn_monotonic > 0.0 and (t - _last_turn_monotonic) < _RATE_LIMIT_SEC:
        return False
    _last_turn_monotonic = t
    return True


def reset_esp_display_rate_limit_for_tests() -> None:
    global _last_turn_monotonic
    _last_turn_monotonic = 0.0


def intent_user_prompt(intent: EspDisplayIntent) -> str:
    return _INTENT_PROMPTS[intent]


def format_ambient_prefix(ambient: Mapping[str, Any] | None) -> str:
    if not ambient:
        return ""
    parts: list[str] = []
    temp = ambient.get("temp_c")
    if isinstance(temp, (int, float)):
        parts.append(f"температура {float(temp):.1f}°C")
    hum = ambient.get("humidity_pct")
    if isinstance(hum, (int, float)):
        parts.append(f"влажность {float(hum):.0f}%")
    level = ambient.get("sound_level")
    if isinstance(level, (int, float)):
        parts.append(f"уровень звука ADC {int(level)}")
    triggered = ambient.get("sound_triggered")
    if isinstance(triggered, bool):
        parts.append("порог шума сработал" if triggered else "порог шума не сработал")
    if not parts:
        return ""
    return "Показания устройства: " + "; ".join(parts) + "."


def build_esp_display_user_line(intent: EspDisplayIntent, ambient: Mapping[str, Any] | None) -> str:
    chunks = [intent_user_prompt(intent)]
    amb = format_ambient_prefix(ambient)
    if amb:
        chunks.append(amb)
    chunks.append(_DISPLAY_INSTRUCTION)
    return "\n\n".join(chunks)


_MD_NOISE = re.compile(r"[#*_`>|]+")
_EMOJI_NOISE = re.compile(
    "[\U0001f300-\U0001faff\U00002700-\U000027bf\U0001f900-\U0001f9ff\U00002600-\U000026ff]+",
    flags=re.UNICODE,
)


def truncate_reply_to_lines(
    reply: str,
    *,
    max_chars: int = _MAX_REPLY_CHARS,
    max_lines: int = _MAX_REPLY_LINES,
    max_cols: int = _MAX_LINE_COLS,
) -> list[str]:
    """UTF-8 Russian (or Latin) wrapped to TFT columns — at most max_lines."""

    text = (reply or "").replace("\r\n", "\n").replace("\r", "\n")
    text = _MD_NOISE.sub("", text)
    text = _EMOJI_NOISE.sub("", text)
    text = re.sub(r"\n{2,}", "\n", text).strip()
    text = text.replace("\n", " ")
    text = re.sub(r"\s+", " ", text).strip()
    if not text:
        return []
    if len(text) > max_chars:
        cut = text[: max_chars - 1].rsplit(" ", 1)[0].strip() or text[: max_chars - 1].strip()
        text = cut + "…"

    words = text.split(" ")
    lines: list[str] = []
    buf = ""

    def flush() -> bool:
        nonlocal buf
        if not buf:
            return len(lines) >= max_lines
        lines.append(buf)
        buf = ""
        return len(lines) >= max_lines

    for w in words:
        if not w:
            continue
        # Hard-split overlong tokens so they never blow past the panel width.
        while len(w) > max_cols:
            if buf and flush():
                return lines[:max_lines]
            lines.append(w[:max_cols])
            w = w[max_cols:]
            if len(lines) >= max_lines:
                return lines[:max_lines]
            if not w:
                break
        if not w:
            continue
        trial = f"{buf} {w}".strip() if buf else w
        if len(trial) <= max_cols:
            buf = trial
            continue
        if flush():
            return lines[:max_lines]
        buf = w
    if buf and len(lines) < max_lines:
        lines.append(buf)
    return lines[:max_lines]


def bound_owner_user(principal_id: str) -> User:
    return User(
        id=principal_id,
        email="esp-display@local",
        username="esp-display",
        role="emperyworld_member",
        is_active=True,
        is_verified=True,
    )


async def run_esp_display_turn(
    pool: asyncpg.Pool,
    *,
    intent: EspDisplayIntent,
    ambient: Mapping[str, Any] | None = None,
    client_turn_id: str | None = None,
) -> dict[str, Any]:
    """Execute one display-safe companion turn; returns reply_lines payload fields."""

    principal_id = esp_display_principal_id()
    if not principal_id:
        raise RuntimeError("esp_display_principal_unconfigured")

    user_line = build_esp_display_user_line(intent, ambient)
    auth_user = bound_owner_user(principal_id)
    logger.info(
        "[STEP] esp_display_turn_start intent=%s principal=%s ambient=%s",
        intent,
        principal_id,
        bool(ambient),
    )
    raw = await execute_companion_chat_message(
        pool,
        principal_id=principal_id,
        auth_user=auth_user,
        bearer_token=None,
        message=user_line,
        shell_context=None,
        content_catalog_user_id=None,
        oauth2_sub_for_content_alternate=None,
        client_turn_id=client_turn_id,
        image_attachment=None,
        use_web_search=False,
        web_search_db=None,
        surface=ESP_DISPLAY_SURFACE,
    )
    reply = str(raw.get("reply") or "").strip()
    lines = truncate_reply_to_lines(reply)
    if not lines:
        lines = ["Сейчас коротко не вышло.", "Попробуй ещё раз."]
    chars = sum(len(x) for x in lines)
    logger.info(
        "[STEP] esp_display_turn_ok intent=%s lines=%s chars=%s",
        intent,
        len(lines),
        chars,
    )
    return {
        "ok": True,
        "intent": intent,
        "reply_lines": lines,
        "reply_chars": chars,
    }


__all__ = (
    "ESP_DISPLAY_SURFACE",
    "EspDisplayIntent",
    "bound_owner_user",
    "build_esp_display_user_line",
    "esp_display_ai_enabled",
    "esp_display_device_token_expected",
    "esp_display_principal_id",
    "format_ambient_prefix",
    "intent_user_prompt",
    "rate_limit_allow",
    "reset_esp_display_rate_limit_for_tests",
    "run_esp_display_turn",
    "truncate_reply_to_lines",
    "verify_esp_display_token",
)
