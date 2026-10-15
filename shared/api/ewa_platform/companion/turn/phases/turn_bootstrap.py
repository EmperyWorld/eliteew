# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Shared companion turn bootstrap: trust pre-turn, profile/history, affective route, orchestration entry.
# Invariants:
# - Sync and SSE call one bootstrap helper before defer/terminal/main LLM branches.
# - ``emit_transform_sse`` is meaningful on SSE channel only; sync callers ignore it.
# - ``surface=esp_display`` skips intent planner and task orchestration.
# Related:
# - api/ewa_platform/companion/sidecar/trust_turn.py
# - documentation/product/ewa/EWA-COMPANION-CHAT-TURN-PHASES.md
# - documentation/product/ewa/EWA-ESP-DISPLAY-AI.md
# ---

from __future__ import annotations

import logging
import os
from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any, Literal

import asyncpg
import httpx

from api.core.auth import User
from api.ewa_platform.companion.affective.affective_router import affective_route
from api.ewa_platform.companion.contracts import CompanionIntentPlan
from api.ewa_platform.companion.orchestration.task_orchestrator import maybe_handle_companion_task_orchestration
from api.ewa_platform.companion.server_first.v2 import server_first_v2_branch_enabled_for_turn
from api.ewa_platform.companion.sidecar.arlika_quarrel import is_arlika_v1_quarrel_turn
from api.ewa_platform.companion.sidecar.arlika_v2_chat_switch import try_apply_arlika_v2_chat_mode_switch
from api.ewa_platform.companion.sidecar.intent_planner import (
    companion_intent_planner_enabled,
    companion_intent_planner_http_runtime,
    run_companion_intent_planner,
)
from api.ewa_platform.companion.sidecar.llm_bandwidth import (
    ARLIKA_SEED as _ARLIKA_SEED,
)
from api.ewa_platform.companion.sidecar.llm_bandwidth import (
    companion_arlika_v1_hostile as _companion_arlika_v1_hostile,
)
from api.ewa_platform.companion.sidecar.trust_turn import (
    CompanionTrustClassifySignals,
    ewa_companion_trust_pre_turn,
)
from api.ewa_platform.companion.turn.phases.visible_reply import looks_cyrillic, truncate_text
from api.ewa_platform.companion.turn.vision_attachment import companion_stored_user_line_for_turn
from api.ewa_platform.schemas.pydantic.companion_execution_report import CompanionExecutionReportV1

logger = logging.getLogger(__name__)

_CHAT_NS = "desktop_friend_chat_v1"
_MAX_STORED_MESSAGES = 240
_MAX_MESSAGE_CHARS = 8000


def _env_truthy(raw: str | None) -> bool:
    return (raw or "").strip().lower() in ("1", "true", "yes", "on")


@dataclass(frozen=True, slots=True)
class CompanionTurnBootstrapResult:
    """Profile + transcript + trust/orchestration state after shared pre-LLM bootstrap."""

    profile: dict[str, Any]
    lp: dict[str, Any]
    history: list[dict[str, str]]
    transformed_this_turn: bool
    transform_event_kind: str | None
    emit_transform_sse: bool
    trust_signals: CompanionTrustClassifySignals
    companion_turn_routing_for_ambient: Any
    intent_plan: CompanionIntentPlan | None
    orchestrated: Mapping[str, Any] | None
    execution_reports: list[CompanionExecutionReportV1]
    arlika_quarrel_turn: bool
    arlika_hostile: bool
    skip_heavy_steps: bool


def normalize_companion_chat_history(raw: Any) -> list[dict[str, str]]:
    if not isinstance(raw, list):
        return []
    out: list[dict[str, str]] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        role = item.get("role")
        content = item.get("content")
        if role not in ("user", "assistant") or not isinstance(content, str):
            continue
        out.append({"role": role, "content": truncate_text(content, _MAX_MESSAGE_CHARS)})
    return out[-_MAX_STORED_MESSAGES:]


