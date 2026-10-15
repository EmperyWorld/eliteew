# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Соло-слот desktop chat: биллинг энергии по длительности и герою (UTC-сервер).
# Invariants:
# - chat.updated_at после операций — utc_now_naive().
# Related:
# - desktop_ai_chat router, ensemble settings
# ---
"""Solo Desktop AI Chat: time slot (server UTC), energy billing."""

from __future__ import annotations

from datetime import timedelta
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from api.models.desktop_ai_chat import DesktopAiChat
from api.services.desktop_chat_ensemble.settings import (
    ALLOWED_DESKTOP_HERO_IDS,
    is_ensemble_chat,
    sanitize_desktop_chat_settings_payload,
)
from api.utils.datetime_helpers import utc_now_naive

# Минимум энергии за час чата (база для расчёта по герою).
SOLO_SLOT_MIN_ENERGY_PER_HOUR = 1000
# Скидка на блок 12 ч (20% от линейной суммы 12×час).
SOLO_SLOT_12H_DISCOUNT_RATIO = 0.8

# Множитель «веса» героя по компетенциям (≥1.0 → час не ниже SOLO_SLOT_MIN_ENERGY_PER_HOUR).
SOLO_HERO_COMPETENCE_MULTIPLIER: dict[str, float] = {
    "likiy_sorrento": 1.0,
    "max_safin": 1.0,
    "akimbo": 1.1,
    "arlyqueen": 1.15,
    "dr_vereskov": 1.15,
    "arlekino_pravoz": 1.2,
    "viktor_engineer": 1.2,
    "nikita_dvizhev": 1.2,
    "suno_songwriter": 1.25,
    "mark_arkadevich": 1.25,
    "elena_valeryevna": 1.2,
    "kristian_romanovich": 1.15,
    "artur_sergeevich": 1.2,
    "diana_igorevna": 1.15,
    "viktor_lvovich": 1.25,
    "nikolas_alekseevich": 1.3,
    "nadin_context": 1.1,
    "it_kernel": 1.25,
    "it_schema": 1.2,
    "it_canvas": 1.2,
    "it_pipeliner": 1.2,
    "it_sentinel": 1.25,
    "it_relay": 1.2,
    "nikolay_fyodorovich": 1.2,
    "albert_emilevich": 1.15,
    "yanus_arnievich": 1.2,
    "yan_genrihovich": 1.15,
    "richard_joshuevich": 1.25,
    "teresa_agnesovna": 1.1,
}

ALLOWED_SOLO_DURATIONS: frozenset[int] = frozenset({1, 2, 12})


def _hero_multiplier(hero_id: str | None) -> float:
    if not hero_id or not str(hero_id).strip():
        return 1.0
    key = str(hero_id).strip()
    return float(SOLO_HERO_COMPETENCE_MULTIPLIER.get(key, 1.0))


def hourly_energy_for_hero(hero_id: str | None) -> int:
    """Энергия за один час для выбранного героя (не меньше SOLO_SLOT_MIN_ENERGY_PER_HOUR)."""
    m = _hero_multiplier(hero_id)
    return max(SOLO_SLOT_MIN_ENERGY_PER_HOUR, int(round(SOLO_SLOT_MIN_ENERGY_PER_HOUR * m)))


def total_energy_for_solo_slot(duration_hours: int, hero_id: str | None) -> int:
    """Полная стоимость блока: 1ч и 2ч линейно, 12ч с глобальной скидкой 20%."""
    h = hourly_energy_for_hero(hero_id)
    if duration_hours == 1:
        return h
    if duration_hours == 2:
        return 2 * h
    if duration_hours == 12:
        return int(12 * h * SOLO_SLOT_12H_DISCOUNT_RATIO)
    return -1


def build_solo_slot_tariffs_public() -> dict[str, Any]:
    """Справочник цен для UI (согласован с total_energy_for_solo_slot)."""
    by_hero: dict[str, dict[str, int]] = {}
    for hid in ALLOWED_DESKTOP_HERO_IDS:
        by_hero[hid] = {
            "1": total_energy_for_solo_slot(1, hid),
            "2": total_energy_for_solo_slot(2, hid),
            "12": total_energy_for_solo_slot(12, hid),
        }
    return {
        "min_energy_per_hour": SOLO_SLOT_MIN_ENERGY_PER_HOUR,
        "discount_12h_percent": 20,
        "hero_competence_multiplier": dict(SOLO_HERO_COMPETENCE_MULTIPLIER),
        "by_hero": by_hero,
    }


