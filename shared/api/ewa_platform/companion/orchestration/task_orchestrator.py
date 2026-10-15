# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Durable, deterministic task orchestration for EWA companion turns: pending confirmations, tool-backed document
# insertion and create, file rename/delete (confirmed), truthful memory/capability answers, visible non-empty status
# replies, optional **LLM intent plan** dispatch (`CompanionIntentPlanV1`) before regex fallbacks, and **server-only
# tool registry** dispatch for the early branches (``file_rewrite`` / ``theme_set`` / ``music_generation`` /
# ``music_studio_open`` / ``app_open``) before the LLM. Order is the canon from ``routing_policy.ORCHESTRATION_PIPELINE_ORDER``.
# **Canonical path:** ``api.ewa_platform.companion.orchestration.task_orchestrator``.
# Invariants:
# - Task state lives in EWA Postgres; never rely on the LLM to remember pending confirmations.
# - **Server-first v2** storage (read/write ``unified_content``) uses the **main** ``DATABASE_URL`` asyncpg pool via
#   ``get_asyncpg_pool``, not the EWA orchestration pool passed into ``maybe_handle_companion_task_orchestration``.
# - Tool execution emits allowlisted SPA actions only; raw model JSON is not executed here.
# - User-facing Russian status for Feni uses feminine self-reference.
# - When ``intent_plan`` is supplied and passes confidence, map intents to existing flows; otherwise same as before.
# - **Single dispatch surface** for server-only tools: every tool branch goes through ``_run_tool_branch`` which logs
#   ``[STEP] companion_orchestration_decision branch=<name> status=<status> short_circuit=<bool>``. The set of
#   short-circuiting statuses is ``_TERMINAL_TOOL_STATUSES``; ``status="memory_append"`` defers to the main LLM with
#   ``continue_main_llm``; ``status="skipped"`` and ``None`` always fall through.
# - **Music generation (env-gated):** after UGS success the tool may return ``needs_confirm`` with plan
#   ``music_play_after_generation``; ``_resume_pending_task`` emits ``music_play_track`` on affirmation or description-only on decline.
# - **No empty user bubbles.** When a tool returns ``status="error"`` with an empty ``reply``, the orchestrator
#   substitutes a localized fallback so the user always sees a non-empty message.
# - **Recent server-action ground truth.** Terminal dispatches with ``status="ok"`` or ``status="needs_confirm"`` are
#   appended to a per-principal ring (``COMPANION_RECENT_SERVER_ACTIONS_KEY`` in ``learned_preferences``) so the
#   chat LLM can ground next-turn claims in fact via ``Recent_server_actions`` in the system prompt. Recording is
#   best-effort: failures are logged and never raised — observability layer must not break a chat turn.
# Related:
# - api/ewa_platform/companion/orchestration/routing_policy.py (canonical branch order after ``resume_pending``)
# - api/ewa_platform/companion/orchestration/tool_registry.py (server-only tool dispatch — Phase B)
# - api/ewa_platform/companion/sidecar/intent_planner.py
# - api/ewa_platform/companion/server_first/v2.py (server-first storage rewrite; default on, kill-switch via env)
# - api/ewa_platform/companion/turn/chat_turn.py
# - api/ewa_platform/persistence_pg/companion_asyncpg.py
# - api/ewa_platform/gateways/runtime_gateway/runtime_command.py
# - documentation/platform/EWA-COMPANION-SERVER-ONLY-MIGRATION.md (canonical migration plan)
# ---
"""Durable EWA companion task orchestration."""

from __future__ import annotations

import logging
import re
from collections.abc import Mapping
from datetime import UTC, datetime
from typing import Any, Final

import asyncpg

from api.ewa_platform.companion.contracts import CompanionIntentPlan, CompanionIntentPlanV1
from api.ewa_platform.companion.memory import (
    COMPANION_MEMORY_DISPLAY_MAX_LINES,
    companion_memory_display_lines,
)
from api.ewa_platform.companion.orchestration.execution_ledger import (
    attach_reports_to_response,
    record_fell_through,
    record_tool_result,
)
from api.ewa_platform.companion.orchestration.response import tag_orchestration_branch
from api.ewa_platform.companion.orchestration.routing_policy import (
    DeferMemoryPhaseHandlers,
    PreToolPhaseHandlers,
    run_defer_memory_phase,
    run_early_tool_branch_loop,
    run_late_tool_branch_loop,
    run_pre_tool_phase,
)
from api.ewa_platform.companion.orchestration.run_lifecycle import run_revision
from api.ewa_platform.companion.orchestration.tool_registry import (
    ToolContext,
    ToolResult,
    dispatch_tool_by_name,
)
from api.ewa_platform.companion.orchestration.tool_result_utils import (
    as_mapping_dict,
    augment_tool_result_actions_for_tray,
)
from api.ewa_platform.companion.protocol.config import companion_execution_report_enabled
from api.ewa_platform.companion.ux.quick_intents import (
    is_quick_intent_workflow_route_hint,
    quick_intent_registry_bypass_route_hints,
)
from api.ewa_platform.schemas.pydantic.companion_execution_report import CompanionExecutionReportV1

logger = logging.getLogger(__name__)


# Statuses that **must** stop further branch dispatch. ``status="skipped"`` and ``None`` are explicit "fall through"
# signals — the tool ran but did not handle the input. The other five represent a final outcome (success, error,
# pending confirmation, missing prerequisite) and the orchestrator commits to that result for the turn.
_TERMINAL_TOOL_STATUSES: Final[frozenset[str]] = frozenset(
    {"ok", "error", "needs_confirm", "unavailable", "needs_open_editor", "accepted"},
)
_QUICK_INTENT_BYPASS_ROUTE_HINTS: Final[frozenset[str]] = quick_intent_registry_bypass_route_hints()

