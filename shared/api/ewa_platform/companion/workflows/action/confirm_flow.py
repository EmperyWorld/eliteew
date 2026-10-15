# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Confirm/cancel handler for multi-step action workflows (WF-3 doc_package_v1).
# Invariants:
# - Called from ``task_run_confirm`` when ``plan_payload.kind == action_workflow``.
# - Returns None when the run is not an action workflow confirm target.
# Related:
# - api/ewa_platform/companion/orchestration/task_run_confirm.py
# - api/ewa_platform/companion/workflows/action/context.py
# ---

from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import Any, Literal

import asyncpg

from api.ewa_platform.companion.orchestration.run_lifecycle import run_revision
from api.ewa_platform.companion.orchestration.tool_result_utils import as_mapping_dict
from api.ewa_platform.companion.workflows.action.context import WorkflowRunContext, resolve_args_template
from api.ewa_platform.companion.workflows.action.registry import get_builtin_workflow
from api.ewa_platform.persistence_pg import companion_asyncpg as companion_pg

logger = logging.getLogger(__name__)


async def maybe_apply_action_workflow_confirmation(
    pool: asyncpg.Pool,
    *,
    run: Mapping[str, Any],
    principal_id: str,
    decision: Literal["confirm", "cancel"],
    ru_locale: bool,
    expect_run_revision: int | None = None,
) -> dict[str, Any] | None:
    plan = as_mapping_dict(run.get("plan_payload"))
    if str(plan.get("kind") or "") == "action_workflow_v2":
        return await _confirm_dag_workflow_confirm_gate(
            pool,
            run=run,
            principal_id=principal_id,
            decision=decision,
            ru_locale=ru_locale,
            expect_run_revision=expect_run_revision,
        )
    if str(plan.get("kind") or "") != "action_workflow":
        return None
    workflow_id = str(plan.get("workflow_id") or run.get("workflow_id") or "").strip()
    if workflow_id == "doc_package_v1":
        return await _confirm_doc_package_v1(
            pool,
            run=run,
            principal_id=principal_id,
            plan=plan,
            decision=decision,
            ru_locale=ru_locale,
            expect_run_revision=expect_run_revision,
        )
    generic = await _confirm_generic_workflow_confirm_gate(
        pool,
        run=run,
        principal_id=principal_id,
        decision=decision,
        ru_locale=ru_locale,
        expect_run_revision=expect_run_revision,
    )
    if generic is not None:
        return generic
    logger.info("[STEP] action_workflow_confirm_unhandled workflow_id=%s", workflow_id)
    return None


async def _confirm_generic_workflow_confirm_gate(
    pool: asyncpg.Pool,
    *,
    run: Mapping[str, Any],
    principal_id: str,
    decision: Literal["confirm", "cancel"],
    ru_locale: bool,
    expect_run_revision: int | None = None,
) -> dict[str, Any] | None:
    conf = as_mapping_dict(run.get("confirmation_state"))
    if str(conf.get("kind") or "") != "workflow_confirm_gate":
        return None

    from api.ewa_platform.companion.jobs.enqueue import enqueue_companion_run

    run_id = str(run.get("id") or "").strip()
    step_index = int(conf.get("step_index") or 0)
    if not run_id or step_index <= 0:
        return None

    current_expect = expect_run_revision if expect_run_revision is not None else run_revision(run)

    async def _update_run(**kwargs: Any) -> dict[str, Any] | None:
        return await companion_pg.companion_task_run_update(
            pool,
            run_id=run_id,
            principal_id=principal_id,
            expect_revision=current_expect,
            **kwargs,
        )

    if decision == "cancel":
        updated = await _update_run(
            status="cancelled",
            result_payload={"workflow_confirm_declined": True},
            confirmation_state={},
        )
        reply = "Хорошо, отменяю шаг подтверждения." if ru_locale else "Okay, cancelling the confirmation step."
        return {"reply": reply, "actions": [], "task_run": updated or dict(run)}

    steps = await companion_pg.companion_task_steps_list(pool, run_id=run_id)
    gate_step = next((s for s in steps if int(s.get("step_index") or 0) == step_index), None)
    if gate_step is None:
        return None

    await companion_pg.companion_task_step_update(
        pool,
        step_id=str(gate_step.get("id") or ""),
        status="completed",
        output_payload={"confirmed": True},
    )

    next_indexes = sorted(
        int(row.get("step_index") or 0)
        for row in steps
        if int(row.get("step_index") or 0) > step_index and str(row.get("status") or "").strip().lower() == "pending"
    )
    if next_indexes:
        celery_id = enqueue_companion_run(run_id=run_id, step_index=next_indexes[0], job_payload={})
        if celery_id is None:
            updated = await _update_run(
                status="failed",
                error_payload={"message": "workflow_confirm_resume_enqueue_failed"},
            )
            reply = (
                "Не удалось продолжить workflow после подтверждения."
                if ru_locale
                else "Could not resume the workflow after confirmation."
            )
            return {"reply": reply, "actions": [], "task_run": updated or dict(run)}
        updated = await _update_run(status="running", confirmation_state={})
        reply = "Продолжаю workflow после подтверждения." if ru_locale else "Resuming the workflow after confirmation."
        return {"reply": reply, "actions": [], "task_run": updated or dict(run)}

    updated = await _update_run(
        status="completed",
        result_payload={"workflow_confirm_gate_completed": True},
        confirmation_state={},
    )
    reply = (
        "Шаг подтверждения принят, workflow завершён." if ru_locale else "Confirmation accepted; workflow completed."
    )
    return {"reply": reply, "actions": [], "task_run": updated or dict(run)}