async def db_now_utc(session: AsyncSession):
    r = await session.execute(select(func.now()))
    return r.scalar_one()


def solo_slot_active_at(chat: DesktopAiChat, *, now) -> bool:
    ends = chat.solo_slot_ends_at
    if ends is None:
        return False
    return ends > now


async def assert_solo_slot_allows_stream(
    db: AsyncSession,
    chat: DesktopAiChat,
) -> None:
    """403 if solo chat has no active slot. Ensemble chats skip."""
    if is_ensemble_chat(chat):
        return
    now = await db_now_utc(db)
    ends = chat.solo_slot_ends_at
    if ends is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="solo_slot_required",
        )
    if ends <= now:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="solo_slot_expired",
        )


def chat_out_solo_slot_fields(chat: DesktopAiChat, *, now) -> dict[str, object]:
    active = solo_slot_active_at(chat, now=now)
    return {
        "solo_slot_ends_at": chat.solo_slot_ends_at.isoformat() if chat.solo_slot_ends_at else None,
        "solo_slot_started_at": chat.solo_slot_started_at.isoformat() if chat.solo_slot_started_at else None,
        "solo_slot_duration_hours": chat.solo_slot_duration_hours,
        "solo_slot_active": active,
    }


def resolve_hero_id_for_pricing(hero_id: str | None, chat: DesktopAiChat) -> str | None:
    if hero_id and str(hero_id).strip():
        return str(hero_id).strip()
    s = chat.settings if isinstance(chat.settings, dict) else {}
    raw = s.get("desktop_hero_id")
    if isinstance(raw, str) and raw.strip():
        return raw.strip()
    return None


async def apply_solo_slot_purchase(
    db: AsyncSession,
    *,
    chat: DesktopAiChat,
    user_id_str: str,
    duration_hours: int,
    hero_id: str | None,
    billing,
) -> None:
    """
    Extend solo_slot_ends_at, charge energy, optional hero in settings.
    Caller must hold row lock (FOR UPDATE). Commits nothing; caller commits.
    """
    if is_ensemble_chat(chat):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="solo_slot_only_for_solo_chat",
        )
    if duration_hours not in ALLOWED_SOLO_DURATIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="invalid_solo_slot_duration",
        )
    hid_for_price = resolve_hero_id_for_pricing(hero_id, chat)
    cost = total_energy_for_solo_slot(duration_hours, hid_for_price)
    if cost < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="invalid_solo_slot_duration",
        )

    ok = await billing.deduct_credits_without_commit(user_id_str, cost)
    if not ok:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="insufficient_credits",
        )

    now = await db_now_utc(db)
    prev_end = chat.solo_slot_ends_at
    base = now
    if prev_end is not None and prev_end > now:
        base = prev_end
    new_end = base + timedelta(hours=duration_hours)
    if chat.solo_slot_started_at is None or (prev_end is not None and prev_end <= now):
        chat.solo_slot_started_at = now
    chat.solo_slot_ends_at = new_end
    chat.solo_slot_duration_hours = duration_hours

    settings_in: dict[str, object] = {}
    if hero_id and str(hero_id).strip():
        settings_in["desktop_hero_id"] = str(hero_id).strip()
        settings_in["desktop_chat_mode"] = "solo"
    if settings_in:
        merged = dict(chat.settings or {})
        merged.update(sanitize_desktop_chat_settings_payload(settings_in))
        chat.settings = merged

    chat.updated_at = utc_now_naive()
    await db.flush()


async def apply_solo_slot_release(db: AsyncSession, *, chat: DesktopAiChat) -> None:
    """Clear slot and hero/prompt/model for solo chat (no refund)."""
    if is_ensemble_chat(chat):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="solo_slot_release_only_for_solo_chat",
        )
    chat.solo_slot_ends_at = None
    chat.solo_slot_started_at = None
    chat.solo_slot_duration_hours = None
    chat.system_prompt_override = None
    chat.llama_model = None
    s = dict(chat.settings or {})
    s.pop("desktop_hero_id", None)
    chat.settings = s
    chat.updated_at = utc_now_naive()
    await db.flush()
