# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Ensemble blueprint vs legacy routing: heuristics, optional LLM classifier, semi confirm helpers.
# Invariants:
# - Heuristic dictionaries resolve from versioned canonical data plus additive admin extras.
# - Explicit per-member registries route to the specialized sequential council, not a generic blueprint.
# Related:
# - api/services/desktop_chat_ensemble/route_heuristics.py
# - documentation/product/DESKTOP-LLAMA-CHAT.md
# ---

"""Ensemble: blueprint (шаблонный документ) vs legacy freeform (диалог в чате).

Гибрид: жёсткие эвристики без LLM; в «серой зоне» — короткий классификатор Llama."""

from __future__ import annotations

import json
import logging
import re
from typing import Any, Literal

from api.models.desktop_ai_chat import DesktopAiChatMessage
from api.services.desktop_chat.llm.json_sidecar import desktop_llm_json_object
from api.services.desktop_chat_ensemble import ensemble_audit_log
from api.services.desktop_chat_ensemble.archive.legacy_freeform.orchestrator import (
    user_human_support_request,
    user_requests_per_member_registry_list,
)
from api.services.desktop_chat_ensemble.route_heuristics import (
    EnsembleRouteHeuristics,
    resolve_ensemble_route_heuristics,
)
from api.services.llama_service import LlamaService

logger = logging.getLogger(__name__)

RoutePhase = Literal["blueprint", "legacy", "uncertain"]


def user_requests_30_60_90_day_plan(user_text: str) -> bool:
    """Запрос плана по фазам 30/60/90 дней (часто follow-up к совместному документу)."""
    t = (user_text or "").strip().casefold()
    if not t:
        return False
    compact = re.sub(r"\s+", "", t)
    if "30/60/90" in compact or "306090" in compact:
        return True
    if "30" in t and "60" in t and "90" in t:
        if len(t) <= 160:
            return True
        if any(k in t for k in ("день", "дней", "план", "модель", "сделай", "сделайте", "дайте")):
            return True
    return False


_CODE_ARCHITECTURE_AUDIT_ANCHORS: tuple[str, ...] = (
    "code architecture audit",
    "аудит архитектуры кода",
    "архитектурный каркас",
    "сверка с кодом",
    "inventory before invent",
    "workflowruntimekind",
    "execution path",
    "dual runtime",
    "двухуровнев",
    "domain lock",
    "fidelity scorecard",
    "companion vs ensemble",
    "task_run vs ensemble",
)
_CODE_ARCHITECTURE_AUDIT_SUPPORT: tuple[str, ...] = (
    "keep/change/kill",
    "keep change kill",
    "exists partial missing",
    "не изобретать уже",
    "already done",
    "уже реализован",
    "stable path",
    "experimental path",
)


def user_requests_code_architecture_audit(user_text: str) -> bool:
    """Code-grounded architecture audit (inventory before invent), not greenfield PRD/tech_plan."""
    t = (user_text or "").strip().casefold()
    if not t:
        return False
    anchors = sum(1 for needle in _CODE_ARCHITECTURE_AUDIT_ANCHORS if needle in t)
    support = sum(1 for needle in _CODE_ARCHITECTURE_AUDIT_SUPPORT if needle in t)
    if anchors >= 2:
        return True
    if anchors >= 1 and (anchors + support) >= 2:
        return True
    if "архитектурн" in t and any(
        x in t
        for x in (
            "сверк",
            "коде",
            "код ",
            "inventory",
            "execution path",
            "workflowruntime",
            "exists",
            "уже есть",
            "уже реализован",
        )
    ):
        return True
    return "execution path" in t and any(
        x in t for x in ("stable path", "experimental path", "sidecar", "task_run", "companion")
    )


