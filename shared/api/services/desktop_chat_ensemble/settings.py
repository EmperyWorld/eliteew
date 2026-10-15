# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Validate and normalize Desktop AI Chat settings for solo/ensemble modes.
# Invariants:
# - `desktop_hero_prompt_version` is derived from canonical hero prompt data in solo mode.
# - AMKA ephemeral keys (`amka_ephemeral`, `amka_run_id`, …) pass through sanitize for KBSEW surface detection.
# Related:
# - api/services/desktop_chat_ensemble/heroes_prompt_data.py
# - api/routers/desktop_ai_chat.py
# ---
"""Ensemble chat mode: settings parsing and roster (sync with frontend desktopAiHeroes ids)."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from pydantic import BaseModel

from api.models.desktop_ai_chat import DesktopAiChat
from api.services.desktop_chat_ensemble.heroes_prompt_data import get_hero_prompt_version

# Product UI cohorts: «Ассистенты» vs «IT отдел» (picker sections). Same allowlist for sanitize.
ASSISTANT_DESKTOP_HERO_IDS: tuple[str, ...] = (
    "likiy_sorrento",
    "arlyqueen",
    "akimbo",
    "arlekino_pravoz",
    "max_safin",
    "suno_songwriter",
    "dr_vereskov",
    "viktor_engineer",
    "nikita_dvizhev",
    "mark_arkadevich",
    "elena_valeryevna",
    "kristian_romanovich",
    "artur_sergeevich",
    "diana_igorevna",
    "viktor_lvovich",
    "nikolas_alekseevich",
    "nadin_context",
)
IT_DEPT_DESKTOP_HERO_IDS: tuple[str, ...] = (
    "it_kernel",
    "it_schema",
    "it_canvas",
    "it_pipeliner",
    "it_sentinel",
    "it_relay",
)
COLLECTIVE_SOULS_DESKTOP_HERO_IDS: tuple[str, ...] = (
    "nikolay_fyodorovich",
    "albert_emilevich",
    "yanus_arnievich",
    "yan_genrihovich",
    "richard_joshuevich",
    "teresa_agnesovna",
)
ALLOWED_DESKTOP_HERO_IDS: tuple[str, ...] = (
    ASSISTANT_DESKTOP_HERO_IDS + IT_DEPT_DESKTOP_HERO_IDS + COLLECTIVE_SOULS_DESKTOP_HERO_IDS
)
# Default «Команда» roster stays business assistants (not IT zoo).
DEFAULT_ENSEMBLE_HERO_ORDER: tuple[str, ...] = ASSISTANT_DESKTOP_HERO_IDS

# Максимум героев в ростере группового чата (пользователь и оркестратор не считаются).
# Продуктовый UI Desktop AI Chat: минимум 3, опционально 4–6; сервер жёстко режет свыше max.
# Короче max допустимо для AMKA/agentic/legacy payload (UI desktop требует ≥3).
ENSEMBLE_MAX_ROSTER_HEROES = 6
ENSEMBLE_MIN_ROSTER_HEROES = 3

ENSEMBLE_CHAT_MODE = "ensemble"
SOLO_CHAT_MODE = "solo"

# Режим исполнения группы: structured blueprint vs legacy freeform orchestrator.
ENSEMBLE_ENGINE_BLUEPRINT = "blueprint"
ENSEMBLE_ENGINE_LEGACY_FREEFORM = "legacy_freeform"

# Режим маршрутизации blueprint vs диалог (только смысл для desktop_chat_mode=ensemble).
ENSEMBLE_ROUTING_AUTO = "auto"
ENSEMBLE_ROUTING_SEMI = "semi"
ENSEMBLE_ROUTING_CHAT_ONLY = "chat_only"
ENSEMBLE_ROUTING_BLUEPRINT_ONLY = "blueprint_only"

ENSEMBLE_ROUTING_MODES: frozenset[str] = frozenset(
    {
        ENSEMBLE_ROUTING_AUTO,
        ENSEMBLE_ROUTING_SEMI,
        ENSEMBLE_ROUTING_CHAT_ONLY,
        ENSEMBLE_ROUTING_BLUEPRINT_ONLY,
    }
)

# metadata user-сообщения: полуавтомат подтверждения документа
ENSEMBLE_DOC_CONFIRM_ASKED = "asked"
ENSEMBLE_DOC_CONFIRM_ACCEPTED = "accepted"
ENSEMBLE_DOC_CONFIRM_DECLINED = "declined"


def resolve_ensemble_routing_mode(chat: DesktopAiChat, defaults: dict[str, Any]) -> str:
    """auto | semi | chat_only | blueprint_only; по умолчанию auto."""
    s = chat.settings if isinstance(chat.settings, dict) else {}
    raw = s.get("desktop_ensemble_routing_mode")
    if raw is None or raw == "":
        raw = defaults.get("desktop_ensemble_routing_mode")
    if isinstance(raw, str):
        rs = raw.strip()
        if rs in ENSEMBLE_ROUTING_MODES:
            return rs
    return ENSEMBLE_ROUTING_AUTO


def resolve_ensemble_engine(chat: DesktopAiChat, defaults: dict[str, Any]) -> str:
    """Как стримить ensemble: blueprint (шаблоны) или legacy_freeform (оркестратор JSON)."""
    s = chat.settings if isinstance(chat.settings, dict) else {}
    raw = s.get("desktop_ensemble_engine")
    if raw is None or raw == "":
        raw = defaults.get("desktop_ensemble_engine")
    if raw is None or raw == "":
        return ENSEMBLE_ENGINE_BLUEPRINT
    if isinstance(raw, str) and raw.strip() == ENSEMBLE_ENGINE_LEGACY_FREEFORM:
        return ENSEMBLE_ENGINE_LEGACY_FREEFORM
    return ENSEMBLE_ENGINE_BLUEPRINT


DEFAULT_ENSEMBLE_SYSTEM_PROMPT = (
    "Ты работаешь как профессиональный деловой совет EliteEW: стратегия, маркетинг, продукт, финансы, "
    "операции, право и архитектура подключаются только по своей компетенции. Пиши по-русски, без театра. "
    "Каждый существенный вывод отделяет факты от гипотез, называет пробелы данных и даёт практически "
    "используемый формат: решение, аргументы, риски, проверка или следующий доказательный шаг."
)


def _allowed_set() -> set[str]:
    return set(ALLOWED_DESKTOP_HERO_IDS)


def sanitize_desktop_chat_settings_payload(
    raw: Mapping[str, Any] | BaseModel | None,
) -> dict[str, Any]:
    """Subset of settings keys safe to store from API (create/patch)."""
    if raw is None:
        return {}
    if isinstance(raw, BaseModel):
        raw = raw.model_dump(exclude_none=True)
    if not raw:
        return {}
    out: dict[str, Any] = {}
    hid = raw.get("desktop_hero_id")
    if isinstance(hid, str) and hid.strip():
        hs = hid.strip()[:64]
        if hs in _allowed_set():
            out["desktop_hero_id"] = hs
            out["desktop_hero_prompt_version"] = get_hero_prompt_version(hs)

    mode = raw.get("desktop_chat_mode")
    if isinstance(mode, str) and mode.strip() in (SOLO_CHAT_MODE, ENSEMBLE_CHAT_MODE):
        out["desktop_chat_mode"] = mode.strip()

    ens_all = raw.get("desktop_ensemble_all")
    if ens_all is True:
        out["desktop_ensemble_all"] = True

    ids = raw.get("desktop_ensemble_ids")
    if isinstance(ids, list):
        cleaned: list[str] = []
        seen: set[str] = set()
        allowed = _allowed_set()
        for x in ids[:ENSEMBLE_MAX_ROSTER_HEROES]:
            if not isinstance(x, str):
                continue
            s = x.strip()[:64]
            if s in allowed and s not in seen:
                seen.add(s)
                cleaned.append(s)
        if cleaned:
            out["desktop_ensemble_ids"] = cleaned

    eng = raw.get("desktop_ensemble_engine")
    if isinstance(eng, str) and eng.strip() in (
        ENSEMBLE_ENGINE_BLUEPRINT,
        ENSEMBLE_ENGINE_LEGACY_FREEFORM,
    ):
        out["desktop_ensemble_engine"] = eng.strip()

    rmode = raw.get("desktop_ensemble_routing_mode")
    if isinstance(rmode, str) and rmode.strip() in ENSEMBLE_ROUTING_MODES:
        out["desktop_ensemble_routing_mode"] = rmode.strip()

    if out.get("desktop_chat_mode") == ENSEMBLE_CHAT_MODE:
        out.pop("desktop_hero_id", None)
        out.pop("desktop_hero_prompt_version", None)
        if out.get("desktop_ensemble_all") is True:
            out.pop("desktop_ensemble_ids", None)
        elif isinstance(out.get("desktop_ensemble_ids"), list) and out["desktop_ensemble_ids"]:
            out["desktop_ensemble_all"] = False
        else:
            out["desktop_ensemble_all"] = True
            out.pop("desktop_ensemble_ids", None)
    else:
        out.pop("desktop_ensemble_all", None)
        out.pop("desktop_ensemble_ids", None)
        out.pop("desktop_ensemble_routing_mode", None)
        if "desktop_chat_mode" not in out and "desktop_hero_id" in out:
            out["desktop_chat_mode"] = SOLO_CHAT_MODE

    kss_raw = raw.get("kbsew_search_settings")
    if isinstance(kss_raw, dict):
        from api.services.desktop_chat.kbsew_search_settings import normalize_kbsew_search_settings

        out["kbsew_search_settings"] = normalize_kbsew_search_settings(kss_raw).model_dump()

    for amka_key in (
        "amka_ephemeral",
        "amka_run_id",
        "amka_step_id",
        "amka_forced_blueprint_template_id",
        "amka_suppress_research_plan_heuristic",
    ):
        val = raw.get(amka_key)
        if amka_key in ("amka_ephemeral", "amka_suppress_research_plan_heuristic") and val is True:
            out[amka_key] = True
        elif isinstance(val, str) and val.strip():
            out[amka_key] = val.strip()[:128]

    return out


def is_ensemble_chat(chat: DesktopAiChat) -> bool:
    s = chat.settings or {}
    return s.get("desktop_chat_mode") == ENSEMBLE_CHAT_MODE


def get_ensemble_roster(settings: dict[str, Any]) -> list[str]:
    cap = ENSEMBLE_MAX_ROSTER_HEROES
    if settings.get("desktop_ensemble_all") is True:
        return list(DEFAULT_ENSEMBLE_HERO_ORDER)[:cap]
    raw = settings.get("desktop_ensemble_ids")
    if isinstance(raw, list):
        allowed = _allowed_set()
        out: list[str] = []
        seen: set[str] = set()
        for x in raw:
            if isinstance(x, str):
                tid = x.strip()
                if tid in allowed and tid not in seen:
                    seen.add(tid)
                    out.append(tid)
            if len(out) >= cap:
                break
        if out:
            return out[:cap]
    return list(DEFAULT_ENSEMBLE_HERO_ORDER)[:cap]