async def fetch_companion_intent_plan(
    user_line: str,
    shell_norm: Mapping[str, Any] | None,
) -> CompanionIntentPlan | None:
    """Optional pre-pass: classify user line for task orchestration; ``None`` on skip or LLM failure."""

    if not companion_intent_planner_enabled():
        return None
    from api.ewa_platform.companion.plans.intent import user_line_requests_plan

    if user_line_requests_plan(user_line):
        logger.info("[STEP] companion_intent_planner_skipped reason=plan_regex")
        return None
    base, _planner_model_name = companion_intent_planner_http_runtime()
    if not base:
        return None
    try:
        t_out = float(os.getenv("EWA_COMPANION_INTENT_TIMEOUT_SEC", "45").strip() or "45")
    except ValueError:
        t_out = 45.0
    client_timeout = max(15.0, min(t_out + 5.0, 125.0))
    async with httpx.AsyncClient(timeout=httpx.Timeout(client_timeout)) as pc:
        return await run_companion_intent_planner(
            pc,
            base_url=base,
            user_line=user_line,
            shell_norm=shell_norm,
            russian_user=looks_cyrillic(user_line),
        )


async def companion_recent_episode_snippets(
    pool: asyncpg.Pool, principal_id: str, *, limit: int = 6
) -> tuple[str, ...]:
    """Short bodies from recent Postgres episodes for ``affective_route`` episodic shading."""

    try:
        from api.ewa_platform.persistence_pg.episodes_asyncpg import episodes_recent_for_principal

        rows = await episodes_recent_for_principal(pool, principal_id=principal_id, limit=max(1, min(limit, 20)))
    except Exception as exc:  # noqa: BLE001
        logger.warning(
            "[STEP] companion_recent_episode_snippets_failed principal=%s err=%s",
            principal_id,
            exc,
        )
        return ()
    snippets: list[str] = []
    for r in rows:
        body = str(r.get("body") or "").strip()
        if body:
            snippets.append(body[:400])
    return tuple(snippets)


def skip_heavy_companion_steps_for_turn(*, user_line: str, persona_seed: str) -> bool:
    """True when hostile Arlika should bypass expensive embedding-backed steps."""

    seed = str(persona_seed or "").strip()
    if seed != _ARLIKA_SEED:
        return False
    if not str(user_line or "").strip():
        return False
    return not _env_truthy(os.getenv("EWA_COMPANION_ARLIKA_HEAVY_STEPS"))


def resolve_arlika_quarrel_turn(
    profile: Mapping[str, Any],
    user_line: str,
    trust_signals: CompanionTrustClassifySignals,
) -> bool:
    """True when Arlika v1 must refuse tasks and spar on this turn."""

    if not _companion_arlika_v1_hostile(profile):
        return False
    return is_arlika_v1_quarrel_turn(
        user_line,
        wrath_classified_quarrel=trust_signals.argumentative_quarrel,
    )