async def _confirm_dag_workflow_confirm_gate(
    pool: asyncpg.Pool,
    *,
    run: Mapping[str, Any],
    principal_id: str,
    decision: Literal["confirm", "cancel"],
    ru_locale: bool,
    expect_run_revision: int | None = None,
) -> dict[str, Any] | None:
    conf = as_mapping_dict(run.get("confirmation_state"))
    if str(conf.get("kind") or "") != "workflow_confirm_gate":
        return None
    if str(conf.get("engine") or "") != "dag_v2":
        return None

    run_id = str(run.get("id") or "").strip()
    step_index = int(conf.get("step_index") or 0)
    node_id = str(conf.get("node_id") or "").strip()
    if not run_id or step_index <= 0:
        return None

    current_expect = expect_run_revision if expect_run_revision is not None else run_revision(run)

    async def _update_run(**kwargs: Any) -> dict[str, Any] | None:
        return await companion_pg.companion_task_run_update(
            pool,
            run_id=run_id,
            principal_id=principal_id,
            expect_revision=current_expect,
            **kwargs,
        )

    if decision == "cancel":
        updated = await _update_run(
            status="cancelled",
            result_payload={"workflow_confirm_declined": True},
            confirmation_state={},
        )
        reply = "Хорошо, отменяю шаг подтверждения." if ru_locale else "Okay, cancelling the confirmation step."
        return {"reply": reply, "actions": [], "task_run": updated or dict(run)}

    from api.ewa_platform.companion.workflows.dag.dag_async_resume import advance_dag_workflow_after_async_node

    advanced = await advance_dag_workflow_after_async_node(
        pool,
        parent_run_id=run_id,
        parent_step_index=step_index,
        node_outputs={"confirmed": True, "node_id": node_id},
    )
    if not advanced:
        updated = await _update_run(
            status="failed",
            error_payload={"message": "dag_confirm_resume_failed"},
        )
        reply = (
            "Не удалось продолжить сценарий после подтверждения."
            if ru_locale
            else "Could not resume the workflow after confirmation."
        )
        return {"reply": reply, "actions": [], "task_run": updated or dict(run)}

    refreshed = await companion_pg.companion_task_run_fetch(pool, run_id=run_id) or run
    updated = await companion_pg.companion_task_run_update(
        pool,
        run_id=run_id,
        principal_id=principal_id,
        status="running",
        confirmation_state={},
        expect_revision=run_revision(refreshed),
    )
    reply = "Продолжаю сценарий после подтверждения." if ru_locale else "Resuming the workflow after confirmation."
    return {"reply": reply, "actions": [], "task_run": updated or dict(refreshed)}


