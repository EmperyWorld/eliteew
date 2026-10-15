# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Customer Diagnostic scoring catalogs and questions (port of FE diagnosticDefinition + extractedQuestions).
# Invariants:
# - QUESTIONS loaded from bundled extracted_questions.json (same payload as FE).
# - Industry benchmarks fall back to "default" when industry unknown.
# Related:
# - api/services/marketing_cabinet/customer_diagnostic_scoring.py
# - shared/web/frontend/src/features/customer-diagnostic/diagnosticDefinition.ts
# ---

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

DIAGNOSTIC_MODULE_ORDER: tuple[str, ...] = (
    "archetype",
    "values",
    "business",
    "service",
    "emotions",
)

ARCHETYPE_QUESTION_MAPPING: dict[str, list[int]] = {
    "innocent": [1, 5, 9, 13, 17, 21],
    "explorer": [2, 6, 10, 14, 18, 22],
    "sage": [3, 7, 11, 15, 19, 23],
    "hero": [4, 8, 12, 16, 20, 24],
    "outlaw": [1, 6, 11, 16, 21, 22],
    "magician": [2, 7, 12, 17, 22, 23],
    "regular": [3, 8, 13, 18, 23, 24],
    "lover": [4, 9, 14, 19, 24, 1],
    "jester": [5, 10, 15, 20, 1, 2],
    "caregiver": [6, 11, 16, 21, 2, 3],
    "creator": [7, 12, 17, 22, 3, 4],
    "ruler": [8, 13, 18, 23, 4, 5],
}

ARCHETYPE_CATALOG: dict[str, dict[str, str]] = {
    "innocent": {
        "name": "Невинный",
        "description": "Стремится к простоте, честности и искренности",
    },
    "explorer": {
        "name": "Искатель",
        "description": "Ценит свободу, открытия и новые впечатления",
    },
    "sage": {
        "name": "Мудрец",
        "description": "Стремится к знанию, истине и пониманию",
    },
    "hero": {
        "name": "Герой",
        "description": "Стремится к достижениям и преодолению вызовов",
    },
    "outlaw": {
        "name": "Бунтарь",
        "description": "Нарушает правила и изменяет мир",
    },
    "magician": {
        "name": "Маг",
        "description": "Делает мечты реальностью через инновации",
    },
    "regular": {
        "name": "Обычный парень",
        "description": "Ценит принадлежность и простые удовольствия",
    },
    "lover": {
        "name": "Любовник",
        "description": "Стремится к близости, страсти и любви",
    },
    "jester": {
        "name": "Шут",
        "description": "Приносит радость и веселье в мир",
    },
    "caregiver": {
        "name": "Заботливый",
        "description": "Помогает и защищает других",
    },
    "creator": {
        "name": "Творец",
        "description": "Создает нечто ценное и долговечное",
    },
    "ruler": {
        "name": "Правитель",
        "description": "Стремится к контролю и лидерству",
    },
}

BUSINESS_AREAS: dict[str, dict[str, str]] = {
    "strategy": {"name": "Стратегия и ценностное предложение"},
    "operations": {"name": "Операционная эффективность"},
    "customer": {"name": "Клиентский опыт и лояльность"},
    "values": {"name": "Ценностная система управления"},
    "finance": {"name": "Финансовое здоровье"},
}

INDUSTRY_BENCHMARKS: dict[str, dict[str, int]] = {
    "retail": {
        "strategy": 75,
        "operations": 70,
        "customer": 80,
        "values": 65,
        "finance": 70,
    },
    "it": {
        "strategy": 85,
        "operations": 80,
        "customer": 75,
        "values": 75,
        "finance": 75,
    },
    "manufacturing": {
        "strategy": 70,
        "operations": 85,
        "customer": 65,
        "values": 70,
        "finance": 80,
    },
    "finance": {
        "strategy": 80,
        "operations": 75,
        "customer": 85,
        "values": 85,
        "finance": 90,
    },
    "healthcare": {
        "strategy": 75,
        "operations": 80,
        "customer": 90,
        "values": 85,
        "finance": 75,
    },
    "consulting": {
        "strategy": 90,
        "operations": 70,
        "customer": 85,
        "values": 80,
        "finance": 70,
    },
    "default": {
        "strategy": 75,
        "operations": 75,
        "customer": 75,
        "values": 75,
        "finance": 75,
    },
}

SERVQUAL_DIMENSIONS: dict[str, dict[str, str]] = {
    "tangibles": {"name": "Материальность", "icon": "🏢"},
    "reliability": {"name": "Надежность", "icon": "🎯"},
    "responsiveness": {"name": "Отзывчивость", "icon": "⚡"},
    "assurance": {"name": "Уверенность", "icon": "🛡️"},
    "empathy": {"name": "Эмпатия", "icon": "💚"},
    "effort": {"name": "Усилия клиента", "icon": "💪"},
}

EMOTIONS_JOURNEY_STAGES: list[dict[str, str]] = [
    {"id": "awareness", "name": "Осведомленность", "icon": "💡"},
    {"id": "consideration", "name": "Рассмотрение", "icon": "🔍"},
    {"id": "decision", "name": "Принятие решения", "icon": "✅"},
    {"id": "purchase", "name": "Покупка", "icon": "💳"},
    {"id": "onboarding", "name": "Внедрение", "icon": "🚀"},
    {"id": "usage", "name": "Использование", "icon": "⚙️"},
    {"id": "support", "name": "Поддержка", "icon": "🆘"},
    {"id": "renewal", "name": "Продление", "icon": "🔄"},
    {"id": "advocacy", "name": "Адвокатство", "icon": "📢"},
]


def get_industry_benchmark(industry: str | None, area: str) -> int:
    key = industry if industry and industry in INDUSTRY_BENCHMARKS else "default"
    table = INDUSTRY_BENCHMARKS.get(key) or INDUSTRY_BENCHMARKS["default"]
    return int(table.get(area, INDUSTRY_BENCHMARKS["default"].get(area, 75)))


@lru_cache(maxsize=1)
def load_questions() -> dict[str, list[dict[str, Any]]]:
    path = Path(__file__).resolve().parent / "data" / "extracted_questions.json"
    raw = json.loads(path.read_text(encoding="utf-8"))
    return {
        "archetype": list(raw.get("archetype") or []),
        "values": list(raw.get("values") or []),
        "business": list(raw.get("business") or []),
        "service": list(raw.get("service") or []),
    }
