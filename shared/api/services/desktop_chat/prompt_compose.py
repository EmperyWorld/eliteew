# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
#   Compose Desktop AI Chat system prompts from hero kernels, mode overlays, and admin defaults.
# Invariants:
#   - Legacy chat.system_prompt_override wins when non-empty.
# Related:
#   - api/services/desktop_chat_ensemble/heroes.py
#   - api/services/desktop_chat/service.py
# ---
"""System prompt composition for desktop AI chat turns."""

from __future__ import annotations

import hashlib
from typing import Any, Literal

from api.services.desktop_chat.ux.expert_reply_contract import EXPERT_REPLY_CONTRACT_VERSION
from api.services.desktop_chat.ux.reply_extract import structured_solo_reply_instruction
from api.services.desktop_chat_ensemble.heroes import system_prompt_for_hero
from api.services.desktop_chat_ensemble.heroes_prompt_data import (
    compose_solo_system_prompt,
    get_hero_dossier_tool_hint,
    get_hero_prompt_version,
)
from api.utils.llm_wall_clock_context import append_llm_wall_clock_to_system_prompt

DesktopPromptMode = Literal["solo", "ensemble_speaker", "ensemble_short", "blueprint"]


def hash_desktop_prompt_text(prompt: str) -> str:
    """Stable SHA-256 hex digest for composed system prompt provenance."""
    normalized = (prompt or "").strip()
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def _desktop_tools_system_append(
    defaults: dict[str, Any],
    *,
    use_tools_flag: bool,
    post_tool: bool = False,
    hero_id: str | None = None,
) -> str:
    if not use_tools_flag:
        return (
            "В этом ходе инструменты EliteEW (включая desktop_web_search) не запускались сервером. "
            "Нельзя утверждать, что ты уже выполнил веб-поиск, прочитал URL или получил «актуальные данные из интернета». "
            "Если пользователь просит погоду, новости, цены, афишу или другие live-данные, честно скажи, что для фактического "
            "ответа нужен запуск веб-поиска в этом ходе."
        )
    lines: list[str] = []
    if post_tool:
        lines.append(
            "Инструменты EliteEW уже выполнены сервером в этом ходе. "
            "Опиши пользователю результат по-русски; не утверждай, что генерация, поиск или загрузка недоступны. "
            "Если был desktop_web_search — используй факты и URL из role=tool и/или из блока "
            "«Срез из веб-поиска» в сообщении пользователя; не проси пользователя прислать новости."
        )
    else:
        lines.append(
            "Если в сообщении пользователя есть раздел «Контекст: вложения этого чата» — "
            "это материалы текущего диалога; для изображений из чата не утверждай, что их нельзя показать."
        )
        lines.append(
            "При неопределённости по фактам: вызови инструмент (web / RAG / vault / mcp_call research|kbsew) "
            "или явно скажи «неизвестно / нет доступа». Запрещено выдумывать факты, URL и «нашли в сети» "
            "без реального tool result."
        )
        if defaults.get("tools_image_enabled", True):
            lines.append(
                "Для запросов картинки сервер может вызвать desktop_generate_image; "
                "после успеха подтверди, что изображение видно в чате."
            )
    if hero_id:
        hint = get_hero_dossier_tool_hint(hero_id)
        if hint:
            lines.append(hint)
    return "\n".join(lines)


def compose_desktop_system_prompt(
    *,
    hero_id: str | None,
    mode: DesktopPromptMode = "solo",
    defaults: dict[str, Any],
    use_tools: bool = False,
    chat_override: str | None = None,
    structured_reply: bool = False,
    post_tool: bool = False,
) -> str:
    """Build system prompt for a turn."""
    prompt, _meta = compose_desktop_system_prompt_with_meta(
        hero_id=hero_id,
        mode=mode,
        defaults=defaults,
        use_tools=use_tools,
        chat_override=chat_override,
        structured_reply=structured_reply,
        post_tool=post_tool,
    )
    return prompt


def compose_desktop_system_prompt_with_meta(
    *,
    hero_id: str | None,
    mode: DesktopPromptMode = "solo",
    defaults: dict[str, Any],
    use_tools: bool = False,
    chat_override: str | None = None,
    structured_reply: bool = False,
    post_tool: bool = False,
    kbsew_dpa_block: str | None = None,
) -> tuple[str, dict[str, Any]]:
    """Build system prompt for a turn and return prompt provenance metadata."""
    hero_clean = hero_id.strip() if isinstance(hero_id, str) and hero_id.strip() else None
    source = "default_system_prompt"

    if chat_override and str(chat_override).strip():
        base = str(chat_override).strip()
        source = "chat_override"
    elif mode == "blueprint" and hero_clean:
        from api.services.desktop_chat_ensemble.heroes import blueprint_prompt_for_hero

        bp = blueprint_prompt_for_hero(hero_clean)
        if bp:
            base = bp
            source = "hero_blueprint_prompt"
        else:
            base = system_prompt_for_hero(hero_clean) or defaults.get("default_system_prompt") or ""
            source = "hero_solo_fallback"
    elif mode == "ensemble_short" and hero_clean:
        from api.services.desktop_chat_ensemble.heroes import short_reply_prompt_for_hero

        short = short_reply_prompt_for_hero(hero_clean)
        if short:
            base = short
            source = "hero_ensemble_short_prompt"
        else:
            base = system_prompt_for_hero(hero_clean) or ""
            source = "hero_solo_fallback"
    elif mode == "ensemble_speaker" and hero_clean:
        base = system_prompt_for_hero(hero_clean) or str(defaults.get("default_system_prompt") or "")
        source = "hero_solo_prompt"
    elif hero_clean:
        base = compose_solo_system_prompt(hero_clean) or str(defaults.get("default_system_prompt") or "")
        source = "hero_solo_prompt"
    else:
        base = str(defaults.get("default_system_prompt") or "You are a helpful assistant.")
        source = "default_system_prompt"

    parts = [base.rstrip()]
    tool_block = _desktop_tools_system_append(
        defaults,
        use_tools_flag=use_tools,
        post_tool=post_tool,
        hero_id=hero_clean,
    )
    if tool_block:
        parts.append(tool_block)
    dpa = (kbsew_dpa_block or "").strip()
    if dpa:
        parts.append(dpa)
    if structured_reply and mode == "solo":
        parts.append(structured_solo_reply_instruction())

    prompt = "\n\n".join(p for p in parts if p)
    prompt = append_llm_wall_clock_to_system_prompt(prompt)
    meta: dict[str, Any] = {
        "desktop_prompt_mode": mode,
        "desktop_prompt_source": source,
        "desktop_prompt_hash": hash_desktop_prompt_text(prompt),
    }
    if hero_clean and system_prompt_for_hero(hero_clean):
        meta["desktop_hero_id"] = hero_clean
        meta["desktop_hero_prompt_version"] = get_hero_prompt_version(hero_clean)
    if use_tools:
        meta["desktop_tools_prompt_applied"] = True
    if dpa:
        meta["kbsew_dpa_applied"] = True
    if post_tool:
        meta["desktop_post_tool_prompt"] = True
    if structured_reply and mode == "solo":
        meta["desktop_structured_reply_prompt"] = True
        meta["desktop_expert_reply_contract"] = EXPERT_REPLY_CONTRACT_VERSION
    return prompt, meta


def hero_prompt_version_for_settings(settings: dict[str, Any] | None, hero_id: str | None) -> int | None:
    if not hero_id:
        return None
    return get_hero_prompt_version(hero_id)
