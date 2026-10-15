# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Select a Desktop AI Chat blueprint template from user intent.
# Invariants:
# - Zero keyword matches must not silently fall back to the first manifest template.
# - Code-architecture audit intent (`user_requests_code_architecture_audit`) wins over product_spec/tech_plan keyword noise.
# - Interview room-card intent (`user_requests_interview_prep`) wins over research_plan_v1.
# - Partner/feedback coaching (`goal_looks_like_partner_feedback`) must not force research_plan_v1.
# - Agentic ephemeral turns with empty blueprint set
#   ``amka_suppress_research_plan_heuristic`` so web-armed keyword bias cannot score=98
#   ``research_plan_v1`` when the orchestrator intentionally left blueprint unset.
# - User-armed web + research/world-practice intent prefers research_plan_v1 over content_brief / it_ui_states
#   (RU imperatives «исследуй»/«изучи» count — not only noun stem «исследован»).
# Related:
# - documentation/product/DESKTOP-ENSEMBLE-PLAN-AUTHORING.md
# - documentation/product/DESKTOP-ENSEMBLE-ACTIONS.md
# ---

"""Pick plan template: keyword heuristics + optional short LLM classifier."""

from __future__ import annotations

import json
import logging
import re
from typing import Any

from api.services.desktop_chat.llm.json_sidecar import desktop_llm_json_object
from api.services.desktop_chat_ensemble import ensemble_audit_log
from api.services.desktop_chat_ensemble.actions.gate import user_requests_explicit_verify
from api.services.desktop_chat_ensemble.blueprint.catalog import PlanCatalog
from api.services.desktop_chat_ensemble.conversational_route import (
    user_requests_30_60_90_day_plan,
    user_requests_code_architecture_audit,
)
from api.services.desktop_chat_ensemble.intent_signals import goal_looks_like_partner_feedback
from api.services.llama_service import LlamaService

logger = logging.getLogger(__name__)

# Web-armed / research intent — noun stems + RU imperatives (исследуй ≠ исследован).
# Do NOT include bare «найди»/«поиск» here — those only count when use_web_search (see prefer helper).
_WEB_RESEARCH_BIAS_RE = re.compile(
    r"(?i)"
    r"(?:"
    r"исследован|"
    r"исследу|"
    r"изуч|"
    r"\bresearch\b|"
    r"research\s+plan|"
    r"план\s+исследован|"
    r"практик|"
    r"best\s+pract|"
    r"sota|"
    r"миров|"
    r"в\s+мире|"
    r"в\s+(?:сети|интернете|веб(?:е)?)|"
    r"world\s+practic|"
    r"обзор\s+рынк|"
    r"\bобзор\b|"
    r"факт[\s-]check"
    r")"
)

_WEB_ARMED_EXTRA_BIAS_RE = re.compile(r"(?i)(?:\bпоиск\b|найди(?:те)?)")

_INTERVIEW_PREP_RE = re.compile(
    r"(?i)("
    r"подготов(?:ь|ьте|ка|ки)\s+к\s+интервью|"
    r"тема\s+интервью|"
    r"цель\s+интервью|"
    r"пройти\s+интервью|"
    # Accusative/inflected room-card wording: «карточку интервью», not only «карточка».
    r"карточк\w*\s+интервью|"
    r"гайд\s+вопросов\s+для\s+панели|"
    r"параметры\s+комнат|"
    r"interview\s+prep|"
    r"interview\s+topic|"
    r"interview\s+goal|"
    r"founder\s+interview"
    r")"
)


def user_requests_interview_prep(user_text: str) -> bool:
    """True when the ask is a Discussion room card, not a general research plan."""
    return bool(_INTERVIEW_PREP_RE.search(user_text or ""))


def _research_plan_keyword_hit(user_text: str, catalog: PlanCatalog) -> bool:
    """True when any research_plan_v1 manifest keyword appears in the ask."""
    ent = next((e for e in catalog.manifest.templates if e.id == "research_plan_v1"), None)
    if ent is None:
        return False
    t = (user_text or "").lower()
    return any(kw.lower() in t for kw in ent.keywords)


