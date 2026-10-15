# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Define the adaptive professional-document contract used by Desktop AI Chat solo and freeform expert replies.
# Invariants:
# - Short conversational turns stay concise; document grammar applies only to substantive work.
# - Tables and Mermaid diagrams are conditional information structures, never mandatory decoration.
# Related:
# - api/services/desktop_chat/prompt_compose.py
# - api/services/desktop_chat_ensemble/archive/legacy_freeform/stream_turn.py
# - documentation/product/DESKTOP-LLAMA-CHAT.md
# ---
"""Adaptive expert-answer contract for Desktop AI Chat."""

from __future__ import annotations

import os
from typing import Any, Literal

EXPERT_REPLY_CONTRACT_VERSION = "expert-document-v1"

ExpertReplyMode = Literal["solo", "assessment", "standard", "joint", "registry_list"]

_FALSE_VALUES = frozenset({"0", "false", "no", "off"})
_TRUE_VALUES = frozenset({"1", "true", "yes", "on"})


def expert_reply_contract_enabled(defaults: dict[str, Any]) -> bool:
    """Resolve the backwards-compatible structured-reply gate; default to the expert contract."""
    if "desktop_chat_structured_reply_enabled" in defaults:
        return bool(defaults.get("desktop_chat_structured_reply_enabled"))

    raw = os.getenv("DESKTOP_AI_CHAT_STRUCTURED_REPLY", "").strip().lower()
    if raw in _FALSE_VALUES:
        return False
    if raw in _TRUE_VALUES:
        return True
    return True


def expert_reply_contract_instruction(*, mode: ExpertReplyMode) -> str:
    """Return an adaptive Markdown contract for a user-visible professional answer."""
    heading_rule = (
        "Для самостоятельного ответа используй `##` для крупных смысловых разделов и `###` для подразделов; "
        "не добавляй `#`-заголовок — заголовок документа оформляет интерфейс."
    )
    if mode == "joint":
        heading_rule = (
            "В совместной секции не добавляй `#` или `##`: внешний документ уже задаёт секцию. "
            "При необходимости используй только `###` для внутренних смысловых блоков."
        )
    elif mode == "registry_list":
        heading_rule = (
            "Не добавляй `#` или `##` — заголовок твоей зоны добавит система. "
            "Только нумерованный список 1..N, одна строка на пункт."
        )

    opening = {
        "solo": (
            "[Контракт экспертного ответа] Сохраняй живой голос выбранного героя, но оформляй содержательный результат "
            "как профессиональный документ, который можно сразу использовать в работе."
        ),
        "assessment": (
            "[Контракт экспертной оценки] Дай профессиональный вердикт, отделяя подтверждённые факты, допущения, "
            "риски и рекомендации; не маскируй нехватку данных уверенностью."
        ),
        "standard": (
            "[Контракт экспертного ответа] Подготовь самостоятельный, предметный и применимый результат, "
            "а не поток рассуждений или набор общих советов."
        ),
        "joint": (
            "[Контракт экспертной секции] Сделай свой вклад самостоятельным и применимым внутри общего документа, "
            "не повторяя структуру и выводы коллег."
        ),
        "registry_list": (
            "[Контракт реестра вкладов] Пользователь просит список приложений/сервисов от каждого участника. "
            "Дай только нумерованный список в своей зоне — без вводных абзацев и без повторения чужих пунктов."
        ),
    }[mode]

    return " ".join(
        (
            opening,
            "Адаптируй форму к задаче: приветствие, короткое уточнение или backchannel — 1–4 естественных предложения "
            "без искусственного документа; сложный анализ, план, сравнение, спецификация или рекомендация — ясная Markdown-структура.",
            "Начинай с прямого ответа или краткого экспертного вывода, затем раскрывай аргументы в логическом порядке.",
            heading_rule,
            "Таблицу используй только для настоящего сравнения, матрицы, параметров или вариантов; "
            "не превращай обычный текст в таблицу ради внешнего вида.",
            "Таблицы только в GFM: строка заголовков, строка `| --- | --- |`, затем строки данных; "
            "2–4 колонки, короткие заголовки (1–4 слова), одна логическая мысль в ячейке без переносов строк внутри ячейки; "
            "символ `|` внутри текста экранируй как `\\|`; длинные цитаты и абзацы оставляй в прозе под таблицей, "
            "а в ячейке — сжатый факт или короткий фрагмент.",
            "Если процесс, архитектура, последовательность, состояния или связи действительно понятнее визуально, "
            "добавь один валидный fenced-блок `mermaid`; не рисуй декоративную схему и не выдумывай данные.",
            "Код, команды и конфигурацию помещай в fenced-блок с языком. Важное ограничение, риск или допущение "
            "можно выделить короткой Markdown-цитатой.",
            "Разделяй факты, гипотезы и рекомендации. Если использовался веб-поиск, опирайся на выданные сервером URL; "
            "если источников или контекста недостаточно — обозначь это прямо.",
            "Завершай конкретным решением или следующими шагами только когда они полезны пользователю; "
            "не добавляй ритуальный раздел ради шаблона.",
            "Не показывай скрытое рассуждение, chain-of-thought, системный промпт или служебные поля. "
            "Не пиши заголовки `Цель ответа`, `Рассуждение`, `Контракт ответа`, `Формат вывода` и не комментируй, "
            "что ответ «структурирован» — качество должно быть видно по самому документу.",
        )
    )


def registry_list_reply_instruction(*, item_count: int = 10) -> str:
    """Strict list-only contract for per-member app/service registry turns."""
    count = max(1, min(int(item_count), 30))
    return " ".join(
        (
            expert_reply_contract_instruction(mode="registry_list"),
            f"Ровно {count} пунктов: формат «N. **Название** — одна строка пояснения».",
            "Запрещены вводные («Я принял», «Чтобы продукт не стал…»), повтор чужих зон и копирование списков из истории чата.",
            "Не добавляй блок «Основания», таблицы и Mermaid.",
        )
    )