async def bootstrap_companion_turn_context(
    pool: asyncpg.Pool,
    client: httpx.AsyncClient,
    *,
    principal_id: str,
    profile: Mapping[str, Any],
    user_line: str,
    shell_norm: Mapping[str, Any] | None,
    base_url: str,
    classify_model: str,
    timeout: httpx.Timeout,
    content_catalog_user_id: str | None,
    oauth2_sub_for_content_alternate: str | None,
    bearer_token: str | None,
    auth_user: User,
    image_attachment: Mapping[str, Any] | None,
    vision_data_url: str | None,
    has_image_attachment: bool = False,
    telemetry_channel: Literal["sync", "stream"] = "sync",
    surface: str | None = None,
) -> CompanionTurnBootstrapResult:
    """Trust pre-turn, history append, affective route, and task orchestration entry (sync + SSE)."""

    stream = telemetry_channel == "stream"
    stream_suffix = "_stream" if stream else ""
    esp_display_surface = (surface or "").strip().lower() == "esp_display"

    (
        profile_out,
        transformed_this_turn,
        emit_transform_sse,
        transform_event_kind,
        trust_signals,
    ) = await ewa_companion_trust_pre_turn(
        pool,
        client,
        principal_id=principal_id,
        profile=dict(profile),
        user_line=user_line,
        base_url=base_url,
        classify_model=classify_model,
        timeout=timeout,
    )

    if not transformed_this_turn:
        profile_out, switched, skind = await try_apply_arlika_v2_chat_mode_switch(
            pool,
            principal_id=principal_id,
            profile=profile_out,
            user_line=user_line,
        )
        if switched:
            transformed_this_turn = True
            transform_event_kind = skind
            if stream:
                emit_transform_sse = True

    lp_raw = profile_out.get("learned_preferences")
    lp = dict(lp_raw) if isinstance(lp_raw, Mapping) else {}

    chat_blob = lp.get(_CHAT_NS)
    chat_obj: dict[str, Any] = dict(chat_blob) if isinstance(chat_blob, Mapping) else {}
    history = normalize_companion_chat_history(chat_obj.get("messages"))
    history.append(
        {
            "role": "user",
            "content": companion_stored_user_line_for_turn(
                user_line,
                has_image=has_image_attachment,
            ),
        }
    )

    episodic_snip = await companion_recent_episode_snippets(pool, principal_id)
    companion_turn_routing_for_ambient = affective_route(
        user_text=user_line,
        persona_seed_id=str(profile_out.get("seed_persona_id") or "parent"),
        trust_delta=trust_signals.trust_delta,
        abuse_at_peak=trust_signals.abuse_at_peak,
        recent_episode_snippets=episodic_snip,
    )
    logger.info(
        "[STEP] companion_affective_route%s principal=%s mood=%s conf=%s r=%s",
        stream_suffix,
        principal_id,
        getattr(companion_turn_routing_for_ambient, "mood", "?"),
        getattr(companion_turn_routing_for_ambient, "confidence", 0.0),
        getattr(companion_turn_routing_for_ambient, "rationale", ""),
    )

    if esp_display_surface:
        intent_plan = None
        logger.info(
            "[STEP] companion_intent_planner_skipped%s principal=%s reason=esp_display_surface",
            stream_suffix,
            principal_id,
        )
    else:
        intent_plan = await fetch_companion_intent_plan(user_line, shell_norm)
    server_first_v2_on = server_first_v2_branch_enabled_for_turn(lp, content_catalog_user_id=content_catalog_user_id)
    execution_reports: list[CompanionExecutionReportV1] = []
    arlika_quarrel_turn = resolve_arlika_quarrel_turn(profile_out, user_line, trust_signals)
    if esp_display_surface:
        logger.info(
            "[STEP] companion_orchestration_skipped%s principal=%s reason=esp_display_surface",
            stream_suffix,
            principal_id,
        )
        orchestrated = None
    elif arlika_quarrel_turn:
        logger.info(
            "[STEP] companion_orchestration_skipped%s principal=%s reason=arlika_quarrel",
            stream_suffix,
            principal_id,
        )
        orchestrated = None
    elif has_image_attachment:
        logger.info(
            "[STEP] companion_orchestration_skipped%s principal=%s reason=vision_attachment",
            stream_suffix,
            principal_id,
        )
        orchestrated = None
    else:
        orchestrated = await maybe_handle_companion_task_orchestration(
            pool,
            principal_id=principal_id,
            user_line=user_line,
            shell_norm=shell_norm,
            content_catalog_user_id=content_catalog_user_id,
            oauth2_sub_for_content_alternate=oauth2_sub_for_content_alternate,
            intent_plan=intent_plan,
            server_first_v2_enabled=server_first_v2_on,
            bearer_token=bearer_token,
            auth_user=auth_user,
            profile=profile_out,
            image_attachment=image_attachment,
            execution_reports=execution_reports,
        )

    persona_seed = str(profile_out.get("seed_persona_id") or "parent")
    return CompanionTurnBootstrapResult(
        profile=profile_out,
        lp=lp,
        history=history,
        transformed_this_turn=transformed_this_turn,
        transform_event_kind=transform_event_kind,
        emit_transform_sse=emit_transform_sse,
        trust_signals=trust_signals,
        companion_turn_routing_for_ambient=companion_turn_routing_for_ambient,
        intent_plan=intent_plan,
        orchestrated=orchestrated,
        execution_reports=execution_reports,
        arlika_quarrel_turn=arlika_quarrel_turn,
        arlika_hostile=_companion_arlika_v1_hostile(profile_out),
        skip_heavy_steps=skip_heavy_companion_steps_for_turn(user_line=user_line, persona_seed=persona_seed),
    )


__all__ = (
    "CompanionTurnBootstrapResult",
    "bootstrap_companion_turn_context",
    "companion_recent_episode_snippets",
    "fetch_companion_intent_plan",
    "normalize_companion_chat_history",
    "resolve_arlika_quarrel_turn",
    "skip_heavy_companion_steps_for_turn",
)