def _prefer_research_plan_v1(
    user_text: str,
    catalog: PlanCatalog,
    *,
    use_web_search: bool,
    suppress_research_plan_heuristic: bool = False,
) -> bool:
    """Prefer research_plan over IT/content specificity traps when research intent is clear."""
    if suppress_research_plan_heuristic:
        return False
    if "research_plan_v1" not in catalog.templates_by_id:
        return False
    # Partner coaching / thesis feedback must not collapse into forced market research.
    if goal_looks_like_partner_feedback(user_text):
        return False
    bias = bool(_WEB_RESEARCH_BIAS_RE.search(user_text or ""))
    explicit = user_requests_explicit_verify(user_text)
    kw = _research_plan_keyword_hit(user_text, catalog)
    if use_web_search:
        # Armed web: bias, find/search wording, explicit verify, or research_plan keyword.
        web_extra = bool(_WEB_ARMED_EXTRA_BIAS_RE.search(user_text or ""))
        return bias or web_extra or explicit or kw
    # Without web: require research bias so pure UI journey stays it_ui_states_v1.
    return bias


def heuristic_pick_template_id(
    user_text: str,
    catalog: PlanCatalog,
    *,
    use_web_search: bool = False,
    suppress_research_plan_heuristic: bool = False,
) -> tuple[str, int]:
    """Return (template_id, keyword_hit_score)."""
    ranked = heuristic_rank_template_hits(
        user_text,
        catalog,
        use_web_search=use_web_search,
        suppress_research_plan_heuristic=suppress_research_plan_heuristic,
    )
    if not ranked:
        return ("", -1)
    return ranked[0][0], ranked[0][1]


def heuristic_rank_template_hits(
    user_text: str,
    catalog: PlanCatalog,
    *,
    use_web_search: bool = False,
    suppress_research_plan_heuristic: bool = False,
) -> list[tuple[str, int]]:
    """Rank all keyword-matching templates: (template_id, score) desc."""
    t = (user_text or "").lower()
    if user_requests_code_architecture_audit(user_text) and "code_architecture_audit_v1" in catalog.templates_by_id:
        return [("code_architecture_audit_v1", 99)]
    if user_requests_30_60_90_day_plan(user_text) and "business_plan_v1" in catalog.templates_by_id:
        return [("business_plan_v1", 99)]
    if user_requests_interview_prep(user_text) and "interview_prep_v1" in catalog.templates_by_id:
        return [("interview_prep_v1", 99)]
    if _prefer_research_plan_v1(
        user_text,
        catalog,
        use_web_search=use_web_search,
        suppress_research_plan_heuristic=suppress_research_plan_heuristic,
    ):
        scored_kw: list[tuple[str, int, int]] = []
        for ent in catalog.manifest.templates:
            matched = [kw for kw in ent.keywords if kw.lower() in t]
            score = len(matched)
            if score <= 0 or ent.id == "research_plan_v1":
                continue
            specificity = max((len(kw.strip()) for kw in matched), default=0)
            scored_kw.append((ent.id, score, specificity))
        scored_kw.sort(key=lambda item: (-item[1], -item[2], item[0]))
        # Keep secondary keyword hits for compound_deferred_templates.
        return [("research_plan_v1", 98)] + [(tid, score) for tid, score, _spec in scored_kw]
    scored: list[tuple[str, int, int]] = []
    for ent in catalog.manifest.templates:
        if suppress_research_plan_heuristic and ent.id == "research_plan_v1":
            continue
        matched = [kw for kw in ent.keywords if kw.lower() in t]
        score = len(matched)
        if score <= 0:
            continue
        specificity = max((len(kw.strip()) for kw in matched), default=0)
        scored.append((ent.id, score, specificity))
    scored.sort(key=lambda item: (-item[1], -item[2], item[0]))
    return [(tid, score) for tid, score, _spec in scored]


def compound_deferred_templates(
    user_text: str,
    catalog: PlanCatalog,
    *,
    primary_id: str,
    min_score: int = 1,
    use_web_search: bool = False,
) -> list[dict[str, str]]:
    """Other matching templates to run separately (no outline mashup)."""
    primary = (primary_id or "").strip()
    out: list[dict[str, str]] = []
    for tid, score in heuristic_rank_template_hits(
        user_text,
        catalog,
        use_web_search=use_web_search,
    ):
        if score < min_score or tid == primary:
            continue
        tpl = catalog.templates_by_id.get(tid)
        out.append(
            {
                "plan_template_id": tid,
                "title": (tpl.title if tpl is not None else tid),
                "reason": "compound_request_deferred",
                "score": str(score),
            }
        )
    return out