_EMPTY_ERROR_FALLBACK_RU: Final[str] = (
    "Не получилось выполнить — попробуй сформулировать просьбу ещё раз. Если ошибка повторится, скажи, что именно "
    "не сработало, и я попробую другой путь."
)
_EMPTY_ERROR_FALLBACK_EN: Final[str] = (
    "I could not complete the action — please rephrase the request. If the error persists, tell me what went wrong "
    "and I'll try a different path."
)


def _tool_result_to_response(result: ToolResult, user_line: str) -> dict[str, Any]:
    """Normalize a ``ToolResult`` into the orchestrator's response shape.

    Guarantees a non-empty ``reply`` when ``status="error"`` (no empty user bubbles); preserves ``actions`` /
    ``task_run`` verbatim.
    """

    reply = str(result.get("reply") or "")
    if not reply.strip() and result.get("status") == "error":
        reply = _EMPTY_ERROR_FALLBACK_RU if _looks_cyrillic(user_line) else _EMPTY_ERROR_FALLBACK_EN
    status = str(result.get("status") or "")
    meta = as_mapping_dict(result.get("meta"))
    resume_conditions: list[str] = []
    if isinstance(meta.get("resume_conditions"), list):
        resume_conditions = [str(x) for x in meta["resume_conditions"] if str(x).strip()]
    actions = augment_tool_result_actions_for_tray(
        status=status,
        actions=[dict(a) for a in (result.get("actions") or []) if isinstance(a, Mapping)],
        rationale=reply,
        resume_conditions=resume_conditions,
        task_run=result.get("task_run") if isinstance(result.get("task_run"), Mapping) else None,
    )
    out: dict[str, Any] = {
        "reply": reply,
        "actions": actions,
        "task_run": result.get("task_run"),
    }
    output_surface = result.get("output_surface")
    if isinstance(output_surface, Mapping) and output_surface.get("mode"):
        out["output_surface"] = dict(output_surface)
    data = result.get("data")
    if isinstance(data, Mapping):
        catalog_appendix = str(data.get("catalog_appendix") or "").strip()
        if catalog_appendix:
            out["catalog_appendix"] = catalog_appendix
    branch = str(result.get("tool") or "").strip()
    if branch:
        out["orchestration_branch"] = branch
    return out


_RECORDABLE_STATUSES: Final[frozenset[str]] = frozenset({"ok", "needs_confirm"})


def _summary_for_recent_action(result: ToolResult, user_line: str) -> str:
    """Pick a short, LLM-friendly summary string for the recent-actions memo (next-turn system prompt)."""

    reply = str(result.get("reply") or "").strip()
    if reply:
        return reply[:240]
    data = result.get("data")
    if isinstance(data, Mapping):
        for k in ("theme", "app_component", "file_name", "branch"):
            v = data.get(k)
            if isinstance(v, str) and v.strip():
                return f"{k}={v.strip()}"[:240]
    return (user_line or "")[:240]


async def _record_recent_server_action(
    ctx: ToolContext,
    *,
    name: str,
    result: ToolResult,
    user_line: str,
) -> None:
    """Persist a single short-circuit dispatch into the companion ring buffer (best-effort, never raises)."""

    try:
        pool = ctx.companion_pool
        if pool is None:
            return
        status = str(result.get("status") or "ok")
        if status not in _RECORDABLE_STATUSES:
            return
        await companion_pg.companion_record_recent_server_action(
            pool,
            principal_id=ctx.principal_id,
            branch=name,
            tool=str(result.get("tool") or name),
            status=status,
            summary=_summary_for_recent_action(result, user_line),
            occurred_at=datetime.now(UTC).isoformat(),
        )
    except Exception as exc:  # noqa: BLE001 — recording is best-effort observability, must never crash a turn
        logger.warning(
            "[STEP] companion_record_recent_server_action_failed branch=%s err=%s",
            name,
            exc,
        )


async def _run_tool_branch(
    name: str,
    args: Mapping[str, Any],
    ctx: ToolContext,
    *,
    user_line: str,
    turn_reports: list | None = None,
) -> dict[str, Any] | None:
    """Dispatch one server-only tool and decide whether to short-circuit the orchestrator.

    Returns the normalized response dict when the tool produced a **terminal** status (caller should ``return`` it
    immediately), or ``None`` to let the next branch run. Emits a single structured trace line per dispatch so the
    full per-turn decision path is grep-able as
    ``[STEP] companion_orchestration_decision branch=<name> status=<status> short_circuit=<bool>``. On terminal
    statuses ``ok`` and ``needs_confirm`` (i.e. real state changes / pending confirmations) records the action into
    the per-principal **recent actions ring** so the next-turn LLM has authoritative ground truth.
    """

    result = await dispatch_tool_by_name(name, args, ctx)
    client_turn_id = str(args.get("client_turn_id") or "").strip() or None
    if companion_execution_report_enabled():
        report = record_tool_result(
            name,
            result,
            branch=name,
            user_line=user_line,
            client_turn_id=client_turn_id,
        )
        if report is not None and turn_reports is not None:
            turn_reports.append(report)
    if result is None:
        logger.info(
            "[STEP] companion_orchestration_decision branch=%s status=none short_circuit=false",
            name,
        )
        return None
    status = str(result.get("status") or "ok")
    if status == "memory_append":
        data = as_mapping_dict(result.get("data"))
        append = str(data.get("memory_section_append") or "").strip()
        branch = str(data.get("orchestration_branch") or name).strip() or name
        if not append:
            logger.info(
                "[STEP] companion_orchestration_decision branch=%s status=memory_append short_circuit=defer_llm empty",
                branch,
            )
            return None
        logger.info(
            "[STEP] companion_orchestration_decision branch=%s status=memory_append short_circuit=defer_llm",
            branch,
        )
        return {
            "continue_main_llm": True,
            "memory_section_append": append,
            "orchestration_branch": branch,
            "reply": "",
            "actions": [],
            "task_run": None,
        }
    short_circuit = status in _TERMINAL_TOOL_STATUSES
    logger.info(
        "[STEP] companion_orchestration_decision branch=%s status=%s short_circuit=%s",
        name,
        status,
        "true" if short_circuit else "false",
    )
    if not short_circuit:
        if status == "skipped" and companion_execution_report_enabled():
            logger.info(
                "[STEP] companion_orchestration_decision branch=%s status=skipped short_circuit=false",
                name,
            )
        return None
    await _record_recent_server_action(ctx, name=name, result=result, user_line=user_line)
    resp = _tool_result_to_response(result, user_line)
    if "orchestration_branch" not in resp:
        data = result.get("data")
        branch_override = str(data.get("orchestration_branch") or "").strip() if isinstance(data, Mapping) else ""
        resp["orchestration_branch"] = branch_override or name
    if turn_reports is not None:
        attach_reports_to_response(resp, turn_reports, orchestrated=resp)
    return resp