async def _confirm_doc_package_v1(
    pool: asyncpg.Pool,
    *,
    run: Mapping[str, Any],
    principal_id: str,
    plan: Mapping[str, Any],
    decision: Literal["confirm", "cancel"],
    ru_locale: bool,
    expect_run_revision: int | None = None,
) -> dict[str, Any]:
    from api.ewa_platform.companion.orchestration.task_orchestrator import (
        _create_document,
        _friendly_create_done_reply,
        _storage_service_or_none,
    )

    run_id = str(run.get("id") or "")
    locale_line = str(run.get("user_message") or "")
    current_run: Mapping[str, Any] = run
    current_expect_revision = expect_run_revision if expect_run_revision is not None else run_revision(run)

    async def _update_run(**kwargs: Any) -> dict[str, Any] | None:
        nonlocal current_expect_revision, current_run

        updated = await companion_pg.companion_task_run_update(
            pool,
            run_id=run_id,
            principal_id=principal_id,
            expect_revision=current_expect_revision,
            **kwargs,
        )
        if updated is not None:
            current_run = updated
            current_expect_revision = run_revision(updated)
        return updated

    def _conflict_reply() -> str:
        return (
            "Задача уже изменилась. Обнови список задач и повтори действие, если оно ещё актуально."
            if ru_locale
            else "This task has already changed. Refresh the task list and retry if it is still relevant."
        )

    def _outcome(
        updated: dict[str, Any] | None, *, reply: str, actions: list[dict[str, Any]] | None = None
    ) -> dict[str, Any]:
        if updated is not None:
            return {"reply": reply, "actions": actions or [], "task_run": updated}
        if current_expect_revision is not None:
            return {
                "reply": _conflict_reply(),
                "actions": [],
                "task_run": dict(current_run),
                "revision_conflict": True,
            }
        return {"reply": reply, "actions": actions or [], "task_run": dict(current_run)}

    if decision == "cancel":
        steps = await companion_pg.companion_task_steps_list(pool, run_id=run_id)
        for step in steps:
            await companion_pg.companion_task_step_update(
                pool,
                step_id=str(step.get("id") or ""),
                status="cancelled",
            )
        updated = await _update_run(
            status="cancelled",
            result_payload={"cancelled_by_user": True},
        )
        return _outcome(
            updated,
            reply="Отменила пакет «документ + редактор»." if ru_locale else "Cancelled the document package workflow.",
        )

    doc_block = as_mapping_dict(plan.get("doc_create"))
    from api.ewa_platform.companion.orchestration.flows.doc_create import default_doc_create_filename

    name = str(doc_block.get("name") or "").strip() or default_doc_create_filename(locale_line)
    body = str(doc_block.get("body") or "")
    content_user_id = str(doc_block.get("content_user_id") or "").strip()

    storage = await _storage_service_or_none()
    if storage is None:
        updated = await _update_run(
            status="failed",
            error_payload={"message": "storage_unavailable"},
        )
        return _outcome(
            updated,
            reply="Не смогла создать файл: хранилище сейчас недоступно."
            if ru_locale
            else "I could not create the file: storage is unavailable.",
        )

    try:
        row = await _create_document(
            storage,
            content_user_id=content_user_id,
            name=name,
            body=body,
            task_key=str(plan.get("task_key") or run_id or "").strip() or None,
            folder_label=str(
                plan.get("folder_label") or doc_block.get("folder_label") or name or locale_line or "Task"
            )[:80],
        )
    except Exception as exc:  # noqa: BLE001
        updated = await _update_run(
            status="failed",
            error_payload={"message": str(exc)[:500]},
        )
        return _outcome(
            updated,
            reply=f"Не смогла создать файл: {str(exc)[:180]}"
            if ru_locale
            else f"I could not create the file: {str(exc)[:180]}",
        )

    created_id = str(getattr(row, "id", "")).strip()
    steps = await companion_pg.companion_task_steps_list(pool, run_id=run_id)
    create_step = next((s for s in steps if int(s.get("step_index") or 0) == 1), steps[0] if steps else None)
    open_step = next((s for s in steps if int(s.get("step_index") or 0) == 2), None)

    step1_output = {
        "created_unified_content_id": created_id,
        "unified_content_id": created_id,
        "name": name,
    }
    if create_step is not None:
        await companion_pg.companion_task_step_update(
            pool,
            step_id=str(create_step.get("id") or ""),
            status="completed",
            output_payload=step1_output,
        )

    wf_def = get_builtin_workflow("doc_package_v1")
    open_args: dict[str, Any] = {"app_component": "DocEditor"}
    if wf_def is not None and len(wf_def.steps) > 1:
        ctx = WorkflowRunContext(
            user_line=locale_line,
            principal_id=principal_id,
            steps=tuple(await companion_pg.companion_task_steps_list(pool, run_id=run_id)),
        )
        open_args = resolve_args_template(wf_def.steps[1].args_template or open_args, ctx)
        if not open_args.get("app_component"):
            open_args["app_component"] = "DocEditor"

    payload_raw = open_args.get("payload")
    payload = dict(payload_raw) if isinstance(payload_raw, Mapping) else {}
    uc_id = str(
        payload.get("unified_content_id") or open_args.get("unified_content_id") or created_id,
    ).strip()
    action: dict[str, Any] = {
        "type": "open_app",
        "app_component": str(open_args.get("app_component") or "DocEditor"),
        "unified_content_id": uc_id,
        "companion_surface_only": True,
    }

    if open_step is not None:
        await companion_pg.companion_task_step_update(
            pool,
            step_id=str(open_step.get("id") or ""),
            status="completed",
            output_payload={"app_component": action["app_component"], "unified_content_id": uc_id},
        )

    updated = await _update_run(
        status="completed",
        result_payload={
            "workflow_id": "doc_package_v1",
            "created_unified_content_id": created_id,
            "opened_app": action["app_component"],
        },
    )
    reply = _friendly_create_done_reply(locale_line, name)
    if ru_locale:
        reply += "\n\nОткрываю документ в чате."
    else:
        reply += "\n\nOpening the document in chat."
    logger.info(
        "[STEP] action_workflow_doc_package_completed run_id=%s content_id=%s",
        run_id,
        created_id,
    )
    return _outcome(updated, reply=reply, actions=[action])


__all__ = ("maybe_apply_action_workflow_confirmation",)
