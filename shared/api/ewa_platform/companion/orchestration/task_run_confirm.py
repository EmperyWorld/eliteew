# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Apply explicit confirm/cancel to companion task runs awaiting confirmation (Phase 3 HTTP + chat regex).
# Invariants:
# - Caller must verify ``run.status == awaiting_confirmation`` and principal scope.
# - Optional ``expect_run_revision`` is forwarded to ``companion_task_run_update``; mismatch sets ``revision_conflict``.
# Related:
# - api/ewa_platform/companion/orchestration/task_orchestrator.py
# - api/ewa_platform/gateways/routers/companion_chat.py
# ---

from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import Any, Literal
from uuid import UUID

import asyncpg

from api.ewa_platform.companion.orchestration.run_lifecycle import run_revision
from api.ewa_platform.companion.orchestration.tool_result_utils import as_mapping_dict
from api.ewa_platform.persistence_pg import companion_asyncpg as companion_pg

logger = logging.getLogger(__name__)


async def apply_companion_task_run_confirmation(
    pool: asyncpg.Pool,
    *,
    run: Mapping[str, Any],
    principal_id: str,
    decision: Literal["confirm", "cancel"],
    ru: bool | None = None,
    expect_run_revision: int | None = None,
) -> dict[str, Any]:
    """Execute confirm/cancel for one ``awaiting_confirmation`` task run."""

    from api.ewa_platform.companion.orchestration.task_orchestrator import (
        _create_document,
        _friendly_appended_reply,
        _friendly_create_done_reply,
        _looks_cyrillic,
        _storage_service_or_none,
    )

    locale_line = str(run.get("user_message") or "")
    ru_locale = _looks_cyrillic(locale_line) if ru is None else bool(ru)
    locale_hint_line = locale_line or ("да" if ru_locale else "yes")
    plan = as_mapping_dict(run.get("plan_payload"))
    run_id = str(run.get("id") or "")
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

    def _revision_conflict_reply() -> str:
        return (
            "Задача уже изменилась. Обнови список задач и повтори действие, если оно ещё актуально."
            if ru_locale
            else "This task has already changed. Refresh the task list and retry if it is still relevant."
        )

    def _confirm_result(
        updated: dict[str, Any] | None,
        *,
        reply: str,
        actions: list[dict[str, Any]] | None = None,
    ) -> dict[str, Any]:
        actions_out: list[dict[str, Any]] = [] if actions is None else actions
        if updated is not None:
            return {"reply": reply, "actions": actions_out, "task_run": updated}
        if current_expect_revision is not None:
            return {
                "reply": _revision_conflict_reply(),
                "actions": [],
                "task_run": dict(current_run),
                "revision_conflict": True,
            }
        return {"reply": reply, "actions": actions_out, "task_run": dict(current_run)}

    async def _claim_confirm_execution() -> dict[str, Any] | None:
        if decision != "confirm":
            return dict(current_run)
        return await _update_run(
            status="running",
            confirmation_state={"state": "confirming", "decision": "confirm"},
        )

    from api.ewa_platform.companion.workflows.action.confirm_flow import (
        maybe_apply_action_workflow_confirmation,
    )

    if decision == "confirm" and await _claim_confirm_execution() is None:
        return _confirm_result(None, reply=_revision_conflict_reply())

    wf_outcome = await maybe_apply_action_workflow_confirmation(
        pool,
        run=current_run,
        principal_id=principal_id,
        decision=decision,
        ru_locale=ru_locale,
        expect_run_revision=current_expect_revision,
    )
    if wf_outcome is not None:
        return wf_outcome

    if plan.get("kind") == "music_play_after_generation":
        desc_ru = str(plan.get("description_ru") or "")
        desc_en = str(plan.get("description_en") or "")
        base = desc_ru if ru_locale else desc_en
        if decision == "cancel":
            updated = await _update_run(
                status="cancelled",
                result_payload={"declined_background_play": True},
            )
            reply_decline = f"Хорошо, не включаю. {base}" if ru_locale else f"Okay, I won't start playback. {base}"
            return _confirm_result(updated, reply=reply_decline)
        content_id = str(plan.get("content_id") or "").strip()
        track_name = str(plan.get("track_name") or "").strip()
        if not content_id:
            updated = await _update_run(
                status="failed",
                error_payload={"message": "missing_content_id"},
            )
            return _confirm_result(
                updated,
                reply=(
                    "Не смогла включить трек — нет id контента."
                    if ru_locale
                    else "I could not play: missing content id."
                ),
            )
        steps = await companion_pg.companion_task_steps_list(pool, run_id=run_id)
        for step in steps:
            await companion_pg.companion_task_step_update(
                pool,
                step_id=str(step["id"]),
                status="completed",
                output_payload={"background_play": True, "unified_content_id": content_id},
            )
        updated = await _update_run(
            status="completed",
            result_payload={"background_play": True, "unified_content_id": content_id},
        )
        play_action: dict[str, Any] = {
            "type": "music_play_track",
            "unified_content_id": content_id,
            "track_name": track_name or content_id,
        }
        play_ack = (
            "Включаю в фоне — слушай через виджет на столе или системные кнопки «play»."
            if ru_locale
            else "Starting background playback — use the desktop widget or system media controls."
        )
        return _confirm_result(
            updated,
            reply=f"{base}\n\n{play_ack}",
            actions=[play_action],
        )

    if decision == "cancel":
        updated = await _update_run(
            status="cancelled",
            result_payload={"cancelled_by_user": True},
        )
        return _confirm_result(
            updated,
            reply="Отменила задачу." if ru_locale else "Cancelled the task.",
        )

    if plan.get("kind") == "telegram_send":
        from api.ewa_platform.companion.outbound.telegram_send import send_telegram_message

        chat_id = str(plan.get("chat_id") or "").strip()
        message_text = str(plan.get("message_text") or "").strip()
        if not chat_id or not message_text:
            updated = await _update_run(
                status="failed",
                error_payload={"message": "telegram_send_incomplete"},
            )
            return _confirm_result(
                updated,
                reply=(
                    "Не смогла отправить в Telegram: нет chat_id или текста."
                    if ru_locale
                    else "Could not send Telegram: missing chat_id or message text."
                ),
            )
        try:
            result = await send_telegram_message(chat_id=chat_id, message_text=message_text)
        except Exception as exc:  # noqa: BLE001
            updated = await _update_run(
                status="failed",
                error_payload={"message": str(exc)[:500]},
            )
            return _confirm_result(
                updated,
                reply=(
                    f"Telegram: ошибка отправки ({str(exc)[:180]})"
                    if ru_locale
                    else f"Telegram send failed ({str(exc)[:180]})"
                ),
            )
        data = result.as_dict()
        if not result.ok:
            updated = await _update_run(
                status="failed",
                error_payload={"message": str(data.get("error") or "send_failed")[:500]},
            )
            return _confirm_result(
                updated,
                reply=(
                    f"Telegram: не удалось отправить ({data.get('error') or 'failed'})."
                    if ru_locale
                    else f"Telegram: could not send ({data.get('error') or 'failed'})."
                ),
            )
        steps = await companion_pg.companion_task_steps_list(pool, run_id=run_id)
        for step in steps:
            await companion_pg.companion_task_step_update(
                pool,
                step_id=str(step["id"]),
                status="completed",
                output_payload=data,
            )
        updated = await _update_run(status="completed", result_payload=data)
        return _confirm_result(
            updated,
            reply="Сообщение отправлено в Telegram." if ru_locale else "Telegram message sent.",
        )

    if plan.get("kind") == "email_send":
        from api.ewa_platform.companion.outbound.email_send import send_workflow_email

        to = str(plan.get("to") or "").strip()
        subject = str(plan.get("subject") or "").strip()
        body = str(plan.get("body") or "").strip()
        html_raw = plan.get("html")
        html = str(html_raw).strip() if html_raw else None
        if not to or not (body or html):
            updated = await _update_run(
                status="failed",
                error_payload={"message": "email_send_incomplete"},
            )
            return _confirm_result(
                updated,
                reply=(
                    "Не смогла отправить письмо: нужен адрес и текст."
                    if ru_locale
                    else "Could not send email: need recipient and body."
                ),
            )
        try:
            result = await send_workflow_email(to=to, subject=subject, body=body, html=html)
        except Exception as exc:  # noqa: BLE001
            updated = await _update_run(
                status="failed",
                error_payload={"message": str(exc)[:500]},
            )
            return _confirm_result(
                updated,
                reply=(
                    f"Email: ошибка отправки ({str(exc)[:180]})"
                    if ru_locale
                    else f"Email send failed ({str(exc)[:180]})"
                ),
            )
        data = result.as_dict()
        if not result.ok:
            updated = await _update_run(
                status="failed",
                error_payload={"message": str(data.get("error") or "send_failed")[:500]},
            )
            return _confirm_result(
                updated,
                reply=(
                    f"Email: не удалось отправить ({data.get('error') or 'failed'})."
                    if ru_locale
                    else f"Email: could not send ({data.get('error') or 'failed'})."
                ),
            )
        steps = await companion_pg.companion_task_steps_list(pool, run_id=run_id)
        for step in steps:
            await companion_pg.companion_task_step_update(
                pool,
                step_id=str(step["id"]),
                status="completed",
                output_payload=data,
            )
        updated = await _update_run(status="completed", result_payload=data)
        return _confirm_result(
            updated,
            reply=(f"Письмо отправлено на {to}." if ru_locale else f"Email sent to {to}."),
        )

    if plan.get("kind") == "doc_create":
        from api.ewa_platform.companion.orchestration.flows.doc_create import default_doc_create_filename

        storage = await _storage_service_or_none()
        if storage is None:
            updated = await _update_run(
                status="failed",
                error_payload={"message": "storage_unavailable"},
            )
            return _confirm_result(
                updated,
                reply=(
                    "Не смогла создать файл: хранилище сейчас недоступно."
                    if ru_locale
                    else "I could not create the file: storage is unavailable."
                ),
            )
        try:
            row = await _create_document(
                storage,
                content_user_id=str(plan.get("content_user_id") or ""),
                name=str(plan.get("name") or "").strip() or default_doc_create_filename(locale_line),
                body=str(plan.get("body") or ""),
                task_key=str(plan.get("task_key") or "").strip() or None,
                folder_label=str(plan.get("folder_label") or "").strip() or None,
                folder_item_id=str(plan.get("folder_item_id") or "").strip() or None,
            )
        except Exception as exc:  # noqa: BLE001
            updated = await _update_run(
                status="failed",
                error_payload={"message": str(exc)[:500]},
            )
            return _confirm_result(
                updated,
                reply=(
                    f"Не смогла создать файл: {str(exc)[:180]}"
                    if ru_locale
                    else f"I could not create the file: {str(exc)[:180]}"
                ),
            )
        created_id = str(getattr(row, "id", "")).strip()
        reused_existing = bool(getattr(row, "deduplicated_reused", False))
        action = {
            "type": "open_app",
            "app_component": "DocEditor",
            "unified_content_id": created_id,
            "companion_surface_only": True,
        }
        steps = await companion_pg.companion_task_steps_list(pool, run_id=run_id)
        for step in steps:
            await companion_pg.companion_task_step_update(
                pool,
                step_id=str(step["id"]),
                status="completed",
                output_payload={
                    "created_unified_content_id": created_id,
                    "reused_existing": reused_existing,
                },
            )
        updated = await _update_run(
            status="completed",
            result_payload={
                "created_unified_content_id": created_id,
                "reused_existing": reused_existing,
            },
        )
        file_name = str(plan.get("name") or "document")
        if reused_existing:
            reply = (
                f"Файл «{file_name}» уже был в EwaFile — записала новую версию (предыдущее тело во вкладке «Версии»)."
                if ru_locale
                else f"«{file_name}» already existed in EwaFile — saved a new version "
                f"(previous body is in the Versions tab)."
            )
        else:
            reply = _friendly_create_done_reply(locale_hint_line, file_name)
        return _confirm_result(
            updated,
            reply=reply,
            actions=[action],
        )

    if plan.get("kind") == "file_rename":
        from api.schemas.unified_content import build_content_update

        storage = await _storage_service_or_none()
        if storage is None:
            updated = await _update_run(
                status="failed",
                error_payload={"message": "storage_unavailable"},
            )
            return _confirm_result(
                updated,
                reply=(
                    "Не смогла переименовать: хранилище недоступно."
                    if ru_locale
                    else "I could not rename: storage is unavailable."
                ),
            )
        uc_raw = str(plan.get("unified_content_id") or "").strip()
        uid = str(plan.get("content_user_id") or "").strip()
        new_name = str(plan.get("new_name") or "").strip()
        if not uc_raw or not uid or not new_name:
            updated = await _update_run(
                status="failed",
                error_payload={"message": "invalid_rename_plan"},
            )
            return _confirm_result(
                updated,
                reply=(
                    "Не смогла переименовать: в задаче не хватает данных."
                    if ru_locale
                    else "I could not rename: the saved plan was incomplete."
                ),
            )
        try:
            await storage.update_content(UUID(uc_raw), uid, build_content_update(name=new_name[:512]))
        except Exception as exc:  # noqa: BLE001
            updated = await _update_run(
                status="failed",
                error_payload={"message": str(exc)[:500]},
            )
            return _confirm_result(
                updated,
                reply=(
                    f"Не смогла переименовать: {str(exc)[:180]}"
                    if ru_locale
                    else f"I could not rename: {str(exc)[:180]}"
                ),
            )
        steps = await companion_pg.companion_task_steps_list(pool, run_id=run_id)
        for step in steps:
            await companion_pg.companion_task_step_update(
                pool,
                step_id=str(step["id"]),
                status="completed",
                output_payload={"renamed_to": new_name},
            )
        updated = await _update_run(
            status="completed",
            result_payload={"renamed_unified_content_id": uc_raw, "new_name": new_name},
        )
        cm_action: dict[str, Any] = {
            "type": "open_app",
            "app_component": "ContentManagerPro",
            "content_manager_focus_unified_content_id": uc_raw,
            "rationale": "Focus renamed item in Content Manager",
        }
        old_l = str(plan.get("old_label") or "").strip() or uc_raw
        return _confirm_result(
            updated,
            reply=(
                f"Готова: переименовала «{old_l}» в «{new_name}»."
                if ru_locale
                else f"Done: renamed “{old_l}” to “{new_name}”."
            ),
            actions=[cm_action],
        )

    if plan.get("kind") == "file_delete":
        storage = await _storage_service_or_none()
        if storage is None:
            updated = await _update_run(
                status="failed",
                error_payload={"message": "storage_unavailable"},
            )
            return _confirm_result(
                updated,
                reply=(
                    "Не смогла удалить: хранилище недоступно."
                    if ru_locale
                    else "I could not delete: storage is unavailable."
                ),
            )
        uc_raw = str(plan.get("unified_content_id") or "").strip()
        uid = str(plan.get("content_user_id") or "").strip()
        label = str(plan.get("label") or "").strip() or uc_raw
        if not uc_raw or not uid:
            updated = await _update_run(
                status="failed",
                error_payload={"message": "invalid_delete_plan"},
            )
            return _confirm_result(
                updated,
                reply=(
                    "Не смогла удалить: в задаче не хватает данных."
                    if ru_locale
                    else "I could not delete: the saved plan was incomplete."
                ),
            )
        try:
            existing = await storage.get_content(UUID(uc_raw), uid)
            is_owner = str(existing.user_id) == str(uid)
            await storage.delete_content(UUID(uc_raw), uid)
        except PermissionError as exc:
            logger.warning(
                "[STEP] companion_task_confirm_file_delete_failed run_id=%s uc=%s actor=%s reason=%s",
                run_id,
                uc_raw,
                uid,
                str(exc)[:200],
            )
            updated = await _update_run(
                status="failed",
                error_payload={"message": str(exc)[:500], "code": "not_owner"},
            )
            return _confirm_result(
                updated,
                reply=(
                    f"Не смогла удалить «{label}»: это не твой файл (удалять можно только собственные)."
                    if ru_locale
                    else f'I could not delete "{label}": you can only delete files you own.'
                ),
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "[STEP] companion_task_confirm_file_delete_failed run_id=%s uc=%s actor=%s reason=%s",
                run_id,
                uc_raw,
                uid,
                str(exc)[:200],
            )
            updated = await _update_run(
                status="failed",
                error_payload={"message": str(exc)[:500]},
            )
            return _confirm_result(
                updated,
                reply=(
                    f"Не смогла удалить: {str(exc)[:180]}" if ru_locale else f"I could not delete: {str(exc)[:180]}"
                ),
            )
        steps = await companion_pg.companion_task_steps_list(pool, run_id=run_id)
        for step in steps:
            await companion_pg.companion_task_step_update(
                pool,
                step_id=str(step["id"]),
                status="completed",
                output_payload={"deleted_unified_content_id": uc_raw},
            )
        updated = await _update_run(
            status="completed",
            result_payload={"deleted_unified_content_id": uc_raw, "removed_from_library": not is_owner},
        )
        if is_owner:
            done_reply = (
                f"Готова: удалила «{label}» (файл помечен удалённым)."
                if ru_locale
                else f'Done: I deleted "{label}" (soft-deleted).'
            )
        else:
            done_reply = (
                f"Готова: убрала «{label}» из твоей библиотеки."
                if ru_locale
                else f'Done: I removed "{label}" from your library.'
            )
        return _confirm_result(updated, reply=done_reply)

    act = plan.get("action") if isinstance(plan, Mapping) else None
    if not isinstance(act, Mapping):
        updated = await _update_run(
            status="failed",
            error_payload={"message": "missing_saved_action"},
        )
        return _confirm_result(
            updated,
            reply=(
                "Не смогла продолжить: у задачи потеряно действие."
                if ru_locale
                else "I could not continue: the saved action is missing."
            ),
        )
    steps = await companion_pg.companion_task_steps_list(pool, run_id=run_id)
    for step in steps:
        await companion_pg.companion_task_step_update(
            pool,
            step_id=str(step["id"]),
            status="completed",
            output_payload={"action_emitted": True},
        )
    updated = await _update_run(
        status="completed",
        result_payload={"action_emitted": True},
    )
    return _confirm_result(
        updated,
        reply=_friendly_appended_reply(locale_hint_line),
        actions=[dict(act)],
    )


__all__ = ("apply_companion_task_run_confirmation",)
