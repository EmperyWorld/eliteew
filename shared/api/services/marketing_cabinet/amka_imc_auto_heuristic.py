# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Pure helpers to pick an IMC RAG type key in run_mode=auto when the plan step omits imc_type_key, and to
# aggregate cabinet audit text for that heuristic (scrubbed, size-bounded).
# Invariants:
# - No I/O, no marketing DB; only string normalization and rule tables.
# - Needle lists stay ASCII/Unicode literals; do not log audited user content from here.
# Related:
# - api.services.marketing_cabinet.amka_execute_async_helpers
# - api.services.marketing_cabinet.amka_phase_execute_section
# - tests/test_amka_imc_auto_haystack.py
# ---
from __future__ import annotations

import re
from collections.abc import Mapping
from typing import Any

_AMKA_IMC_TYPE_KEY_RE = re.compile(r"^imc_rag_[a-z0-9_]{1,80}$")

# Верхняя граница агрегированного текста аудита для эвристики выбора imc_type_key (без логирования содержимого).
AMKA_IMC_AUTO_CABINET_HAYSTACK_MAX_CHARS = 10_000

# Метрики кабинета («Сигналов внимания») содержат подстроку «сигнал» — убираем до матча эвристики trends_signals.
_IMC_HEURISTIC_FALSE_POSITIVE_SUBS: tuple[tuple[str, str], ...] = (
    (r"сигналов\s+внимания", " "),
    (r"сигналы\s+внимания", " "),
    (r"сигнал\s+внимания", " "),
    (r"attention\s+signals?", " "),
    (r"signals?\s+of\s+attention", " "),
)


def scrub_text_for_imc_auto_heuristic(text: str) -> str:
    """Нормализует фрагменты аудита, чтобы не триггерить imc_rag_trends_signals на продуктовых формулировках."""
    s = str(text or "")
    for pattern, repl in _IMC_HEURISTIC_FALSE_POSITIVE_SUBS:
        s = re.sub(pattern, repl, s, flags=re.IGNORECASE)
    return s


def _is_valid_amka_imc_type_key(type_key: str) -> bool:
    return bool(type_key and _AMKA_IMC_TYPE_KEY_RE.match(str(type_key).strip()))


def resolve_amka_imc_type_key_for_execution(type_key: str) -> str:
    """Remap deprecated/inactive IMC keys to RAG successors before AMKA execute."""
    tk = str(type_key or "").strip()
    if not _is_valid_amka_imc_type_key(tk):
        return "imc_rag_jtbd"
    from api.services.imc.imc_legacy_type_successors import successor_for_deprecated_imc_type

    succ = successor_for_deprecated_imc_type(tk)
    return succ if succ else tk


def build_imc_auto_cabinet_haystack(
    audit_payloads: Mapping[str, Any],
    *,
    max_chars: int = AMKA_IMC_AUTO_CABINET_HAYSTACK_MAX_CHARS,
) -> tuple[str, int]:
    """Сжатый текст по всем section_audits для эвристики ИМК в run_mode=auto.

    Второй элемент — число разделов, из которых попали непустые work_needed/current_state.
    """
    chunks: list[str] = []
    included_sections = 0
    for map_key in sorted(audit_payloads.keys(), key=lambda k: str(k)):
        pl = audit_payloads.get(map_key)
        if not isinstance(pl, dict):
            continue
        sk = str(pl.get("section_key") or map_key).strip() or str(map_key)
        block_parts: list[str] = [f"[{sk}]"]
        wn = pl.get("work_needed")
        if isinstance(wn, list):
            for line in wn:
                s = scrub_text_for_imc_auto_heuristic(str(line).strip())
                if s:
                    block_parts.append(s)
        cs_raw = str(pl.get("current_state") or "").strip()
        cs = scrub_text_for_imc_auto_heuristic(cs_raw)
        if cs:
            block_parts.append(cs[:500])
        if len(block_parts) <= 1:
            continue
        included_sections += 1
        chunks.append("\n".join(block_parts))
    raw = "\n".join(chunks)
    if len(raw) <= max_chars:
        return raw, included_sections
    return raw[: max_chars - 1] + "…", included_sections


