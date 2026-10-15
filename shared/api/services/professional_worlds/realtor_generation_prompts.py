# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# UGS prompt builders for realtor property copy and learning coach role-play in Professional Worlds.
# Invariants:
# - Prompts separate facts from emotional JTBD copy and forbid invented legal/financial guarantees.
# Related:
# - api/services/professional_worlds/service.py
# - api/routers/professional_worlds_ai_streams.py
# ---

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from api.schemas.professional_worlds import CoachSimulationBody, RealtorGenerationBody


def build_realtor_prompt(
    property_row: Mapping[str, Any], body: RealtorGenerationBody, *, content_pack: bool
) -> tuple[str, str]:
    """Build UGS input prompt for realtor object copy."""
    recipe_key = "realtor_property_content_pack" if content_pack else "realtor_property_description_jtbd"
    jtbd = property_row.get("jtbd_context") or {}
    prompt = f"""
Ты — ассистент EliteEW Professional Worlds для риэлтора во Владивостоке.

Задача: {"создать контент-пак" if content_pack else "создать описание объекта"}.
Тон: {body.tone}.
Дополнительная инструкция специалиста: {body.instruction or "—"}.

Факты объекта:
- Название: {property_row.get("title")}
- Тип сделки: {property_row.get("deal_type")}
- Тип объекта: {property_row.get("property_type")}
- Город/район: {property_row.get("city")} / {property_row.get("district") or "—"}
- Адрес: {property_row.get("address") or "—"}
- Цена: {property_row.get("price") or "—"}
- Площадь: {property_row.get("area_m2") or "—"}
- Комнат: {property_row.get("rooms") or "—"}
- Этаж: {property_row.get("floor") or "—"} из {property_row.get("total_floors") or "—"}
- Вид/особенности: {property_row.get("view") or "—"}
- Инфраструктура: {", ".join(property_row.get("infrastructure") or []) or "—"}

JTBD:
- Когда/контекст: {jtbd.get("trigger_context") or "—"}
- Хочу результат: {jtbd.get("expected_result") or "—"}
- Чтобы почувствовать: {jtbd.get("emotional_transformation") or "—"}
- Сегмент: {jtbd.get("audience_segment") or "—"}

Правила:
- Не выдумывай факты, документы, юридическую чистоту, ипотечное одобрение или доходность.
- Отделяй факты от эмоциональной подачи.
- Для инвестиций используй осторожные формулировки и напоминай о проверке рисков.
- Пиши на русском языке, профессионально и доброжелательно.

Формат результата:
{"1) краткое описание, 2) пост, 3) сценарий короткого видео, 4) аудио-тур, 5) план презентации" if content_pack else "готовое описание объекта 1200-1800 знаков + 5 коротких преимуществ"}
""".strip()
    return recipe_key, prompt


def build_coach_prompt(body: CoachSimulationBody) -> tuple[str, str]:
    """Build role-play coach prompt."""
    prompt = f"""
Ты — тренер EliteEW Professional Worlds для риэлтора. Проведи этичный role-play.

Сценарий: {body.scenario}
Сообщение специалиста: {body.user_message}

Ответь структурой:
1. Реплика клиента/оппонента.
2. Разбор ответа специалиста: ясность, эмпатия, следующий шаг, риски обещаний.
3. Улучшенная версия ответа.
4. Один практический совет на следующий разговор.

Не используй манипулятивные техники. Фокус: доверие, конкретика, уважение к клиенту.
""".strip()
    return "realtor_learning_roleplay", prompt


def build_ugs_input(prompt: str) -> dict[str, Any]:
    """Create UGS input payload for text generation."""
    return {
        "prompt": prompt,
        "temperature": 0.7,
        "max_tokens": 1800,
        "stream": True,
    }
