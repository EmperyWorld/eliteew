"""Сборка RAG query для чатов маркетингового кабинета и desktop project vault."""

from __future__ import annotations

from api.services.marketing_project_rag_service import build_marketing_rag_query


def test_build_marketing_rag_query_keeps_user_prompt_first() -> None:
    out = build_marketing_rag_query(
        "Что у нас по конкурентам и позиционированию?",
        recent_messages=[
            "Пользователь: старый вопрос",
            "Ассистент: старый ответ",
        ],
        max_chars=240,
    )

    assert out.startswith("Что у нас по конкурентам и позиционированию?")
    assert "Недавний контекст диалога:" in out


def test_build_marketing_rag_query_prioritizes_latest_messages_when_budget_is_tight() -> None:
    out = build_marketing_rag_query(
        "Что добавить в стратегию?",
        recent_messages=[
            "Пользователь: самый старый контекст про лендинг и оффер",
            "Ассистент: старый ответ про аудитории",
            "Пользователь: свежий вопрос про конкурентов",
            "Ассистент: свежий ответ про сегменты и JTBD",
        ],
        max_chars=140,
        max_recent_messages=4,
        max_recent_chars=55,
    )

    assert out.startswith("Что добавить в стратегию?")
    assert "свежий" in out
    assert "самый старый" not in out