def _heuristic_imc_type_key_for_amka_auto(
    audit_payload: dict[str, Any],
    plan_payload: dict[str, Any],
    *,
    cabinet_haystack: str = "",
    exclude_imc_type_keys: frozenset[str] | set[str] | None = None,
) -> str:
    """Pick IMC generation type when run_mode=auto and the plan step has no imc_type_key."""
    parts: list[str] = [
        scrub_text_for_imc_auto_heuristic(str(plan_payload.get("rationale") or "")),
        scrub_text_for_imc_auto_heuristic(str(plan_payload.get("title") or "")),
    ]
    parts.extend(
        scrub_text_for_imc_auto_heuristic(str(x))
        for x in list(audit_payload.get("work_needed") or [])
        if str(x).strip()
    )
    extra = scrub_text_for_imc_auto_heuristic(str(cabinet_haystack or "").strip())
    if extra:
        parts.append(extra)
    hay = " ".join(scrub_text_for_imc_auto_heuristic(p) for p in parts).casefold()
    excluded = frozenset(exclude_imc_type_keys or ())
    rules: list[tuple[str, tuple[str, ...]]] = [
        # Не использовать голые «сигнал»/signal — ложные срабатывания на метриках кабинета (после scrub остаются только иные контексты).
        (
            "imc_rag_trends_signals",
            (
                "тренд",
                "trend",
                "макро",
                "нарратив",
                "macro",
                "рыночн сигнал",
                "market signal",
                "pestle",
                "регулятор",
                "санкц",
            ),
        ),
        ("imc_rag_swot", ("swot", "свот")),
        ("imc_rag_competitive", ("конкурент", "compet")),
        (
            "imc_rag_target_audience",
            ("целев аудитор", "target audience", "icp", "персон", "persona", "сегмент аудитор", "портрет клиент"),
        ),
        (
            "imc_rag_value_proposition",
            ("ценностн предлож", "value proposition", "value prop", "выгод для клиент", "обещан клиент"),
        ),
        (
            "imc_rag_marketing_gtm_plan",
            (
                "gtm",
                "go-to-market",
                "go to market",
                "вывод на рынок",
                "план вывода",
                "запуск продукта",
                "запуск на рынок",
                "product launch",
                "go to market plan",
                "контент-план",
                "контент стратег",
                "редакционн",
                "коммуникационн план",
            ),
        ),
        (
            "imc_rag_campaign_retrospective",
            (
                "ретроспектива",
                "постмортем",
                "post-mortem",
                "postmortem",
                "итоги кампан",
                "разбор кампан",
                "кампани итог",
            ),
        ),
        (
            "imc_rag_cx_journey",
            (
                "customer journey",
                "journey map",
                "cjm",
                "touchpoint",
                "тачпоинт",
                "путь клиента",
                "карта пути",
                "касани",
                "момент истины",
                "moments of truth",
                " sla",
                "sla ",
                "recovery",
                "регламент поддержк",
            ),
        ),
        (
            "imc_rag_voice_of_customer",
            (
                "голос клиента",
                "voice of customer",
                "nps",
                "csat",
                "voc",
                "тематическ",
                "вербатим",
                "verbatim",
                "отзыв клиен",
                "жалоб",
                "обращен клиен",
            ),
        ),
        (
            "imc_rag_channel_partner_rf",
            (
                "канальн стратег",
                "медиаплан",
                "партнерск",
                "партнёрск",
                "дистриб",
                "affiliate",
                "реселлер",
            ),
        ),
        (
            "imc_rag_positioning_messaging",
            (
                "позиционирован",
                "positioning",
                "месседж",
                "messaging",
                "утп",
                "rtb",
                "reasons to believe",
                "гайдлайн",
                "нейминг",
                "tone of voice",
                "брендбук",
                "brand book",
            ),
        ),
        (
            "imc_rag_pricing_packaging_rf",
            (
                "тариф",
                "прайс",
                "ценообраз",
                "упаковк предлож",
                "скидк",
                "pricing",
                "коммерческ предложен",
                "кп ",
            ),
        ),
        (
            "imc_rag_cabinet_analysis",
            (
                "целостн",
                "обзор",
                "кабинет",
                "integrity",
                "coverage",
                "покрыт",
                "raci",
                "стейкхолдер",
                "stakehold",
                "governance",
            ),
        ),
        ("imc_rag_customer_diagnostic", ("диагностик", "diagnostic", "анкет", "survey")),
    ]
    for tk, needles in rules:
        if tk in excluded:
            continue
        if any(n in hay for n in needles):
            return tk
    if "imc_rag_jtbd" not in excluded:
        return "imc_rag_jtbd"
    for tk, _ in rules:
        if tk not in excluded:
            return tk
    return "imc_rag_jtbd"


def pick_rotating_imc_type_key(
    catalog_type_keys: list[str],
    excluded: set[str] | frozenset[str],
) -> str:
    """Pick the next catalog type_key not yet used in the current AMKA plan/run."""
    for raw in catalog_type_keys:
        tk = str(raw or "").strip()
        if _is_valid_amka_imc_type_key(tk) and tk not in excluded:
            return tk
    return _heuristic_imc_type_key_for_amka_auto({}, {}, exclude_imc_type_keys=frozenset(excluded))


__all__ = [
    "AMKA_IMC_AUTO_CABINET_HAYSTACK_MAX_CHARS",
    "_AMKA_IMC_TYPE_KEY_RE",
    "_heuristic_imc_type_key_for_amka_auto",
    "_is_valid_amka_imc_type_key",
    "build_imc_auto_cabinet_haystack",
    "resolve_amka_imc_type_key_for_execution",
    "pick_rotating_imc_type_key",
    "scrub_text_for_imc_auto_heuristic",
]