from api.ewa_platform.companion.sidecar.intent_planner import companion_intent_planner_min_confidence
from api.ewa_platform.companion.storage.catalog_pipeline import create_unified_companion_document
from api.ewa_platform.companion.storage.doceditor_translate_body import resolve_doc_editor_unified_id_for_shell
from api.ewa_platform.persistence_pg import companion_asyncpg as companion_pg

_CONFIRM_YES_RE = re.compile(r"(?is)^\s*(?:да|соглас(?:ен|на)|подтверждаю|ок|окей|yes|confirm|apply|делай)\b")
_CONFIRM_NO_RE = re.compile(r"(?is)^\s*(?:нет|не надо|отмена|отмени|cancel|stop|no)\b")
_PLAY_READY_TRACK_RE = re.compile(
    r"(?ix)"
    r"(?:\b(?:включ(?:и|ай)|play|start)\b.{0,60}\b(?:трек|песн\w*|song|track)\b)"
    r"|(?:\b(?:трек|песня|song|track)\b.{0,60}\b(?:готов|ready)\b.{0,60}\b(?:включ(?:и|ай)|play|start)\b)"
)
_DOC_EDIT_RE = re.compile(
    r"(?is)(?:отредактиру|редактир|исправ|поправ|перепиш|переформатир|измени|edit|rewrite|reformat|fix).{0,120}"
    r"(?:документ|файл|редактор|document|file|editor)"
)
_MEMORY_QUESTION_RE = re.compile(
    r"(?is)(?:что\s+(?:ты\s+)?(?:помнишь|знаешь)|что\s+у\s+тебя\s+(?:есть\s+)?в\s+базе|what\s+do\s+you\s+remember)"
)


def _normalize_intent_plan(
    plan: CompanionIntentPlan | CompanionIntentPlanV1 | None,
) -> CompanionIntentPlan | None:
    if plan is None:
        return None
    if isinstance(plan, CompanionIntentPlan):
        return plan
    return CompanionIntentPlan.from_v1(plan)


def _merge_planner_into_orchestrated_reply(
    plan: CompanionIntentPlan | CompanionIntentPlanV1,
    inner: dict[str, Any],
    user_line: str,
) -> dict[str, Any]:
    normalized = _normalize_intent_plan(plan)
    assert normalized is not None
    summ = (
        (normalized.understood_summary_ru or "").strip()
        if _looks_cyrillic(user_line)
        else (normalized.understood_summary_en or "").strip()
    )
    reply = str(inner.get("reply") or "").strip()
    if summ and summ not in reply:
        reply = f"{summ}\n\n{reply}"
    out = dict(inner)
    out["reply"] = reply
    return out


def _looks_cyrillic(text: str) -> bool:
    return any("\u0400" <= ch <= "\u04ff" for ch in text)


def _friendly_appended_reply(user_line: str) -> str:
    return (
        "Готова: вставила содержимое файла в открытый документ. Проверь редактор и сохрани, если всё верно."
        if _looks_cyrillic(user_line)
        else "Done: I inserted the file content into the open document. Review the editor and save if it looks right."
    )


def _friendly_create_done_reply(user_line: str, name: str) -> str:
    return (
        f"Готова: создала документ «{name}» и открываю его в редакторе."
        if _looks_cyrillic(user_line)
        else f"Done: I created “{name}” and I am opening it in the editor."
    )


async def _storage_service_or_none() -> Any | None:
    from api.ewa_platform.companion.observability.degrade_log import companion_degrade_debug

    try:
        from api.core.database_manager import get_asyncpg_pool
        from api.services.unified_content.audit_logger import AuditLogger
        from api.services.unified_content.content_storage_service import ContentStorageService
        from api.services.unified_content.storage_backends.factory import get_storage_factory
    except Exception as exc:
        companion_degrade_debug(
            logger,
            "storage_service_import",
            "unified content stack import failed",
            exc=exc,
        )
        return None
    pool = await get_asyncpg_pool()
    if pool is None or not isinstance(pool, asyncpg.Pool):
        companion_degrade_debug(
            logger,
            "storage_service_pool",
            "asyncpg pool unavailable for content storage",
        )
        return None
    return ContentStorageService(pool, get_storage_factory(pool), AuditLogger(pool))


