# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Desktop orchestration loop: observation in → optional domain hints → LLM/heuristic intent merge → policy → desktop execution.
# Merges a JSON-safe session snapshot via ``OrchestrationSessionRepository`` each turn. Optional ``companion_wire``
# truncates persisted companion JSON for the orchestration HTTP LLM only; optional ``companion_context_event`` is
# appended to the session journal (see ``DESKTOP-ORCHESTRATION.md``).
# Invariants:
# - No direct HTTP/SQL; use ports on ``OrchestrationContext`` only.
# Related:
# - api/ewa_platform/core/orchestration_context.py
# - api/ewa_platform/contracts/policy_context.py
# - api/ewa_platform/contracts/domain_hints_wire.py
# - api/ewa_platform/io/domain_hints.py
# - api/ewa_platform/llm/intent_proposal.py
# - shared/api/ewa_platform/desktop/runtime.py (loads ``companion_profile_llm_wire`` when PG pool + row exist)
# ---
"""Desktop orchestrator."""

from __future__ import annotations

import asyncio
import logging
import time
from collections.abc import Awaitable, Callable, Mapping
from typing import Any

from api.ewa_platform.contracts.desktop_observation import DesktopObservationKind
from api.ewa_platform.contracts.domain_hints_wire import (
    normalize_content_manager_hint_wire,
    normalize_documents_workspace_hint_wire,
)
from api.ewa_platform.contracts.orchestration import (
    OrchestrationSessionBranch,
    OrchestrationSessionSnapshotKey,
)
from api.ewa_platform.contracts.policy_context import PolicyContext
from api.ewa_platform.core.orchestration_context import OrchestrationContext
from api.ewa_platform.llm.intent_proposal import (
    ORCHESTRATION_LLM_PROMPT_KEY,
    parse_desktop_intent_from_llm_completion,
)

_SK_TURNS = OrchestrationSessionSnapshotKey.TURNS
_SK_LAST_BRANCH = OrchestrationSessionSnapshotKey.LAST_BRANCH
_SK_LAST_OBSERVATION = OrchestrationSessionSnapshotKey.LAST_OBSERVATION_KIND
_SK_LAST_INTENT = OrchestrationSessionSnapshotKey.LAST_INTENT_KIND

_BRANCH_NO_INTENT = OrchestrationSessionBranch.NO_INTENT
_BRANCH_POLICY_DENIED = OrchestrationSessionBranch.POLICY_DENIED
_BRANCH_INTENT_EXECUTED = OrchestrationSessionBranch.INTENT_EXECUTED

logger = logging.getLogger(__name__)


def _proposed_intent_from_observation(observation: Mapping[str, Any]) -> dict[str, Any] | None:
    """Derive a minimal follow-up intent from a wire observation dict; ``None`` means no-op."""

    kind = observation.get("observation_kind")
    if kind == DesktopObservationKind.USER_CANCELLED.value:
        return None
    if kind == DesktopObservationKind.ACTIVE_APP_CHANGED.value:
        wid = observation.get("window_id")
        if isinstance(wid, str) and wid:
            return {
                "intent_kind": "focus_window",
                "window_id": wid,
            }
        return None
    return None


async def _collect_optional_domain_hints(ctx: OrchestrationContext) -> dict[str, Any]:
    """Snapshot optional domain drivers for orchestration telemetry (skipped ports omitted).

    Optional domain hints are best-effort: a broken self-HTTP edge must degrade the ``domain_hints`` event, not abort
    the user's desktop turn.
    """

    hints: dict[str, Any] = {}
    tasks: list[Awaitable[tuple[str, Any]]] = []

    async def _collect(
        key: str,
        read: Awaitable[Mapping[str, Any]],
        normalize: Callable[[Mapping[str, Any]], Mapping[str, Any]] | None = None,
    ) -> tuple[str, Any]:
        try:
            raw = await read
            return key, dict(normalize(raw) if normalize is not None else raw)
        except Exception as exc:  # noqa: BLE001 - optional telemetry must not fail the turn.
            return key, {
                "ok": False,
                "source": "domain_hint_exception",
                "error": type(exc).__name__,
            }

    if ctx.ugs is not None:
        tasks.append(_collect("ugs", ctx.ugs.read_configuration_hint()))
    if ctx.documents is not None:
        tasks.append(
            _collect(
                "documents",
                ctx.documents.describe_open_documents_hint(),
                normalize_documents_workspace_hint_wire,
            )
        )
    if ctx.content is not None:
        tasks.append(
            _collect(
                "content",
                ctx.content.list_entity_roots_hint(),
                normalize_content_manager_hint_wire,
            )
        )
    if not tasks:
        return hints
    for key, value in await asyncio.gather(*tasks):
        hints[key] = value
    return hints


