# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Explicit Discussion document synthesis from persisted transcript turns only.
# Invariants:
# - Never auto-called from the Discussion worker batch.
# - Input is transcript turns; no silent overwrite of a fresher document version.
# Related:
# - documentation/product/desktop/DESKTOP-AI-CHAT-DISCUSSION-MODE.md
# ---
"""Discussion explicit document generation."""

from __future__ import annotations

import logging
from typing import Any

from api.services.desktop_chat_ensemble.heroes import HERO_SHORT_LABEL
from api.services.llama_service import LlamaService

logger = logging.getLogger(__name__)


async def synthesize_discussion_document(
    *,
    topic: str,
    goal: str,
    preset_title: str,
    turns: list[dict[str, Any]],
    model: str,
    user_speaker_label: str = "Участник",
) -> str:
    """Return Markdown document or empty string on failure."""
    lines: list[str] = []
    for turn in turns:
        actor = str(turn.get("actor_type") or "")
        if actor == "ai":
            hero = str(turn.get("hero_id") or "")
            label = HERO_SHORT_LABEL.get(hero, hero or "AI")
            prefix = f"{label}"
        elif actor == "user":
            meta = turn.get("metadata") if isinstance(turn.get("metadata"), dict) else {}
            prefix = str((meta or {}).get("speaker_label") or "").strip() or user_speaker_label
        else:
            prefix = "Система"
        content = str(turn.get("content") or "").strip()
        if not content:
            continue
        lines.append(f"- [{prefix} · {turn.get('relation')}] {content}")

    if not lines:
        return ""

    system = (
        "Ты готовишь рабочий документ по итогам дискуссии. "
        "Используй только транскрипт. Не выдумывай факты и метрики. "
        "Структура Markdown: ## Вывод, ## Аргументы и развилки, ## Следующие шаги, ## Открытые вопросы. "
        "Пиши по-русски, деловым тоном."
    )
    user = f"Сценарий: {preset_title}\nТема: {topic}\nЦель: {goal}\n\nТранскрипт:\n" + "\n".join(lines)
    try:
        async with LlamaService() as llama:
            result = await llama.chat(
                [
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
                model=model,
                max_tokens=2048,
                temperature=0.35,
            )
        text = str(result.get("text") or "").strip()
        return text
    except Exception as exc:  # noqa: BLE001
        logger.warning("[STEP] discussion_document_fail err=%s", exc)
        return ""