async def _create_document(
    storage: Any,
    *,
    content_user_id: str,
    name: str,
    body: str,
    task_key: str | None = None,
    folder_label: str | None = None,
    folder_item_id: str | None = None,
) -> Any:
    """Thin wrapper for tests/mocks; delegates to ``catalog_pipeline.create_unified_companion_document``."""

    return await create_unified_companion_document(
        storage,
        content_user_id=content_user_id,
        name=name,
        body=body,
        task_key=task_key,
        folder_label=folder_label,
        folder_item_id=folder_item_id,
    )


async def _dispatch_companion_intent_plan(
    *,
    intent_plan: CompanionIntentPlan | CompanionIntentPlanV1,
    tool_ctx: ToolContext,
    user_line: str,
    shell_norm: Mapping[str, Any] | None,
    run_tool_branch: Any,
) -> dict[str, Any] | None:
    """Map a validated LLM plan to registry tools; ``None`` → fall back to legacy orchestration / main LLM."""

    from api.ewa_platform.companion.orchestration.intent_plan_registry_dispatch import dispatch_intent_plan

    normalized = _normalize_intent_plan(intent_plan)
    if normalized is None:
        return None
    return await dispatch_intent_plan(
        normalized,
        tool_ctx=tool_ctx,
        user_line=user_line,
        shell_norm=shell_norm,
        run_tool_branch=run_tool_branch,
    )


async def _resume_pending_task(
    pool: asyncpg.Pool,
    *,
    principal_id: str,
    user_line: str,
) -> dict[str, Any] | None:
    from api.ewa_platform.companion.orchestration.task_run_confirm import apply_companion_task_run_confirmation

    run: Mapping[str, Any] | None
    try:
        run = await companion_pg.companion_task_find_latest_awaiting_confirmation(
            pool,
            principal_id=principal_id,
        )
    except AttributeError:
        # Unit tests may pass a non-asyncpg sentinel pool (``object()``) and monkeypatch only
        # ``companion_task_find_latest_active``. Fall back to the legacy reader to preserve
        # behavioral coverage without weakening runtime path for real pools.
        if hasattr(pool, "acquire"):
            raise
        run = await companion_pg.companion_task_find_latest_active(
            pool,
            principal_id=principal_id,
        )
    if run is None:
        return None
    status = str(run.get("status") or "").strip().lower()
    if status and status != "awaiting_confirmation":
        return None
    rev = run_revision(run)
    ru_locale = _looks_cyrillic(user_line)
    if _CONFIRM_NO_RE.search(user_line):
        return await apply_companion_task_run_confirmation(
            pool,
            run=run,
            principal_id=principal_id,
            decision="cancel",
            ru=ru_locale,
            expect_run_revision=rev,
        )
    if not _CONFIRM_YES_RE.search(user_line):
        return None
    return await apply_companion_task_run_confirmation(
        pool,
        run=run,
        principal_id=principal_id,
        decision="confirm",
        ru=ru_locale,
        expect_run_revision=rev,
    )


def _user_wants_ready_track_playback(user_line: str) -> bool:
    """True for explicit "play the ready track" phrasing in RU/EN."""

    return bool(_PLAY_READY_TRACK_RE.search(str(user_line or "")))


async def _resume_latest_completed_music_generation(
    pool: asyncpg.Pool,
    *,
    principal_id: str,
    user_line: str,
) -> dict[str, Any] | None:
    """Emit ``music_play_track`` for the latest completed background music generation when asked."""

    if not _user_wants_ready_track_playback(user_line):
        return None

    run = await companion_pg.companion_task_find_latest_completed_by_intent(
        pool,
        principal_id=principal_id,
        intent_kind="music_generation_background",
    )
    if run is None:
        return None

    payload = as_mapping_dict(run.get("result_payload"))
    content_id = str(payload.get("content_id") or payload.get("unified_content_id") or "").strip()
    if not content_id:
        return None
    track_name = str(payload.get("track_name") or payload.get("name") or content_id).strip() or content_id

    merged_payload = dict(payload)
    merged_payload["last_play_command_at"] = datetime.now(UTC).isoformat()
    updated = await companion_pg.companion_task_run_update(
        pool,
        run_id=str(run["id"]),
        principal_id=principal_id,
        status="completed",
        result_payload=merged_payload,
        expect_revision=run_revision(run),
    )

    return {
        "reply": (
            f"Включаю готовый трек «{track_name}» в фоне."
            if _looks_cyrillic(user_line)
            else f"Starting the ready track “{track_name}” in the background."
        ),
        "actions": [
            {
                "type": "music_play_track",
                "unified_content_id": content_id,
                "track_name": track_name,
            }
        ],
        "task_run": updated or run,
    }


async def _resume_latest_completed_presentation(
    pool: asyncpg.Pool,
    *,
    principal_id: str,
    user_line: str,
    shell_norm: Mapping[str, Any] | None = None,
) -> dict[str, Any] | None:
    """Open EWRP with the latest (or explicitly quoted) completed presentation job."""

    from api.ewa_platform.companion.orchestration.companion_presentation_generation import (
        resolve_presentation_open_target,
        user_line_requests_presentation_show,
    )

    if not user_line_requests_presentation_show(user_line):
        return None

    from api.ewa_platform.companion.sidecar.shell_context import shell_context_is_mobile

    if shell_context_is_mobile(shell_norm):
        return {
            "reply": (
                "На телефоне открой готовую презентацию через «Открыть PDF» в панели операций справа."
                if _looks_cyrillic(user_line)
                else "On mobile, open the ready presentation via “Open PDF” in the operations panel."
            ),
            "actions": [],
            "task_run": None,
        }

    target = await resolve_presentation_open_target(
        pool,
        principal_id=principal_id,
        user_line=user_line,
    )
    if target is None:
        return None

    job_id = str(target.get("ewrp_job_id") or "").strip()
    if not job_id:
        return None
    title = str(target.get("title") or target.get("topic") or job_id).strip() or job_id

    return {
        "reply": (
            f"Открываю презентацию «{title}» в EWRP."
            if _looks_cyrillic(user_line)
            else f"Opening presentation “{title}” in EWRP."
        ),
        "actions": [
            {
                "type": "open_app",
                "app_component": "EWRP",
                "ewrp_job_id": job_id,
            }
        ],
        "task_run": None,
    }