class DesktopOrchestrator:
    """Coordinates one orchestration session using injected ports."""

    async def on_observation(
        self,
        ctx: OrchestrationContext,
        *,
        session_id: str,
        observation: Mapping[str, Any],
        policy_context: PolicyContext,
        companion_wire: Mapping[str, Any] | None = None,
        companion_context_event: Mapping[str, Any] | None = None,
    ) -> None:
        """Append observation, optionally run policy-gated desktop intent, persist session snapshot."""

        started = time.perf_counter()
        hints_ms = 0
        llm_ms = 0
        execute_ms = 0
        snapshot: dict[str, Any] = dict(await ctx.sessions.get(session_id) or {})
        snapshot[_SK_TURNS] = int(snapshot.get(_SK_TURNS, 0)) + 1
        snapshot[_SK_LAST_OBSERVATION] = observation.get("observation_kind")

        await ctx.events.append(session_id, {"kind": "observation", "payload": dict(observation)})
        if isinstance(companion_context_event, Mapping) and companion_context_event:
            await ctx.events.append(session_id, dict(companion_context_event))
        t0 = time.perf_counter()
        hints = await _collect_optional_domain_hints(ctx)
        hints_ms = round((time.perf_counter() - t0) * 1000)
        if hints:
            await ctx.events.append(session_id, {"kind": "domain_hints", "hints": hints})

        heuristic = _proposed_intent_from_observation(observation)
        t0 = time.perf_counter()
        llm_text = await ctx.llm.complete(
            ORCHESTRATION_LLM_PROMPT_KEY,
            variables={
                "observation": dict(observation),
                "heuristic_intent": heuristic,
                "domain_hints": hints or None,
                **(
                    {"companion_wire": dict(companion_wire)}
                    if isinstance(companion_wire, Mapping) and companion_wire
                    else {}
                ),
            },
        )
        llm_ms = round((time.perf_counter() - t0) * 1000)
        llm_intent = parse_desktop_intent_from_llm_completion(llm_text)
        proposed = llm_intent if llm_intent is not None else heuristic

        if proposed is None:
            snapshot[_SK_LAST_BRANCH] = _BRANCH_NO_INTENT
            await ctx.sessions.save(session_id, snapshot)
            self._log_turn_timing(
                session_id=session_id,
                branch=_BRANCH_NO_INTENT.value,
                hints_ms=hints_ms,
                llm_ms=llm_ms,
                execute_ms=execute_ms,
                started=started,
            )
            return
        if not ctx.policy.evaluate(policy_context, proposed):
            await ctx.events.append(session_id, {"kind": "policy_denied", "intent": proposed})
            snapshot[_SK_LAST_BRANCH] = _BRANCH_POLICY_DENIED
            await ctx.sessions.save(session_id, snapshot)
            self._log_turn_timing(
                session_id=session_id,
                branch=_BRANCH_POLICY_DENIED.value,
                hints_ms=hints_ms,
                llm_ms=llm_ms,
                execute_ms=execute_ms,
                started=started,
            )
            return

        t0 = time.perf_counter()
        result = await ctx.desktop.execute_intent(proposed)
        execute_ms = round((time.perf_counter() - t0) * 1000)
        await ctx.events.append(
            session_id,
            {"kind": "intent_result", "intent": proposed, "result": dict(result)},
        )
        snapshot[_SK_LAST_BRANCH] = _BRANCH_INTENT_EXECUTED
        snapshot[_SK_LAST_INTENT] = proposed.get("intent_kind")
        await ctx.sessions.save(session_id, snapshot)
        self._log_turn_timing(
            session_id=session_id,
            branch=_BRANCH_INTENT_EXECUTED.value,
            hints_ms=hints_ms,
            llm_ms=llm_ms,
            execute_ms=execute_ms,
            started=started,
        )

    @staticmethod
    def _log_turn_timing(
        *,
        session_id: str,
        branch: str,
        hints_ms: int,
        llm_ms: int,
        execute_ms: int,
        started: float,
    ) -> None:
        """Emit non-payload timing telemetry for desktop orchestration turns."""

        logger.info(
            "[STEP] ewa_desktop_orch_timing session_id=%s branch=%s total_ms=%s hints_ms=%s llm_ms=%s execute_ms=%s",
            session_id,
            branch,
            round((time.perf_counter() - started) * 1000),
            hints_ms,
            llm_ms,
            execute_ms,
        )


async def run_orchestration_turn(
    ctx: OrchestrationContext,
    *,
    session_id: str,
    observation: Mapping[str, Any],
    policy_context: PolicyContext,
    companion_wire: Mapping[str, Any] | None = None,
    companion_context_event: Mapping[str, Any] | None = None,
) -> None:
    """Functional entry for tests."""

    orch = DesktopOrchestrator()
    await orch.on_observation(
        ctx,
        session_id=session_id,
        observation=observation,
        policy_context=policy_context,
        companion_wire=companion_wire,
        companion_context_event=companion_context_event,
    )
