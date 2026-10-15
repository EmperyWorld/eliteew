# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Locale helpers for agentic substrate — Russian-first copy in Think, gates, and tool errors.
# Invariants:
# - Agentic user-facing strings default to Russian unless goal is clearly English-only.
# Related:
# - api/ewa_platform/agentic/kernel/engine.py
# - api/ewa_platform/agentic/tools/bridge.py
# ---

from __future__ import annotations

from collections.abc import Mapping

from api.ewa_platform.agentic.kernel.tool_args_enrich import goal_text_from_session

_CYRILLIC_RANGE = ("\u0400", "\u04ff")


def _has_cyrillic(text: str) -> bool:
    return any(_CYRILLIC_RANGE[0] <= ch <= _CYRILLIC_RANGE[1] for ch in text)


def agentic_session_is_russian(session: Mapping[str, object] | None) -> bool:
    """Agentic mode is Russian-first; Cyrillic goal or empty goal → Russian."""

    if not isinstance(session, Mapping):
        return True
    goal = goal_text_from_session(session)
    if not goal.strip():
        return True
    if _has_cyrillic(goal):
        return True
    return not goal.strip().isascii()


def agentic_gate_title_default(session: Mapping[str, object] | None = None) -> str:
    return "Нужно ваше решение" if agentic_session_is_russian(session) else "Decision required"


def agentic_clarify_prompt_default(session: Mapping[str, object] | None = None) -> str:
    return (
        "Уточните, пожалуйста, что сделать дальше."
        if agentic_session_is_russian(session)
        else "Please clarify what to do next."
    )


def agentic_tool_none_summary(tool_name: str, *, session: Mapping[str, object] | None = None) -> str:
    """User-visible summary when a companion tool handler returned None."""

    ru = agentic_session_is_russian(session)
    name = (tool_name or "").strip()
    if name == "file_open":
        return (
            "Не удалось открыть файл: не указано имя или идентификатор. "
            "Сначала используйте просмотр каталога (catalog_list), затем откройте конкретный файл."
            if ru
            else "Could not open file: missing name or id. List catalog first (catalog_list), then open a specific file."
        )
    if name == "catalog_list":
        return (
            "Не удалось получить список файлов из каталога. "
            "Проверьте, что документы загружены в EwaFile, или вставьте ключевой текст в чат."
            if ru
            else "Could not list catalog files. Ensure documents exist in EwaFile or paste text into chat."
        )
    if name == "document_extractor":
        return (
            "Не удалось извлечь текст из документа. Укажите файл после просмотра каталога."
            if ru
            else "Could not extract document text. Specify a file after catalog listing."
        )
    return f"Инструмент «{name}» не вернул результат — шаг пропущен." if ru else f"Tool {name!r} returned no result."


def agentic_tool_denied_summary(tool_name: str, *, session: Mapping[str, object] | None = None) -> str:
    ru = agentic_session_is_russian(session)
    name = (tool_name or "").strip()
    return (
        f"Инструмент «{name}» недоступен в этой сессии (выключен или не в списке разрешённых)."
        if ru
        else f"Tool {name!r} is not allowed in this session."
    )
