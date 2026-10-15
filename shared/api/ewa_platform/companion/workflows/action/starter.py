# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Start declarative action workflows from orchestrator triggers (WF-2): create task run + steps, enqueue Celery.
# Invariants:
# - Side effects for tool steps reuse existing registry helpers (music pipeline).
# - ``generate_body`` doc requests compose markdown via sidecar LLM before confirmation (same as ``file_create`` tool).
# - Returns orchestrator-shaped dict or None (fall through).
# Related:
# - api/ewa_platform/companion/workflows/action/triggers.py
# - api/ewa_platform/companion/orchestration/task_orchestrator.py
# ---

from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import Any

import asyncpg

from api.ewa_platform.companion.orchestration.flows import doc_create
from api.ewa_platform.companion.orchestration.tool_registry import (
    ToolContext,
    _companion_backend_music_generation_enabled,
    _companion_parse_bpm_duration,
    _companion_resolve_music_generation_inputs,
    _companion_ugs_workflow_v2,
    _companion_voice_diversity,
    _looks_like_non_executing_question,
    _music_generation_api_base_url,
    _tool_router_bypass_line_match,
    _user_line_requests_music_another_one,
    _user_line_requests_music_retry,
)
from api.ewa_platform.companion.workflows.action.context import WorkflowRunContext, resolve_args_template
from api.ewa_platform.companion.workflows.action.schema import CompanionWorkflowDefinitionV1
from api.ewa_platform.companion.workflows.action.triggers import match_action_workflow_async
from api.ewa_platform.persistence_pg import companion_asyncpg as companion_pg

logger = logging.getLogger(__name__)

_MAX_WIZARD_THEME_CHARS = 500


def _looks_cyrillic(text: str) -> bool:
    return any("\u0400" <= ch <= "\u04ff" for ch in str(text or ""))


async def try_start_action_workflow(
    pool: asyncpg.Pool,
    *,
    user_line: str,
    tool_ctx: ToolContext,
    quick_intent: Any | None = None,
) -> dict[str, Any] | None:
    """Match triggers and start one action workflow when enabled."""

    from api.ewa_platform.companion.workflows.user.generic_workflow_starter import (
        start_declarative_workflow,
    )
    from api.ewa_platform.companion.workflows.user.user_workflow_triggers import (
        match_user_workflow_async,
    )

    user_match = await match_user_workflow_async(
        pool,
        principal_id=tool_ctx.principal_id,
        user_line=user_line,
    )
    if user_match is not None:
        user_wf, user_row = user_match
        from api.ewa_platform.companion.workflows.config import companion_workflow_engine_v2_enabled
        from api.ewa_platform.companion.workflows.dag.dag_workflow_starter import start_dag_workflow_v2
        from api.ewa_platform.companion.workflows.user.user_workflow_triggers import (
            is_v2_user_workflow_definition,
        )
        from api.ewa_platform.schemas.pydantic.companion_workflow_v2 import CompanionWorkflowDefinitionV2

        if isinstance(user_wf, CompanionWorkflowDefinitionV2) and companion_workflow_engine_v2_enabled():
            return await start_dag_workflow_v2(
                pool,
                user_line=user_line,
                tool_ctx=tool_ctx,
                definition=user_wf,
                user_workflow_row_id=str(user_row.get("id") or ""),
            )
        if is_v2_user_workflow_definition(user_wf):
            return None
        return await start_declarative_workflow(
            pool,
            user_line=user_line,
            tool_ctx=tool_ctx,
            workflow=user_wf,
            user_workflow_row_id=str(user_row.get("id") or ""),
        )

    wf = await match_action_workflow_async(pool, user_line, quick_intent=quick_intent)
    if wf is None:
        return None
    if wf.workflow_id == "music_full_cycle_v1":
        return await _start_music_full_cycle_v1(
            pool,
            user_line=user_line,
            tool_ctx=tool_ctx,
            workflow=wf,
        )
    if wf.workflow_id == "doc_package_v1":
        return await _start_doc_package_v1(
            pool,
            user_line=user_line,
            tool_ctx=tool_ctx,
            workflow=wf,
        )
    return await start_declarative_workflow(
        pool,
        user_line=user_line,
        tool_ctx=tool_ctx,
        workflow=wf,
    )


