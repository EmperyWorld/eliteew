# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# EWA companion interactive XL Base launch surface: opens a guided UI for theme/style/vocal/language before
# delegating final generation to the existing ``music_generation_xl_base`` backend pipeline.
# Invariants:
# - This tool never starts generation itself; it only returns ``output_surface.mode=music_xl_base_wizard``.
# - Final generation must still pass through ``music_generation_xl_base`` with ``ugs_workflow=v2_base``.
# Related:
# - api/ewa_platform/companion/orchestration/companion_music_xl_base.py
# - documentation/product/ewa/EWA-COMPANION-MUSIC-GENERATION.md
# ---
"""Interactive XL Base companion music launch surface."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from api.ewa_platform.companion.orchestration.companion_music_xl_base import (
    user_line_requests_music_xl_base_interactive,
)
from api.ewa_platform.companion.orchestration.tools.handlers_media import (
    _companion_backend_music_generation_enabled,
)
from api.ewa_platform.companion.orchestration.tools.registry_helpers import (
    _tool_router_bypass_line_match,
)
from api.ewa_platform.companion.orchestration.tools.registry_types import (
    ToolContext,
    ToolResult,
)

_STYLE_OPTIONS: tuple[dict[str, str], ...] = (
    {"id": "pop", "label_ru": "Поп", "label_en": "Pop"},
    {"id": "rock", "label_ru": "Рок", "label_en": "Rock"},
    {"id": "hip-hop", "label_ru": "Хип-хоп", "label_en": "Hip-hop"},
    {"id": "electronic", "label_ru": "Электроника", "label_en": "Electronic"},
    {"id": "dance", "label_ru": "Танцевальная", "label_en": "Dance"},
    {"id": "ballad", "label_ru": "Баллада", "label_en": "Ballad"},
    {"id": "luna", "label_ru": "Luna", "label_en": "Luna"},
)

_VOCAL_OPTIONS: tuple[dict[str, str], ...] = (
    {"id": "female", "label_ru": "Женский вокал", "label_en": "Female vocal"},
    {"id": "male", "label_ru": "Мужской вокал", "label_en": "Male vocal"},
    {"id": "duet", "label_ru": "Дуэт", "label_en": "Duet"},
)

_LANGUAGE_OPTIONS: tuple[dict[str, str], ...] = (
    {"id": "ru", "label_ru": "Русский", "label_en": "Russian"},
    {"id": "en", "label_ru": "Английский", "label_en": "English"},
    {"id": "es", "label_ru": "Испанский", "label_en": "Spanish"},
    {"id": "de", "label_ru": "Немецкий", "label_en": "German"},
    {"id": "fr", "label_ru": "Французский", "label_en": "French"},
)


def _ru_from_line(user_line: str) -> bool:
    return any("\u0400" <= ch <= "\u04ff" for ch in str(user_line or ""))


def music_xl_base_wizard_surface_payload(user_line: str) -> dict[str, Any]:
    """Build declarative frontend payload for the interactive XL Base wizard."""

    ru = _ru_from_line(user_line)
    return {
        "source": "companion_music_xl_base_interactive",
        "ugs_workflow": "v2_base",
        "billing_mode": "companion_xl_base",
        "default_language": "ru" if ru else "en",
        "default_style": "pop",
        "default_vocal": "female",
        "style_options": list(_STYLE_OPTIONS),
        "vocal_options": list(_VOCAL_OPTIONS),
        "language_options": list(_LANGUAGE_OPTIONS),
        "initial_theme": "",
    }


async def handle_music_xl_base_interactive(args: Mapping[str, Any], ctx: ToolContext) -> ToolResult | None:
    """Open the guided XL Base wizard in the companion output surface."""

    if not _companion_backend_music_generation_enabled():
        return None

    user_line = str(args.get("user_line") or ctx.user_line or "")
    if not user_line_requests_music_xl_base_interactive(user_line) and not _tool_router_bypass_line_match(args):
        return None

    ru = _ru_from_line(user_line)
    reply = (
        "Открыла интерактивный XL Base: выбери тему, стиль, вокал и язык — потом запущу генерацию через студийный XL Base."
        if ru
        else "I opened the interactive XL Base flow: choose the theme, style, vocal, and language, then I'll start generation through XL Base."
    )
    return ToolResult(
        tool="music_xl_base_interactive",
        status="ok",
        reply=reply,
        actions=[],
        output_surface={"mode": "music_xl_base_wizard", "payload": music_xl_base_wizard_surface_payload(user_line)},
        data={"ugs_workflow": "v2_base", "billing_mode": "companion_xl_base"},
        task_run=None,
    )


__all__ = (
    "handle_music_xl_base_interactive",
    "music_xl_base_wizard_surface_payload",
)
