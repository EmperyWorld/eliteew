# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Canonical versioned substring hints for ensemble blueprint vs legacy routing heuristics.
# Invariants:
# - Hint strings are stored casefold-ready lowercase fragments matched via substring search.
# - Wave C (v6): short registry/list/backlog intents route to blueprint before len≤220 legacy fallback.
# Related:
# - api/services/desktop_chat_ensemble/route_heuristics.py
# ---

"""Canonical ensemble route heuristic dictionaries (versioned)."""

from __future__ import annotations

ENSEMBLE_ROUTE_HEURISTICS_VERSION = 6

CANONICAL_BLUEPRINT_HINTS: tuple[str, ...] = (
    "техплан",
    "технический план",
    "архитектурный план",
    "roadmap",
    "роадмап",
    "маркетинговый бриф",
    "контент-бриф",
    "sales one-pager",
    "one-pager",
    "jtbd",
    "дорожн карт",
    "дорожная карта",
    "тз ",
    " тз",
    "техзадан",
    "техническое задание",
    "спецификац",
    "postmortem",
    "постмортем",
    "единый документ",
    "единый план",
    "совместный план",
    "по пунктам что",
    "по пунктам",
    "реестр",
    "список из",
    "список приложений",
    "список модулей",
    "backlog",
    "бэклог",
    "оглавлен",
    "mermaid",
    "флоучарт",
    "prd",
    "product spec",
    "спецификация",
    "спецификация интеграции",
    "api контракт",
    "план исследования",
    "custdev",
    "campaign plan",
    "медиаплан",
    "release checklist",
    "чеклист релиза",
    "mvp",
    "общий ответ от",
    "одним сообщением от команды",
    "предложить по проекту",
    "бизнес план",
    "бизнес-план",
    "бизнес-модель",
    "монетизац",
    "юнит-эконом",
    "unit economics",
    "финансовая модель",
    "финмодель",
    "go-to-market",
    "gtm",
    "выход на рынок",
    "полноценный аудит",
    "полный аудит",
    "аудит проекта",
    "проведи аудит",
    "проведите аудит",
    "project audit",
    "с аудита",
    "начнём с аудита",
    "начнем с аудита",
    "давайте аудит",
    "давайте с аудита",
    "аудит начнём",
    "аудит начнем",
    "портфель стратегий",
    "варианты стратегии",
    "стратегические варианты",
    "стратегические гипотезы",
    "3–5 стратег",
    "3-5 стратег",
    "3–5 гипотез",
    "3-5 гипотез",
    "три-пять гипотез",
    "исследовательский отчёт",
    "исследовательский отчет",
    "исследование рынка",
    "market research",
    "протокол встречи",
    "протокол рабочей",
    "meeting notes",
    "резюме встречи",
    "итоги встречи",
    "протокол совещания",
)

CANONICAL_MANIFEST_STYLE_HINTS: tuple[str, ...] = ()

CANONICAL_BRIEF_ACKNOWLEDGEMENTS: tuple[str, ...] = (
    "ясно",
    "понятно",
    "ок",
    "окей",
    "ага",
    "угу",
    "спасибо",
    "принято",
    "понял",
    "поняла",
)

CANONICAL_JOINT_FOLLOWUP_EDIT_NEEDLES: tuple[str, ...] = (
    "добавь",
    "дополни",
    "расширь",
    "сократи",
    "перепиши",
    "уточни",
    "исправь",
    "обнови",
    "адаптируй",
    "разверни",
    "раскрой",
    "продолжи",
    "вставь",
    "убери",
    "поменяй",
    "сделай короче",
    "сделай подробнее",
    "следующий раздел",
)

CANONICAL_JOINT_FOLLOWUP_TOPIC_NEEDLES: tuple[str, ...] = (
    "план",
    "документ",
    "раздел",
    "блок",
    "бюджет",
    "смет",
    "экономик",
    "монетизац",
    "риски",
)