async def _start_music_full_cycle_v1(
    pool: asyncpg.Pool,
    *,
    user_line: str,
    tool_ctx: ToolContext,
    workflow: CompanionWorkflowDefinitionV1,
) -> dict[str, Any] | None:
    if not _companion_backend_music_generation_enabled():
        return None

    args: dict[str, Any] = {"user_line": user_line}
    if _looks_like_non_executing_question(user_line) and not _tool_router_bypass_line_match(args):
        return None

    ru = _looks_cyrillic(user_line)
    token = (tool_ctx.bearer_token or "").strip()
    if not token or tool_ctx.auth_user is None:
        return {
            "reply": (
                "Запущу полный цикл «генерация + воспроизведение», как только подгрузится сессия."
                if ru
                else "I'll start the full generate-and-play cycle once the session is loaded."
            ),
            "actions": [],
            "task_run": None,
            "orchestration_branch": "action_workflow",
        }

    ugs_wf = _companion_ugs_workflow_v2(args)
    bpm_override, duration_override = _companion_parse_bpm_duration(args)
    lyrics_arg = str(args.get("lyrics") or "").strip()
    (
        theme,
        style_key,
        vocal_eff,
        luna_mode,
        voice_diversity,
        ewa_companion_context,
    ) = await _companion_resolve_music_generation_inputs(
        pool=pool,
        principal_id=tool_ctx.principal_id,
        user_line=user_line,
        args=args,
        profile=tool_ctx.profile if isinstance(tool_ctx.profile, Mapping) else None,
    )
    if not lyrics_arg and not theme:
        if _user_line_requests_music_retry(user_line):
            reply = (
                "Не смогла подтянуть тему последней неудачной генерации — опиши тему или попроси новую песню целиком."
                if ru
                else "I could not reuse the last failed generation theme — describe the topic or ask for a new song."
            )
        elif _user_line_requests_music_another_one(user_line):
            reply = (
                "Не нашла тему прошлого трека — напиши, о чём новая песня, или повтори тему целиком."
                if ru
                else "I could not reuse the previous track theme — describe the new song topic."
            )
        else:
            reply = (
                "Нужна тема или текст песни — опиши, о чём трек."
                if ru
                else "I need a theme or lyrics — describe what the track should be about."
            )
        return {"reply": reply, "actions": [], "task_run": None, "orchestration_branch": "action_workflow"}

    from api.ewa_platform.companion.jobs.config import companion_async_music_enabled
    from api.ewa_platform.companion.jobs.enqueue import enqueue_companion_run
    from api.ewa_platform.companion.jobs.run_capacity import (
        companion_music_capacity_exceeded,
        music_busy_reply,
    )

    use_celery = companion_async_music_enabled()
    if not use_celery:
        return {
            "reply": (
                "Полный цикл музыки сейчас доступен только в фоновом режиме — включи async jobs."
                if ru
                else "The full music cycle requires background async jobs to be enabled."
            ),
            "actions": [],
            "task_run": None,
            "orchestration_branch": "action_workflow",
        }

    if await companion_music_capacity_exceeded(pool, principal_id=tool_ctx.principal_id):
        return {
            "reply": music_busy_reply(ru=ru),
            "actions": [],
            "task_run": None,
            "orchestration_branch": "action_workflow",
        }

    voice_diversity = voice_diversity or _companion_voice_diversity(args)
    base = _music_generation_api_base_url(for_remote_worker=True).rstrip("/")
    http_headers = {"Authorization": f"Bearer {token}"}
    language_e = "ru" if ru else "en"

    plan: dict[str, Any] = {
        "kind": "action_workflow",
        "workflow_id": workflow.workflow_id,
        "workflow_version": workflow.version,
        "style": style_key,
        "theme_preview": theme[:_MAX_WIZARD_THEME_CHARS],
        "lyrics_preview": lyrics_arg[:500],
        # music_full_cycle_v1 trigger requires «… и включи …» — autoplay after generate.
        "autoplay_requested": True,
    }
    run_row = await companion_pg.companion_task_run_create(
        pool,
        principal_id=tool_ctx.principal_id,
        intent_kind="action_workflow",
        user_message=user_line,
        plan_payload=plan,
        confirmation_state={},
        status="running",
        execution_mode="async",
        workflow_id=workflow.workflow_id,
        workflow_version=workflow.version,
    )
    run_id = str(run_row.get("id") or "")

    gen_step_def = workflow.steps[0]
    confirm_step_def = workflow.steps[1] if len(workflow.steps) > 1 else None
    gen_step = await companion_pg.companion_task_step_create(
        pool,
        run_id=run_id,
        step_index=1,
        step_kind=str(gen_step_def.step_kind or "music_generation_pipeline_v2"),
        title=gen_step_def.title_ru or gen_step_def.title_en or "Generate track",
        input_payload={
            "step_key": gen_step_def.step_key,
            "tool_name": gen_step_def.tool_name,
            "theme_preview": theme[:_MAX_WIZARD_THEME_CHARS],
        },
        status="pending",
    )
    if confirm_step_def is not None:
        await companion_pg.companion_task_step_create(
            pool,
            run_id=run_id,
            step_index=2,
            step_kind="confirm_gate",
            title=confirm_step_def.title_ru or confirm_step_def.title_en or "Confirm playback",
            input_payload={"step_key": confirm_step_def.step_key, "kind": confirm_step_def.kind},
            status="pending",
        )

    job_payload = {
        "step_id": str(gen_step.get("id") or ""),
        "principal_id": tool_ctx.principal_id,
        "base_url": base,
        "headers": dict(http_headers),
        "style_key": style_key,
        "vocal_eff": vocal_eff,
        "language_e": language_e,
        "ugs_wf": ugs_wf,
        "theme": theme,
        "lyrics_arg": lyrics_arg,
        "voice_diversity": voice_diversity,
        "luna_mode": luna_mode,
        "bpm_override": bpm_override,
        "duration_override": duration_override,
        "name_arg": str(args.get("name") or "").strip(),
        "explicit_tags": str(args.get("tags") or "").strip(),
        "skip_lyrics_validation": bool(args.get("skip_lyrics_validation")),
        "autoplay_requested": True,
        "ewa_companion_context": ewa_companion_context,
    }
    celery_id = enqueue_companion_run(run_id=run_id, step_index=1, job_payload=job_payload)
    if celery_id is None:
        await companion_pg.companion_task_step_update(
            pool,
            step_id=str(gen_step.get("id") or ""),
            status="failed",
            error_payload={"message": "action_workflow_enqueue_failed", "stage": "enqueue"},
        )
        await companion_pg.companion_task_run_update(
            pool,
            run_id=run_id,
            principal_id=tool_ctx.principal_id,
            status="failed",
            error_payload={"message": "action_workflow_enqueue_failed", "stage": "enqueue"},
        )
        return {
            "reply": (
                "Не смогла поставить полный цикл музыки в очередь — попробуй ещё раз."
                if ru
                else "I could not queue the full music cycle — please try again."
            ),
            "actions": [],
            "task_run": run_row,
            "orchestration_branch": "action_workflow",
        }

    refreshed = await companion_pg.companion_task_run_fetch(pool, run_id=run_id) or run_row
    logger.info(
        "[STEP] action_workflow_started workflow_id=%s run_id=%s celery_task_id=%s",
        workflow.workflow_id,
        run_id,
        celery_id,
    )
    reply = (
        "Запускаю полный цикл: сначала сгенерирую трек, потом спрошу подтверждение перед воспроизведением."
        if ru
        else "Starting the full cycle: I'll generate the track first, then ask before playback."
    )
    return {
        "reply": reply,
        "actions": [],
        "task_run": refreshed,
        "orchestration_branch": "action_workflow",
        "workflow_id": workflow.workflow_id,
    }


