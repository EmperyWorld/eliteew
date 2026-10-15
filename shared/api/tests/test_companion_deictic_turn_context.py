# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Behavioral tests for deictic «на эту тему» resolution from last assistant reply.
# Related:
# - api/ewa_platform/companion/orchestration/companion_deictic_turn_context.py
# ---

from __future__ import annotations

import pytest

from api.ewa_platform.companion.orchestration.companion_deictic_turn_context import (
    extract_copyable_assistant_body,
    is_deictic_topic_phrase,
    resolve_deictic_turn_context,
)
from api.ewa_platform.companion.orchestration.companion_presentation_generation import (
    resolve_presentation_topic_and_context,
)


@pytest.mark.unit
def test_is_deictic_topic_phrase_ru() -> None:
    assert is_deictic_topic_phrase("на эту тему") is True
    assert is_deictic_topic_phrase("недвижимость Владивостока") is False


@pytest.mark.unit
def test_extract_copyable_body_from_longread_block() -> None:
    raw = (
        "**Лонгрид для VK** — можно копировать:\n\n"
        "---\n\n"
        "Почему ждать обвала — плохая стратегия.\n\n"
        "• **Центр** — дефицит лотов\n\n"
        "---\n\n"
        "_Скопируй текст между линиями._"
    )
    body = extract_copyable_assistant_body(raw)
    assert "ждать обвала" in body
    assert "Лонгрид" not in body


@pytest.mark.unit
def test_resolve_deictic_from_profile_chat() -> None:
    profile = {
        "learned_preferences": {
            "desktop_friend_chat_v1": {
                "messages": [
                    {"role": "user", "content": "сделай лонгрид для VK про море"},
                    {
                        "role": "assistant",
                        "content": (
                            "**Лонгрид для VK** — можно копировать:\n\n"
                            "---\n\n"
                            "**Почему море меняет город**\n\n"
                            "Во Владивостоке набережная — не декор, а экономика.\n\n"
                            "---\n"
                        ),
                    },
                ]
            }
        }
    }
    resolved = resolve_deictic_turn_context(
        "сделай презентацию на эту тему",
        profile,
        stripped_topic="на эту тему",
    )
    assert resolved is not None
    assert "море" in resolved.topic.lower() or "Почему" in resolved.topic
    assert "набережная" in resolved.extra_context


@pytest.mark.unit
def test_resolve_presentation_topic_and_context_deictic() -> None:
    profile = {
        "learned_preferences": {
            "desktop_friend_chat_v1": {
                "messages": [
                    {
                        "role": "assistant",
                        "content": (
                            "**Лонгрид** — можно копировать:\n\n"
                            "---\n\n"
                            "**Киберспорт во Владивостоке**\n\n"
                            "Локальные команды растут быстрее столичных.\n\n"
                            "---\n"
                        ),
                    }
                ]
            }
        }
    }
    topic, extra = resolve_presentation_topic_and_context(
        "сделай презентацию на эту тему",
        profile,
    )
    assert "киберспорт" in topic.lower() or "Киберспорт" in topic
    assert "локальные команды" in extra.lower()
    assert topic != "на эту тему"