def _is_brief_acknowledgement(user_text: str, heuristics: EnsembleRouteHeuristics) -> bool:
    t = (user_text or "").strip().casefold()
    if not t or len(t) > 80:
        return False
    return any(
        t == x or t.startswith(f"{x} ") or t.startswith(f"{x}.") or t.startswith(f"{x},") or t.startswith(f"{x}…")
        for x in heuristics.brief_acknowledgements
    )


def _has_artifact_deliverable_signal(
    user_text: str,
    heuristics: EnsembleRouteHeuristics,
) -> bool:
    """Detect requested output form before generic short-message fallback."""
    folded = (user_text or "").strip().casefold()
    return bool(folded and any(hint in folded for hint in heuristics.all_blueprint_needles))


def _last_assistant_message(history: list[DesktopAiChatMessage]) -> DesktopAiChatMessage | None:
    for m in reversed(history):
        if m.role == "assistant":
            return m
    return None


def _assistant_is_joint_artifact(msg: DesktopAiChatMessage | None) -> bool:
    if msg is None:
        return False
    meta = getattr(msg, "message_metadata", None)
    if not isinstance(meta, dict):
        return False
    return bool(meta.get("desktop_ensemble_joint") or meta.get("desktop_ensemble_blueprint"))


def _looks_like_joint_artifact_followup(
    *,
    user_text: str,
    history: list[DesktopAiChatMessage] | None,
    heuristics: EnsembleRouteHeuristics,
) -> bool:
    if not history:
        return False
    if _is_brief_acknowledgement(user_text, heuristics):
        return False
    last_asst = _last_assistant_message(history)
    if not _assistant_is_joint_artifact(last_asst):
        return False
    t = (user_text or "").strip().casefold()
    if not t:
        return False
    if any(x in t for x in heuristics.joint_followup_edit_needles):
        return True
    if user_requests_30_60_90_day_plan(user_text):
        return True
    return any(x in t for x in heuristics.joint_followup_topic_needles)


def heuristic_ensemble_route_phase(
    *,
    user_text: str,
    defaults: dict[str, Any],
    history: list[DesktopAiChatMessage] | None = None,
    use_web_search: bool = False,
) -> RoutePhase:
    """Быстрая фаза: план, диалог или неочевидно (нужен LLM)."""
    from api.services.desktop_chat_ensemble.actions.gate import user_requests_explicit_verify

    heuristics = resolve_ensemble_route_heuristics(defaults)
    if defaults.get("ensemble_blueprint_conversational_fallback") is False:
        return "blueprint"
    t = (user_text or "").strip()
    if not t:
        return "blueprint"
    if _is_brief_acknowledgement(t, heuristics):
        # Pure ack («ок»/«да») stays legacy even if web is armed — not a research turn.
        return "legacy"
    if user_human_support_request(t):
        return "legacy"
    # The legacy council owns the structured per-member registry protocol: one
    # speech call plus one JSON document contribution per participant.
    if user_requests_per_member_registry_list(t):
        return "legacy"
    if _looks_like_joint_artifact_followup(user_text=t, history=history, heuristics=heuristics):
        return "blueprint"
    low = t.casefold()
    if user_requests_30_60_90_day_plan(t):
        return "blueprint"
    if user_requests_explicit_verify(t):
        # Explicit web/docs verify must not die in legacy freeform (no Wave 2 packs).
        return "blueprint"
    if _has_artifact_deliverable_signal(low, heuristics):
        return "blueprint"
    if len(t) > 2200:
        return "blueprint"
    if t.count("\n") >= 10 and len(t) > 700:
        return "blueprint"
    if len(t) <= 220 and t.count("\n") <= 1:
        if use_web_search:
            # Armed web search: short turns stay out of hard legacy so packs can run.
            return "uncertain"
        return "legacy"
    return "uncertain"


