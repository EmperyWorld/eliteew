# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Каталог типов Evidence-брифов (research_projects): UI labels, legacy aliases, промпты AI-синтеза.
# Invariants:
# - DB enum research_type шире каталога; legacy значения нормализуются через aliases.
# - Синтез опирается только на переданный контекст проекта + RAG; без веб-поиска.
# Related:
# - api/routers/marketing_cabinet/researches.py
# - documentation/product/marketing/MARKETING-CABINET.md
# ---

from __future__ import annotations

from typing import Any

# PostgreSQL enum research_type (полный набор в БД).
RESEARCH_TYPE_DB_VALUES: frozenset[str] = frozenset(
    {
        "business",
        "market",
        "competitive",
        "customer",
        "product",
        "swot",
        "porter",
        "jtbd",
        "value_proposition",
        "trend_analysis",
        "opportunity_analysis",
        "risk_assessment",
        "custom",
    }
)

# UI / create: только полезные типы (legacy скрыты, но принимаются через aliases).
RESEARCH_TYPE_CATALOG: tuple[dict[str, str], ...] = (
    {
        "id": "market",
        "label": "Рынок и отрасль",
        "description": "Размер рынка, динамика спроса и отраслевой контекст по материалам проекта.",
    },
    {
        "id": "customer",
        "label": "Клиенты и аудитория",
        "description": "Кто покупает, сегменты, боли и мотивация — по интервью, опросам и брифам.",
    },
    {
        "id": "competitive",
        "label": "Конкуренты",
        "description": "Игроки, отличия предложений и пробелы — только из ваших материалов.",
    },
    {
        "id": "product",
        "label": "Продукт и предложение",
        "description": "Функции, упаковка, ограничения и обещания продукта из документов проекта.",
    },
    {
        "id": "swot",
        "label": "SWOT-анализ",
        "description": "Сильные и слабые стороны, возможности и угрозы с опорой на факты из vault.",
    },
    {
        "id": "jtbd",
        "label": "Задачи клиентов (JTBD)",
        "description": "Какие «работы» решает продукт, барьеры и критерии успеха.",
    },
    {
        "id": "value_proposition",
        "label": "Ценностное предложение",
        "description": "Ценность для клиента и доказательства из брифов и исследований.",
    },
    {
        "id": "trend_analysis",
        "label": "Тренды и риски",
        "description": "Наблюдаемые изменения рынка, риски и возможности — без прогнозов «с потолка».",
    },
    {
        "id": "custom",
        "label": "Свой тип",
        "description": "Свободная рамка: структура ответа по запросу брифа, но только по материалам проекта.",
    },
)

RESEARCH_TYPES: list[str] = [str(item["id"]) for item in RESEARCH_TYPE_CATALOG]

RESEARCH_TYPE_LABELS: dict[str, str] = {str(item["id"]): str(item["label"]) for item in RESEARCH_TYPE_CATALOG}

RESEARCH_TYPE_LEGACY_ALIASES: dict[str, str] = {
    "competition": "competitive",
    "competitor": "competitive",
    "competitor_analysis": "competitive",
    "porter": "competitive",
    "business": "market",
    "opportunity": "trend_analysis",
    "opportunity_analysis": "trend_analysis",
    "risk": "trend_analysis",
    "risk_assessment": "trend_analysis",
    "trend": "trend_analysis",
    "vp": "value_proposition",
}

_RESEARCH_PROMPT_SECTIONS: dict[str, str] = {
    "market": (
        "СТРУКТУРА ОТВЕТА:\n"
        "1) Краткое резюме (2–4 предложения)\n"
        "2) Картина рынка и спроса — только факты из контекста\n"
        "3) Драйверы и ограничения\n"
        "4) Пробелы: чего не хватает в материалах\n"
        "5) Следующие шаги — только если следуют из цитат"
    ),
    "customer": (
        "СТРУКТУРА ОТВЕТА:\n"
        "1) Краткое резюме\n"
        "2) Сегменты и портреты (с опорой на текст)\n"
        "3) Потребности, боли, триггеры покупки\n"
        "4) Возражения и барьеры\n"
        "5) Пробелы данных"
    ),
    "competitive": (
        "СТРУКТУРА ОТВЕТА:\n"
        "1) Краткое резюме\n"
        "2) Список конкурентов и заменителей из контекста\n"
        "3) Сравнение по осям, которые явно есть в материалах\n"
        "4) Возможности для отстройки\n"
        "5) Пробелы данных"
    ),
    "product": (
        "СТРУКТУРА ОТВЕТА:\n"
        "1) Краткое резюме\n"
        "2) Что за продукт/оффер (факты из контекста)\n"
        "3) Сильные стороны и ограничения\n"
        "4) Несостыковки между документами\n"
        "5) Пробелы данных"
    ),
    "swot": (
        "СТРУКТУРА ОТВЕТА:\n"
        "1) Краткое резюме\n"
        "2) S / W / O / T — каждый пункт с пометкой «есть опора в тексте» или «пробел»\n"
        "3) Противоречия между фрагментами\n"
        "4) Пробелы данных"
    ),
    "jtbd": (
        "СТРУКТУРА ОТВЕТА:\n"
        "1) Краткое резюме\n"
        "2) Формулировки работ (When / Want / So that) — только из контекста\n"
        "3) Критерии успеха и барьеры\n"
        "4) Альтернативы, если описаны\n"
        "5) Пробелы данных"
    ),
    "value_proposition": (
        "СТРУКТУРА ОТВЕТА:\n"
        "1) Краткое резюме\n"
        "2) Формулировка ценности для клиента\n"
        "3) Выгоды и доказательства из материалов\n"
        "4) Слабые места аргументации\n"
        "5) Пробелы данных"
    ),
    "trend_analysis": (
        "СТРУКТУРА ОТВЕТА:\n"
        "1) Краткое резюме\n"
        "2) Тренды и изменения — с опорой на текст\n"
        "3) Риски и возможности\n"
        "4) Что проверить дополнительно\n"
        "5) Пробелы данных"
    ),
    "custom": (
        "СТРУКТУРА ОТВЕТА:\n"
        "1) Краткое резюме по запросу брифа\n"
        "2) Ответ на исследовательский запрос по разделам, которые логично следуют из вопроса\n"
        "3) Пробелы данных и что загрузить в проект"
    ),
}