async def llm_pick_template_id(
    llama: LlamaService,
    *,
    model: str,
    user_excerpt: str,
    catalog: PlanCatalog,
    max_tokens: int = 128,
    defaults: dict[str, Any] | None = None,
) -> tuple[str | None, float]:
    """Returns (template_id or None, confidence 0..1)."""
    lines = [f"- `{e.id}`: {catalog.templates_by_id[e.id].title}" for e in catalog.manifest.templates]
    catalog_lines = "\n".join(lines)
    system = (
        "Ты классификатор. По запросу пользователя выбери один template_id из списка. "
        'Ответ — JSON-объект {"template_id":"...","confidence":0.0-1.0} '
        "(сервер llama.cpp ограничивает синтаксис JSON)."
    )
    user = f"Список шаблонов:\n{catalog_lines}\n\nЗапрос пользователя:\n{(user_excerpt or '').strip()[:8000]}"
    msgs = [{"role": "system", "content": system}, {"role": "user", "content": user}]
    try:
        data = await desktop_llm_json_object(
            msgs,
            model=model,
            defaults=defaults or {},
            max_tokens=max_tokens,
            temperature=0.1,
        )
    except Exception as ex:
        logger.warning("ensemble blueprint LLM picker failed: %s", ex)
        return None, 0.0

    resp = {"text": json.dumps(data, ensure_ascii=False) if data else ""}
    await ensemble_audit_log.log_llm_chat(
        "blueprint_template_pick",
        messages=msgs,
        model=model,
        max_tokens=max_tokens,
        temperature=0.1,
        response=resp,
    )

    if not data:
        return None, 0.0
    tid = data.get("template_id")
    if not isinstance(tid, str) or not tid.strip():
        return None, 0.0
    tid = tid.strip()
    if tid not in catalog.templates_by_id:
        return None, 0.0
    conf_raw = data.get("confidence", 0.5)
    try:
        conf = float(conf_raw)
    except (TypeError, ValueError):  # fmt: skip
        conf = 0.5
    conf = max(0.0, min(1.0, conf))
    return tid, conf


async def pick_template_for_turn(
    *,
    llama: LlamaService | None,
    model: str,
    user_excerpt: str,
    catalog: PlanCatalog,
    defaults: dict[str, Any],
    forced_template_id: str | None = None,
    use_web_search: bool = False,
    suppress_research_plan_heuristic: bool = False,
) -> str:
    forced = str(forced_template_id or "").strip()
    if forced:
        if forced in catalog.templates_by_id:
            logger.info(
                "[STEP] ensemble_plan_template template_picked id=%s source=forced",
                forced,
            )
            return forced
        logger.warning(
            "[STEP] ensemble_plan_template forced_template_missing id=%s",
            forced,
        )
    heur_id, score = heuristic_pick_template_id(
        user_excerpt,
        catalog,
        use_web_search=use_web_search,
        suppress_research_plan_heuristic=suppress_research_plan_heuristic,
    )
    use_llm = bool(defaults.get("ensemble_blueprint_llm_picker_enabled") is True)
    min_heur = int(defaults.get("ensemble_blueprint_llm_picker_min_keywords") or 1)
    if llama is not None and (score <= 0 or (use_llm and score < min_heur)):
        tid, conf = await llm_pick_template_id(
            llama,
            model=model,
            user_excerpt=user_excerpt,
            catalog=catalog,
            max_tokens=int(defaults.get("ensemble_blueprint_llm_picker_max_tokens") or 128),
            defaults=defaults,
        )
        min_confidence = float(defaults.get("ensemble_blueprint_llm_picker_min_confidence") or 0.35)
        if tid and conf >= min_confidence:
            logger.info(
                "[STEP] ensemble_plan_template template_picked id=%s source=llm confidence=%s",
                tid,
                conf,
            )
            return tid
        if score <= 0:
            logger.info(
                "[STEP] ensemble_plan_template no_template_match score=%s llm_confidence=%s min=%s",
                score,
                conf,
                min_confidence,
            )
            return ""
    if heur_id:
        logger.info(
            "[STEP] ensemble_plan_template template_picked id=%s source=heuristic score=%s",
            heur_id,
            score,
        )
    return heur_id