def build_classifier_history_tail(
    history: list[DesktopAiChatMessage],
    *,
    max_messages: int = 8,
    max_chars: int = 1200,
) -> str:
    lines: list[str] = []
    for m in history[-max_messages:]:
        role = m.role
        if role == "user":
            snippet = (m.content or "").strip().replace("\n", " ")[:400]
            if snippet:
                lines.append(f"Пользователь: {snippet}")
        elif role == "assistant":
            body0 = (m.content or "").strip().replace("\n", " ")
            preview = body0[:320]
            if len(body0) > 320:
                preview += "…"
            if preview:
                lines.append(f"Ассистент: {preview}")
    text = "\n".join(lines)
    if len(text) > max_chars:
        return text[-max_chars:]
    return text


async def llm_classify_blueprint_intent(
    llama: LlamaService,
    *,
    model: str,
    user_text: str,
    history_tail: str,
    defaults: dict[str, Any],
) -> tuple[bool, float, str]:
    """
    Возвращает (use_blueprint, confidence, raw_intent_or_note).

    При ошибке или низкой уверенности — (False, 0.0, reason): безопасный диалог.
    """
    raw_max = defaults.get("ensemble_route_llm_max_tokens")
    try:
        max_tokens = int(raw_max) if raw_max is not None and raw_max != "" else 128
    except (TypeError, ValueError):  # fmt: skip
        max_tokens = 128
    max_tokens = max(32, min(max_tokens, 256))

    raw_min = defaults.get("ensemble_route_llm_min_confidence")
    try:
        min_conf = float(raw_min) if raw_min is not None and raw_min != "" else 0.42
    except (TypeError, ValueError):  # fmt: skip
        min_conf = 0.42
    min_conf = max(0.0, min(min_conf, 1.0))

    raw_timeout = defaults.get("ensemble_route_llm_timeout_sec")
    try:
        timeout_sec = float(raw_timeout) if raw_timeout is not None and raw_timeout != "" else 45.0
    except (TypeError, ValueError):  # fmt: skip
        timeout_sec = 45.0

    system = (
        "Ты классификатор намерения для группового чата с несколькими ИИ-персонажами.\n"
        "Нужно выбрать один класс:\n"
        "- document — пользователю нужен структурированный многошаговый артефакт: техплан, бриф, "
        "ТЗ, дорожная карта, бизнес-план, go-to-market, финансовая модель, единый документ с разделами для команды и т.п.\n"
        "- chat — обычный диалог: вопрос, мнение персонажей, короткое обсуждение, уточнение без "
        "требования готового формального плана/брифа.\n"
        "Учитывай краткую историю и последнее сообщение.\n"
        'Ответ — JSON-объект: {"intent":"document"|"chat","confidence":0.0-1.0} '
        "(сервер llama.cpp ограничивает синтаксис JSON)."
    )
    hist_block = history_tail.strip() or "(нет истории)"
    user_block = (
        f"Краткая история:\n{hist_block}\n\nПоследнее сообщение пользователя:\n{(user_text or '').strip()[:6000]}"
    )
    msgs = [{"role": "system", "content": system}, {"role": "user", "content": user_block}]
    try:
        data = await desktop_llm_json_object(
            msgs,
            model=model,
            defaults=defaults,
            max_tokens=max_tokens,
            temperature=0.05,
            timeout=timeout_sec,
        )
    except Exception as ex:
        logger.warning("ensemble_route LLM classifier failed: %s", ex)
        return False, 0.0, "llm_error"

    resp = {"text": json.dumps(data, ensure_ascii=False) if data else ""}
    await ensemble_audit_log.log_llm_chat(
        "ensemble_route_intent",
        messages=msgs,
        model=model,
        max_tokens=max_tokens,
        temperature=0.05,
        response=resp,
        extra={"request_timeout_sec": timeout_sec},
    )

    if not data:
        return False, 0.0, "unparsed"

    intent_raw = data.get("intent")
    intent = str(intent_raw or "").strip().casefold()
    doc_like = intent in ("document", "artifact", "plan", "blueprint", "doc", "structured")
    chat_like = intent in ("chat", "dialog", "conversation", "talk", "discussion")

    conf_raw = data.get("confidence", 0.5)
    try:
        conf = float(conf_raw)
    except (TypeError, ValueError):  # fmt: skip
        conf = 0.5
    conf = max(0.0, min(1.0, conf))

    if conf < min_conf:
        logger.info(
            "ensemble_route LLM low_confidence intent=%s conf=%s min=%s",
            intent,
            conf,
            min_conf,
        )
        return False, conf, intent or "low_conf"

    if doc_like and not chat_like:
        return True, conf, intent
    if chat_like and not doc_like:
        return False, conf, intent

    logger.info("ensemble_route LLM ambiguous intent=%s conf=%s", intent, conf)
    return False, conf, intent or "ambiguous"