async def _start_doc_package_v1(
    pool: asyncpg.Pool,
    *,
    user_line: str,
    tool_ctx: ToolContext,
    workflow: CompanionWorkflowDefinitionV1,
) -> dict[str, Any] | None:
    uid = str(tool_ctx.content_catalog_user_id or "").strip()
    if not uid:
        ru = _looks_cyrillic(user_line)
        return {
            "reply": (
                "Не вижу каталог пользователя — не могу создать документ в пакетном сценарии."
                if ru
                else "I cannot run the document package without a content catalog user id."
            ),
            "actions": [],
            "task_run": None,
            "orchestration_branch": "action_workflow",
        }

    create_step_def = workflow.steps[0]
    ctx = WorkflowRunContext(user_line=user_line, principal_id=tool_ctx.principal_id)
    tool_args = resolve_args_template(create_step_def.args_template or {"user_line": user_line}, ctx)
    resolved = doc_create.resolve_file_create_inputs(str(tool_args.get("user_line") or user_line), tool_args)
    if resolved is None:
        return None
    if resolved == "need_body":
        name = doc_create.resolve_doc_create_filename(str(tool_args.get("user_line") or user_line), tool_args)
        return {
            "reply": doc_create.friendly_create_need_body_reply(user_line, name),
            "actions": [],
            "task_run": None,
            "orchestration_branch": "action_workflow",
        }

    name: str
    body: str
    if resolved == "generate_body":
        name = doc_create.resolve_doc_create_filename(str(tool_args.get("user_line") or user_line), tool_args)
        composed = await doc_create.compose_generative_doc_body_markdown(
            user_line=user_line,
            principal_id=tool_ctx.principal_id,
            profile=tool_ctx.profile if isinstance(tool_ctx.profile, Mapping) else None,
            companion_pool=pool,
        )
        # Legacy starter path expects a finished body str (not agentic continue dict).
        if not isinstance(composed, str) or not composed.strip():
            return {
                "reply": doc_create.friendly_create_compose_failed_reply(user_line),
                "actions": [],
                "task_run": None,
                "orchestration_branch": "action_workflow",
            }
        body = composed
    elif isinstance(resolved, tuple):
        name, body = resolved
    else:
        return None

    plan: dict[str, Any] = {
        "kind": "action_workflow",
        "workflow_id": workflow.workflow_id,
        "workflow_version": workflow.version,
        "folder_label": (user_line or name)[:80],
        "doc_create": {
            "name": name,
            "body": body,
            "content_user_id": uid,
            "folder_label": (user_line or name)[:80],
        },
    }
    run_row = await companion_pg.companion_task_run_create(
        pool,
        principal_id=tool_ctx.principal_id,
        intent_kind="action_workflow",
        user_message=user_line,
        plan_payload=plan,
        confirmation_state={"question": "confirm_doc_package_create", "step_key": "create"},
        status="awaiting_confirmation",
        execution_mode="sync",
        workflow_id=workflow.workflow_id,
        workflow_version=workflow.version,
    )
    run_id = str(run_row.get("id") or "")
    if run_id and not str(plan.get("task_key") or "").strip():
        plan["task_key"] = run_id
        plan["doc_create"]["task_key"] = run_id
        patched = await companion_pg.companion_task_run_update(
            pool,
            run_id=run_id,
            principal_id=tool_ctx.principal_id,
            status="awaiting_confirmation",
            plan_payload=plan,
        )
        if patched is not None:
            run_row = patched

    await companion_pg.companion_task_step_create(
        pool,
        run_id=run_id,
        step_index=1,
        step_kind=str(create_step_def.step_kind or "file_create"),
        title=create_step_def.title_ru or create_step_def.title_en or "Create file",
        input_payload={"step_key": create_step_def.step_key, "name": name, "chars": len(body)},
        status="awaiting_confirmation",
    )
    if len(workflow.steps) > 1:
        open_step_def = workflow.steps[1]
        await companion_pg.companion_task_step_create(
            pool,
            run_id=run_id,
            step_index=2,
            step_kind=str(open_step_def.step_kind or "app_open"),
            title=open_step_def.title_ru or open_step_def.title_en or "Open editor",
            input_payload={"step_key": open_step_def.step_key, "tool_name": open_step_def.tool_name},
            status="pending",
        )

    reply = doc_create.friendly_create_confirm_reply(user_line, name)
    if _looks_cyrillic(user_line):
        reply += " После создания открою Doc Editor."
    else:
        reply += " After creation I'll open Doc Editor."
    logger.info(
        "[STEP] action_workflow_started workflow_id=%s run_id=%s mode=sync_confirm", workflow.workflow_id, run_id
    )
    return {
        "reply": reply,
        "actions": [],
        "task_run": run_row,
        "orchestration_branch": "action_workflow",
        "workflow_id": workflow.workflow_id,
    }


__all__ = ("try_start_action_workflow",)