_INVARIANTS_BLOCK = (
    "ИНВАРИАНТЫ:\n"
    "- Единственный источник фактов — блок контекста проекта ниже (и RAG-фрагменты внутри него).\n"
    "- Запрещены веб-поиск, выдуманные URL, статистика и конкуренты не из текста.\n"
    "- Язык ответа — русский.\n"
    "- Если данных нет — пиши «Недостаточно материалов» и что загрузить; не заполняй общими советами.\n"
    "- Не используй шаблонные вступления («данный отчёт…», «в современном мире…»).\n"
)


def coerce_research_type_value(value: object) -> object:
    if value is None or not isinstance(value, str):
        return value
    key = value.strip().lower().replace("-", "_").replace(" ", "_")
    return RESEARCH_TYPE_LEGACY_ALIASES.get(key, key)


def normalize_research_type_key(value: str) -> str:
    coerced = coerce_research_type_value(value)
    if not isinstance(coerced, str):
        return "custom"
    key = coerced.strip().lower()
    return key if key in RESEARCH_TYPE_DB_VALUES else "custom"


def validate_research_type_enum(value: str) -> str:
    key = normalize_research_type_key(value)
    if key not in RESEARCH_TYPE_DB_VALUES:
        allowed = ", ".join(sorted(RESEARCH_TYPES))
        msg = f"Invalid research type '{value}'. Allowed: {allowed}"
        raise ValueError(msg)
    return key


def research_type_label(value: str | None) -> str:
    key = normalize_research_type_key(str(value or "custom"))
    return RESEARCH_TYPE_LABELS.get(key, key.replace("_", " ").capitalize())


def list_research_types_for_cabinet() -> list[dict[str, str]]:
    return [
        {
            "id": str(item["id"]),
            "label": str(item["label"]),
            "description": str(item.get("description") or ""),
        }
        for item in RESEARCH_TYPE_CATALOG
    ]


def build_evidence_research_run_prompt(existing: dict[str, Any], context_text: str) -> str:
    raw_type = str(existing.get("research_type") or "custom")
    research_type = normalize_research_type_key(raw_type)
    type_label = research_type_label(research_type)
    goals = list(existing.get("goals") or [])
    goals_text = "\n".join(f"- {goal}" for goal in goals if str(goal).strip())
    sections = _RESEARCH_PROMPT_SECTIONS.get(research_type, _RESEARCH_PROMPT_SECTIONS["custom"])
    return (
        "Ты готовишь краткий бриф-ответ по материалам маркетингового проекта EliteEW.\n"
        f"{_INVARIANTS_BLOCK}\n"
        f"ТИП БРИФА: {type_label} ({research_type})\n"
        f"{sections}\n\n"
        f"{context_text}\n\n"
        f"Название брифа: {existing.get('title') or 'Без названия'}\n"
        f"Запрос: {existing.get('research_query') or 'не указан'}\n"
        f"Описание: {existing.get('description') or '—'}\n"
        f"Цели:\n{goals_text or '- не указаны'}\n"
    )


__all__ = [
    "RESEARCH_TYPES",
    "RESEARCH_TYPE_CATALOG",
    "RESEARCH_TYPE_DB_VALUES",
    "RESEARCH_TYPE_LABELS",
    "RESEARCH_TYPE_LEGACY_ALIASES",
    "build_evidence_research_run_prompt",
    "coerce_research_type_value",
    "list_research_types_for_cabinet",
    "normalize_research_type_key",
    "research_type_label",
    "validate_research_type_enum",
]