async def _answer_memory_question(
    pool: asyncpg.Pool,
    *,
    principal_id: str,
    user_line: str,
) -> dict[str, Any] | None:
    if not _MEMORY_QUESTION_RE.search(user_line):
        return None
    profile = await companion_pg.companion_profile_fetch(pool, principal_id=principal_id)
    if profile is None:
        return None
    learned = as_mapping_dict(profile.get("learned_preferences"))
    lines = companion_memory_display_lines(learned, max_lines=COMPANION_MEMORY_DISPLAY_MAX_LINES)
    if _looks_cyrillic(user_line):
        body = "В моей EWA-памяти сейчас есть:\n"
        body += "\n".join(f"- {line}" for line in lines) if lines else "- Пока нет устойчивых фактов или предпочтений."
        body += (
            "\n\nЯ могу работать с файлами через безопасный Runtime Gateway: показывать каталог, искать по названию и "
            "содержимому, открывать файловый менеджер/DocEditor и выполнять подтверждённые правки. Если текст файла не "
            "извлечён или действие требует подтверждения, я должна сказать это прямо."
        )
    else:
        body = "In my EWA memory right now:\n"
        body += "\n".join(f"- {line}" for line in lines) if lines else "- No durable facts or preferences yet."
        body += (
            "\n\nI can use the safe Runtime Gateway for file lists, metadata/body search, File manager/DocEditor "
            "opens, and confirmed edits. If text is not extracted or an action needs confirmation, I should say so."
        )
    return {"reply": body, "actions": [], "task_run": None}


async def _run_turn_plan_resume_if_any(
    pool: asyncpg.Pool,
    *,
    tool_ctx: ToolContext,
    user_line: str,
) -> dict[str, Any] | None:
    from api.ewa_platform.companion.orchestration.turn_plan_v1 import maybe_resume_turn_plan_v1

    return await maybe_resume_turn_plan_v1(
        pool,
        tool_ctx=tool_ctx,
        user_line=user_line,
        run_tool_branch=_run_tool_branch,
    )