def should_run_blueprint_document_flow(
    *,
    user_text: str,
    defaults: dict[str, Any],
    use_web_search: bool = False,
) -> bool:
    """
    Синхронная оценка только эвристикой (без LLM). Для фазы ``uncertain`` возвращает False.

    Полное решение с LLM — см. ``resolve_auto_blueprint_vs_legacy``.
    """
    if defaults.get("ensemble_blueprint_conversational_fallback") is False:
        return True
    phase = heuristic_ensemble_route_phase(
        user_text=user_text,
        defaults=defaults,
        use_web_search=use_web_search,
    )
    if phase == "blueprint":
        return True
    if phase == "legacy":
        return False
    return False


async def resolve_auto_blueprint_vs_legacy(
    *,
    user_text: str,
    history: list[DesktopAiChatMessage],
    defaults: dict[str, Any],
    model: str,
    use_web_search: bool = False,
) -> tuple[bool, str]:
    """
    Полное авто-решение при движке blueprint: эвристика + при ``uncertain`` LLM (создаёт свой LlamaService).

    Возвращает (use_blueprint, route_note).
    """
    if defaults.get("ensemble_blueprint_conversational_fallback") is False:
        return True, "fallback_disabled"

    heuristics = resolve_ensemble_route_heuristics(defaults)
    if heuristics.extras_applied:
        logger.info(
            "[METRIC] desktop_ai_chat ensemble_route_heuristics version=%s extras_applied=true",
            heuristics.version,
        )

    phase = heuristic_ensemble_route_phase(
        user_text=user_text,
        defaults=defaults,
        history=history,
        use_web_search=use_web_search,
    )
    if phase == "blueprint":
        return True, "heuristic_blueprint"
    if phase == "legacy":
        return False, "heuristic_legacy"
    if defaults.get("ensemble_route_llm_enabled", True) is False:
        return False, "uncertain_no_llm"

    llama = LlamaService()
    async with llama:
        use_bp, conf, intent = await llm_classify_blueprint_intent(
            llama,
            model=model,
            user_text=user_text,
            history_tail=build_classifier_history_tail(history),
            defaults=defaults,
        )
    note = f"llm intent={intent} conf={conf:.2f}"
    if use_bp:
        if note.startswith("llm"):
            logger.info("[STEP] desktop_ai_chat ensemble_route -> blueprint (auto) %s", note)
        return True, note
    logger.info(
        "[STEP] desktop_ai_chat ensemble_route blueprint_engine -> legacy_freeform (auto) %s",
        note,
    )
    return False, note


def last_user_message(history: list[DesktopAiChatMessage]) -> DesktopAiChatMessage | None:
    for m in reversed(history):
        if m.role == "user":
            return m
    return None


def user_message_doc_confirm_state(msg: DesktopAiChatMessage | None) -> str | None:
    if msg is None:
        return None
    meta = getattr(msg, "message_metadata", None)
    if not isinstance(meta, dict):
        return None
    raw = meta.get("ensemble_doc_confirm")
    if isinstance(raw, str) and raw.strip():
        return raw.strip()
    return None
