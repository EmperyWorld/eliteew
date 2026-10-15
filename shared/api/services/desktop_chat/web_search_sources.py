# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Parse and normalize Desktop AI Chat web-search hit records for UI metadata.
# Invariants:
# - Sources are URL/title/snippet only; no invented fields.
# Related:
# - api/services/desktop_chat/tools/web_search_tool.py
# - api/services/search_service.py
# ---

from __future__ import annotations

import re
from typing import Any

_WEB_SEARCH_BLOCK_RE = re.compile(
    r"\[(\d+)\]\s*(.*?)\n\s*(.*?)\n\s*URL:\s*(\S+)",
    re.MULTILINE | re.DOTALL,
)


def web_search_hits_to_sources(hits: list[dict[str, str]]) -> list[dict[str, str]]:
    out: list[dict[str, str]] = []
    seen: set[str] = set()
    for row in hits:
        url = str(row.get("url") or "").strip()
        if not url or url in seen:
            continue
        seen.add(url)
        title = str(row.get("title") or "").strip()
        snippet = str(row.get("content") or "").strip()
        item: dict[str, str] = {"url": url}
        if title:
            item["title"] = title
        if snippet:
            item["snippet"] = snippet[:400]
        out.append(item)
    return out


def parse_web_search_prompt_block(text: str) -> list[dict[str, str]]:
    body = str(text or "").strip()
    if not body:
        return []
    out: list[dict[str, str]] = []
    seen: set[str] = set()
    for match in _WEB_SEARCH_BLOCK_RE.finditer(body):
        url = match.group(4).strip()
        if not url or url in seen:
            continue
        seen.add(url)
        title = match.group(2).strip()
        snippet = match.group(3).strip()
        item: dict[str, str] = {"url": url}
        if title:
            item["title"] = title
        if snippet:
            item["snippet"] = snippet[:400]
        out.append(item)
    return out


def web_search_sources_from_tool_trace(trace: list[dict[str, Any]]) -> list[dict[str, str]]:
    merged: list[dict[str, str]] = []
    seen: set[str] = set()

    def _add(items: list[dict[str, str]]) -> None:
        for item in items:
            url = str(item.get("url") or "").strip()
            if not url or url in seen:
                continue
            seen.add(url)
            merged.append(item)

    for row in trace:
        if not isinstance(row, dict):
            continue
        preview = row.get("preview")
        if isinstance(preview, str):
            _add(parse_web_search_prompt_block(preview))
        tools = row.get("tools")
        if isinstance(tools, list):
            for tool_row in tools:
                if not isinstance(tool_row, dict):
                    continue
                prev = tool_row.get("preview")
                if isinstance(prev, str):
                    _add(parse_web_search_prompt_block(prev))
    return merged


def format_web_search_block_for_user_prompt(block: str) -> str:
    body = str(block or "").strip()
    if not body:
        return ""
    return (
        "Срез из веб-поиска (результат desktop_web_search на сервере; "
        "единственный источник внешних фактов для этого хода; "
        "при конфликте фактов не объединяй разные сущности):\n" + body
    )


WEB_SEARCH_USER_BLOCK_MARKER = "Срез из веб-поиска"

WEB_SEARCH_ENRICHED_NUDGE = (
    "[Служебная инструкция приложения EliteEW] Блок «Срез из веб-поиска» выше — это уже "
    "выполненный desktop_web_search (факты и URL в том же сообщении, не в role=tool). "
    "В начале среза указана серверная дата/время — «сегодня», «этот месяц», «на следующий месяц» "
    "считай от неё; события с более ранними датами не выдавай как предстоящие. "
    "Ответь на вопрос пользователя, опираясь на этот срез: перечисли ключевые новости или факты, "
    "укажи источники. Категорически нельзя писать, что поиск не выполнялся, что нет role=tool "
    "или просить пользователя прислать ссылки."
)