async def maybe_handle_companion_task_orchestration(
    pool: asyncpg.Pool,
    *,
    principal_id: str,
    user_line: str,
    shell_norm: Mapping[str, Any] | None,
    content_catalog_user_id: str | None,
    oauth2_sub_for_content_alternate: str | None,
    intent_plan: CompanionIntentPlan | CompanionIntentPlanV1 | None = None,
    server_first_v2_enabled: bool = False,
    bearer_token: str | None = None,
    auth_user: Any | None = None,
    profile: Mapping[str, Any] | None = None,
    image_attachment: Mapping[str, Any] | None = None,
    execution_reports: list[CompanionExecutionReportV1] | None = None,
) -> dict[str, Any] | None:
    """Return a complete chat response when deterministic task orchestration handles the turn.

    ``bearer_token`` and ``auth_user`` are optional because legacy callers may not have them; they are required for
    tools that call authenticated HTTP from the companion turn (``theme_set`` → desktop config, ``music_generation`` →
    Music Generator V3 when env-gated); see ``orchestration.tool_registry``.
    """

    user_line_len = len(user_line or "")
    logger.info(
        "[STEP] companion_orchestration_turn_started principal=%s line_chars=%d catalog_user=%s "
        "intent_plan=%s server_first_v2_enabled=%s has_auth=%s",
        principal_id,
        user_line_len,
        "yes" if (content_catalog_user_id or "").strip() else "no",
        intent_plan.intent if intent_plan is not None else "none",
        "true" if server_first_v2_enabled else "false",
        "true" if (bearer_token and auth_user is not None) else "false",
    )

    turn_reports: list[CompanionExecutionReportV1] = list(execution_reports) if execution_reports is not None else []

    def _finalize(out: dict[str, Any] | None) -> dict[str, Any] | None:
        if out is None:
            return None
        return attach_reports_to_response(dict(out), turn_reports, orchestrated=out)

    async def _probe_tool_branch(
        branch_name: str,
        args: Mapping[str, Any],
        ctx: ToolContext,
        *,
        user_line: str,
    ) -> dict[str, Any] | None:
        return await _run_tool_branch(
            branch_name,
            args,
            ctx,
            user_line=user_line,
            turn_reports=turn_reports,
        )

    tool_ctx = ToolContext(
        principal_id=principal_id,
        user_line=user_line,
        content_catalog_user_id=content_catalog_user_id,
        oauth2_sub_for_content_alternate=oauth2_sub_for_content_alternate,
        main_pool=None,
        companion_pool=pool,
        shell_norm=shell_norm,
        bearer_token=bearer_token,
        auth_user=auth_user,
        profile=profile if isinstance(profile, Mapping) else None,
        image_attachment=image_attachment if isinstance(image_attachment, Mapping) else None,
    )

    from api.ewa_platform.companion.ux.quick_intents import match_quick_intent

    quick_intent = match_quick_intent(user_line)
    if quick_intent is not None:
        logger.info(
            "[STEP] companion_quick_intent_match id=%s route_hint=%s",
            quick_intent.intent_id.value,
            quick_intent.route_hint,
        )
    quick_intent_route_hint = str(quick_intent.route_hint).strip() if quick_intent is not None else ""
    quick_intent_id = quick_intent.intent_id.value if quick_intent is not None else ""

    async def _phase_noop() -> None:
        return None

    async def _phase_output_surface() -> dict[str, Any] | None:
        from api.ewa_platform.companion.workflows.user.user_workflow_builder import (
            answer_workflow_surface_intent,
        )

        surface_intent = answer_workflow_surface_intent(user_line)
        if surface_intent is None:
            return None
        branch = str(surface_intent.get("orchestration_branch") or "output_surface")
        logger.info(
            "[STEP] companion_orchestration_decision branch=%s status=ok short_circuit=true",
            branch,
        )
        return _finalize(tag_orchestration_branch(surface_intent, branch))

    async def _phase_check_task_status() -> dict[str, Any] | None:
        task_status = await _probe_tool_branch(
            "check_task_status",
            {"user_line": user_line},
            tool_ctx,
            user_line=user_line,
        )
        if task_status is None:
            return None
        branch = str(task_status.get("orchestration_branch") or "check_task_status").strip() or "check_task_status"
        return _finalize(tag_orchestration_branch(task_status, branch))

    async def _phase_active_operations() -> dict[str, Any] | None:
        cancel_resp = await _probe_tool_branch(
            "operation_cancel",
            {"user_line": user_line},
            tool_ctx,
            user_line=user_line,
        )
        if cancel_resp is not None:
            branch = str(cancel_resp.get("orchestration_branch") or "operation_cancel").strip() or "operation_cancel"
            return _finalize(tag_orchestration_branch(cancel_resp, branch))

        ops_status = await _probe_tool_branch(
            "operations_status",
            {"user_line": user_line},
            tool_ctx,
            user_line=user_line,
        )
        if ops_status is None:
            return None
        branch = str(ops_status.get("orchestration_branch") or "operations_status").strip() or "operations_status"
        return _finalize(tag_orchestration_branch(ops_status, branch))

    async def _phase_agentic_session() -> dict[str, Any] | None:
        from api.ewa_platform.agentic.chat_bridge import maybe_handle_agentic_companion_turn

        return await maybe_handle_agentic_companion_turn(
            pool,
            principal_id=principal_id,
            user_line=user_line,
            content_catalog_user_id=content_catalog_user_id,
            oauth2_sub=oauth2_sub_for_content_alternate,
        )

    pre_out, pre_branch = await run_pre_tool_phase(
        PreToolPhaseHandlers(
            resume_pending_task=lambda: _resume_pending_task(
                pool,
                principal_id=principal_id,
                user_line=user_line,
            ),
            agentic_session=_phase_agentic_session,
            resume_completed_music_generation=lambda: _resume_latest_completed_music_generation(
                pool,
                principal_id=principal_id,
                user_line=user_line,
            ),
            resume_completed_presentation=lambda: _resume_latest_completed_presentation(
                pool,
                principal_id=principal_id,
                user_line=user_line,
                shell_norm=shell_norm,
            ),
            output_surface=_phase_output_surface,
            check_task_status=_phase_check_task_status,
            active_operations_status=_phase_active_operations,
            turn_plan_resume=_phase_noop,
            action_workflow=_phase_noop,
            workflow=_phase_noop,
            workflow_reflect_week=_phase_noop,
        )
    )
    if pre_out is not None and pre_branch:
        if pre_branch == "resume_pending_task":
            logger.info(
                "[STEP] companion_orchestration_decision branch=resume_pending_task status=ok short_circuit=true"
            )
        elif pre_branch == "resume_completed_music_generation":
            logger.info(
                "[STEP] companion_orchestration_decision branch=resume_completed_music_generation "
                "status=ok short_circuit=true"
            )
        elif pre_branch == "resume_completed_presentation":
            logger.info(
                "[STEP] companion_orchestration_decision branch=resume_completed_presentation "
                "status=ok short_circuit=true"
            )
        if not str(pre_out.get("orchestration_branch") or "").strip():
            pre_out = tag_orchestration_branch(pre_out, pre_branch)
        return _finalize(pre_out)

    if is_quick_intent_workflow_route_hint(quick_intent_route_hint):
        from api.ewa_platform.companion.workflows.chat.runner import try_workflow_orchestration_reply

        logger.info(
            "[STEP] companion_quick_intent_route_probe id=%s route_hint=%s bypass=workflow",
            quick_intent_id or "unknown",
            quick_intent_route_hint,
        )
        workflow_quick_out = await try_workflow_orchestration_reply(
            user_line,
            shell_norm=shell_norm,
            pool=pool,
            principal_id=principal_id,
            profile=profile,
        )
        if workflow_quick_out is not None:
            branch = str(workflow_quick_out.get("orchestration_branch") or "workflow").strip() or "workflow"
            return _finalize(tag_orchestration_branch(workflow_quick_out, branch))

    if quick_intent_route_hint in _QUICK_INTENT_BYPASS_ROUTE_HINTS:
        logger.info(
            "[STEP] companion_quick_intent_route_probe id=%s route_hint=%s bypass=registry",
            quick_intent_id or "unknown",
            quick_intent_route_hint,
        )
        quick_intent_out = await _probe_tool_branch(
            quick_intent_route_hint,
            {
                "user_line": user_line,
                "_tool_router_bypass_line_match": True,
                "quick_intent_id": quick_intent_id,
            },
            tool_ctx,
            user_line=user_line,
        )
        if quick_intent_out is not None:
            branch = str(quick_intent_out.get("orchestration_branch") or quick_intent_route_hint).strip()
            return _finalize(tag_orchestration_branch(quick_intent_out, branch or quick_intent_route_hint))

    if not server_first_v2_enabled:
        # The flag is **informational** since Phase A (server-first v2 became default with its own kill-switch ENV
        # ``EWA_COMPANION_SERVER_FIRST_V2``). The dispatch still happens — the tool handler is the single source of
        # truth for whether the branch is active. Kept for backward compat with legacy callers.
        logger.info("[STEP] companion_orchestration_legacy_flag name=server_first_v2_enabled value=False ignored=true")

    async def _phase_turn_plan() -> dict[str, Any] | None:
        return await _run_turn_plan_resume_if_any(pool, tool_ctx=tool_ctx, user_line=user_line)

    async def _phase_action_workflow() -> dict[str, Any] | None:
        from api.ewa_platform.companion.workflows.action.starter import try_start_action_workflow

        action_workflow_reply = await try_start_action_workflow(
            pool,
            user_line=user_line,
            tool_ctx=tool_ctx,
            quick_intent=quick_intent,
        )
        if action_workflow_reply is None:
            return None
        logger.info("[STEP] companion_orchestration_decision branch=action_workflow status=ok short_circuit=true")
        branch = str(action_workflow_reply.get("orchestration_branch") or "action_workflow")
        return _finalize(tag_orchestration_branch(action_workflow_reply, branch))

    async def _phase_workflow() -> dict[str, Any] | None:
        from api.ewa_platform.companion.workflows.chat.runner import try_workflow_orchestration_reply

        workflow_reply = await try_workflow_orchestration_reply(
            user_line,
            shell_norm=shell_norm,
            pool=pool,
            principal_id=principal_id,
            profile=profile,
        )
        if workflow_reply is None:
            return None
        logger.info("[STEP] companion_orchestration_decision branch=workflow status=ok short_circuit=true")
        branch = str(workflow_reply.get("orchestration_branch") or "workflow")
        return _finalize(tag_orchestration_branch(workflow_reply, branch))

    post_pre_out, post_pre_branch = await run_pre_tool_phase(
        PreToolPhaseHandlers(
            resume_pending_task=_phase_noop,
            agentic_session=_phase_noop,
            resume_completed_music_generation=_phase_noop,
            resume_completed_presentation=_phase_noop,
            output_surface=_phase_noop,
            check_task_status=_phase_noop,
            active_operations_status=_phase_noop,
            turn_plan_resume=_phase_turn_plan,
            action_workflow=_phase_action_workflow,
            workflow=_phase_workflow,
            workflow_reflect_week=_phase_noop,
        )
    )
    if post_pre_out is not None and post_pre_branch:
        if not str(post_pre_out.get("orchestration_branch") or "").strip():
            post_pre_out = tag_orchestration_branch(post_pre_out, post_pre_branch)
        return _finalize(post_pre_out)

    async def _phase_compound() -> dict[str, Any] | None:
        from api.ewa_platform.companion.orchestration.compound_file_chain import (
            maybe_handle_compound_file_chain,
        )

        compound_resp = await maybe_handle_compound_file_chain(
            pool,
            tool_ctx=tool_ctx,
            user_line=user_line,
        )
        if compound_resp is None:
            return None
        branch = str(compound_resp.get("orchestration_branch") or "compound_file_chain").strip()
        return _finalize(tag_orchestration_branch(compound_resp, branch))

    async def _phase_file_study() -> dict[str, Any] | None:
        from api.ewa_platform.companion.orchestration.file_study_compose import (
            maybe_handle_file_study_compose_turn,
        )

        file_study_resp = await maybe_handle_file_study_compose_turn(
            pool,
            tool_ctx=tool_ctx,
            user_line=user_line,
        )
        if file_study_resp is None:
            return None
        branch = str(file_study_resp.get("orchestration_branch") or "file_study_compose").strip()
        return _finalize(tag_orchestration_branch(file_study_resp, branch))

    async def _phase_file_focus() -> dict[str, Any] | None:
        from api.ewa_platform.companion.orchestration.turn_context_guards import (
            maybe_orchestrate_file_focus_chat_turn,
        )

        file_focus_chat = await maybe_orchestrate_file_focus_chat_turn(
            pool,
            tool_ctx=tool_ctx,
            user_line=user_line,
        )
        if file_focus_chat is None:
            return None
        branch = str(file_focus_chat.get("orchestration_branch") or "file_focus_chat").strip()
        return _finalize(tag_orchestration_branch(file_focus_chat, branch))

    defer_out, defer_branch = await run_defer_memory_phase(
        DeferMemoryPhaseHandlers(
            compound_file_chain=_phase_compound,
            file_study_compose=_phase_file_study,
            file_focus_chat=_phase_file_focus,
        )
    )
    if defer_out is not None and defer_branch:
        return defer_out

    from api.ewa_platform.companion.orchestration.branch_line_gates import (
        early_tool_branch_may_probe,
        user_line_may_match_late_file_ops,
    )

    profile_map = profile if isinstance(profile, Mapping) else None

    async def _probe_early(branch_name: str) -> dict[str, Any] | None:
        return await _run_tool_branch(
            branch_name,
            {"user_line": user_line},
            tool_ctx,
            user_line=user_line,
            turn_reports=turn_reports,
        )

    def _early_may_probe(
        branch_name: str,
        line: str,
        profile_arg: Mapping[str, Any] | None,
        *,
        principal_id: str = "",
    ) -> bool:
        if branch_name == "image_generation" and image_attachment is not None:
            # Attachment-backed image edits like "убери фон" may not repeat the word "image".
            return True
        return early_tool_branch_may_probe(branch_name, line, profile_arg, principal_id=principal_id)

    early_out, early_branch = await run_early_tool_branch_loop(
        user_line=user_line,
        profile=profile_map,
        principal_id=principal_id,
        may_probe=_early_may_probe,
        run_tool_branch=_probe_early,
    )
    if early_out is not None and early_branch:
        return _finalize(tag_orchestration_branch(early_out, early_branch))

    from api.ewa_platform.companion.orchestration.tool_router_dispatch import (
        maybe_dispatch_companion_tool_router,
    )

    router_response = await maybe_dispatch_companion_tool_router(
        pool,
        tool_ctx=tool_ctx,
        user_line=user_line,
        shell_norm=shell_norm,
        russian_user=any("\u0400" <= ch <= "\u04ff" for ch in user_line),
        run_tool_branch=_probe_tool_branch,
    )
    if router_response is not None:
        branch = str(router_response.get("orchestration_branch") or "tool_router_dispatch").strip()
        return _finalize(tag_orchestration_branch(router_response, branch))

    from api.ewa_platform.companion.plans.intent import user_line_requests_plan
    from api.ewa_platform.companion.plans.refine_intent import user_line_requests_plan_refine
    from api.ewa_platform.companion.plans.time import user_line_requests_plan_time_adjustment

    plan_line = (
        user_line_requests_plan(user_line)
        or user_line_requests_plan_refine(user_line)
        or user_line_requests_plan_time_adjustment(user_line)
    )
    min_c = companion_intent_planner_min_confidence()
    if (
        intent_plan is not None
        and intent_plan.intent != "chat_only"
        and float(intent_plan.confidence) >= min_c
        and not (plan_line and intent_plan.intent == "doc_create")
    ):
        dispatched = await _dispatch_companion_intent_plan(
            intent_plan=intent_plan,
            tool_ctx=tool_ctx,
            user_line=user_line,
            shell_norm=shell_norm,
            run_tool_branch=_probe_tool_branch,
        )
        if dispatched is not None:
            logger.info(
                "[STEP] companion_orchestration_decision branch=intent_planner_dispatch status=ok "
                "short_circuit=true intent=%s confidence=%.2f",
                intent_plan.intent,
                float(intent_plan.confidence),
            )
            merged = _merge_planner_into_orchestrated_reply(intent_plan, dispatched, user_line)
            return _finalize(tag_orchestration_branch(merged, "intent_planner_dispatch"))

    if plan_line:
        from api.ewa_platform.companion.plans.config import companion_plan_enabled

        if companion_plan_enabled():
            plan_out = await _run_tool_branch(
                "plan_v1",
                {"user_line": user_line},
                tool_ctx,
                user_line=user_line,
                turn_reports=turn_reports,
            )
            if plan_out is not None:
                return _finalize(tag_orchestration_branch(plan_out, "plan_v1"))
        ru = _looks_cyrillic(user_line)
        return _finalize(
            tag_orchestration_branch(
                {
                    "reply": (
                        "Не удалось сохранить план на сервере — проверь, что планы включены (EWA_COMPANION_PLAN_ENABLED), "
                        "или переформулируй запрос с конкретной темой."
                        if ru
                        else "Could not save the plan on the server — check EWA_COMPANION_PLAN_ENABLED or rephrase with a clear topic."
                    ),
                    "actions": [],
                    "task_run": None,
                },
                "plan_v1_unavailable",
            )
        )

    memory_answer = await _answer_memory_question(pool, principal_id=principal_id, user_line=user_line)
    if memory_answer is not None:
        logger.info("[STEP] companion_orchestration_decision branch=memory_question status=ok short_circuit=true")
        return _finalize(tag_orchestration_branch(memory_answer, "memory_question"))

    async def _probe_late(branch_name: str) -> dict[str, Any] | None:
        return await _run_tool_branch(
            branch_name,
            {"user_line": user_line},
            tool_ctx,
            user_line=user_line,
            turn_reports=turn_reports,
        )

    late_out, late_branch = await run_late_tool_branch_loop(
        user_line=user_line,
        may_match_late=user_line_may_match_late_file_ops,
        run_tool_branch=_probe_late,
    )
    if late_out is not None and late_branch:
        return _finalize(tag_orchestration_branch(late_out, late_branch))

    if _DOC_EDIT_RE.search(user_line) and not resolve_doc_editor_unified_id_for_shell(shell_norm or {}):
        logger.info(
            "[STEP] companion_orchestration_decision branch=doc_edit_requires_open_editor "
            "status=needs_open_editor short_circuit=true",
        )
        return _finalize(
            tag_orchestration_branch(
                {
                    "reply": (
                        "Чтобы отредактировать файл, сначала открой документ в DocEditor. Сейчас я не вижу `uc` открытого документа и не буду делать вид, что изменила файл."
                        if _looks_cyrillic(user_line)
                        else "To edit a file, open it in DocEditor first. I cannot see the open document `uc`, so I will not pretend I changed it."
                    ),
                    "actions": [],
                    "task_run": None,
                },
                "doc_edit_requires_open_editor",
            )
        )
    fell = record_fell_through()
    if fell is not None:
        turn_reports.append(fell)
    return None


__all__ = (
    "maybe_handle_companion_task_orchestration",
    "_create_document",
    "_friendly_appended_reply",
    "_friendly_create_done_reply",
    "_storage_service_or_none",
)
