# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Outbound communication tools: ``telegram_sender``, ``email_dispatcher``.
# Invariants:
# - Direct chat/agent invoke requires HITL (needs_confirm) unless ``_dag_outbound_authorized``,
#   confirmed/outbound_confirmed, or agentic auto-accept. Router bypass alone never authorizes send.
# - DAG/user workflows keep their own confirm_gate policy and set ``_dag_outbound_authorized``.
# Related:
# - api/ewa_platform/companion/orchestration/tools/registry_core.py
# - api/ewa_platform/companion/orchestration/task_run_confirm.py
# ---
"""EWA companion tool registry handlers — comms."""

from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import Any, Final

from api.ewa_platform.companion.orchestration.tools.registry_helpers import (
    _resolve_main_pool,
    companion_pg,
)
from api.ewa_platform.companion.orchestration.tools.registry_types import (
    ToolContext,
    ToolHandler,
    ToolResult,
)

logger = logging.getLogger(__name__)


def _truthy(raw: Any) -> bool:
    if isinstance(raw, bool):
        return raw
    return str(raw or "").strip().casefold() in {"1", "true", "yes", "on", "confirmed"}


def _outbound_may_send_now(args: Mapping[str, Any]) -> bool:
    """True when upstream already gated or the caller explicitly confirmed send.

    Router bypass alone is NOT authorization — agentic always sets it so tools skip
    NL regex gates. DAG must set ``_dag_outbound_authorized`` after confirm_gate.
    """

    if _truthy(args.get("_dag_outbound_authorized")):
        return True
    if _truthy(args.get("confirmed")) or _truthy(args.get("outbound_confirmed")):
        return True
    try:
        from api.ewa_platform.agentic.auto_accept_hitl import args_request_auto_accept

        if args_request_auto_accept(args):
            return True
    except Exception as exc:  # noqa: BLE001 — fail closed to HITL
        logger.debug("[STEP] companion_outbound_auto_accept_check_skip err=%s", exc)
    return False


async def _resolve_telegram_chat_id(args: Mapping[str, Any], ctx: ToolContext) -> str | None:
    raw_chat_id = args.get("chat_id")
    if raw_chat_id is not None and str(raw_chat_id).strip():
        return str(raw_chat_id).strip()

    auth_user = ctx.auth_user
    user_id = getattr(auth_user, "id", None) if auth_user is not None else None
    if user_id is None:
        return None

    pool = await _resolve_main_pool(ctx)
    row = await pool.fetchrow(
        """
        SELECT telegram_user_id
        FROM telegram_users
        WHERE user_id = $1::uuid
        ORDER BY updated_at DESC NULLS LAST
        LIMIT 1
        """,
        user_id,
    )
    if row is None:
        return None
    return str(row["telegram_user_id"] or "").strip() or None


async def _begin_outbound_confirm(
    *,
    tool: str,
    kind: str,
    ctx: ToolContext,
    user_line: str,
    plan: dict[str, Any],
    preview_reply: str,
) -> ToolResult:
    pool = ctx.companion_pool
    if pool is None:
        return ToolResult(
            tool=tool,
            status="error",
            reply="Не могу запросить подтверждение: очередь Ассистента недоступна.",
            actions=[],
            data={"delivery_status": "failed", "error": "companion_pool_unavailable"},
        )
    run = await companion_pg.companion_task_run_create(
        pool,
        principal_id=ctx.principal_id,
        intent_kind=kind,
        user_message=user_line or tool,
        plan_payload=plan,
        confirmation_state={"question": "confirm_outbound"},
        status="awaiting_confirmation",
    )
    await companion_pg.companion_task_step_create(
        pool,
        run_id=str(run["id"]),
        step_index=1,
        step_kind=f"{kind}_proposal",
        title=f"Confirm {tool}",
        input_payload={"tool": tool},
        status="awaiting_confirmation",
    )
    logger.info("[STEP] companion_outbound_needs_confirm tool=%s run_id=%s", tool, str(run.get("id") or "")[:36])
    return ToolResult(
        tool=tool,
        status="needs_confirm",
        reply=preview_reply,
        actions=[],
        data={"orchestration_branch": tool, "awaiting_confirmation": True},
        task_run=run,
    )


async def _handle_telegram_sender(args: Mapping[str, Any], ctx: ToolContext) -> ToolResult | None:
    from api.ewa_platform.companion.outbound.telegram_send import send_telegram_message
    from api.ewa_platform.companion.workflows.config import companion_wf_telegram_sender_enabled

    if not companion_wf_telegram_sender_enabled():
        return ToolResult(
            tool="telegram_sender",
            status="error",
            reply="Telegram outbound is disabled (EWA_COMPANION_WF_TELEGRAM_SENDER_ENABLED).",
            actions=[],
            data={"delivery_status": "failed", "error": "feature_disabled"},
        )

    message_text = str(
        args.get("message_text") or args.get("text") or args.get("reply") or args.get("body") or ""
    ).strip()
    chat_id = await _resolve_telegram_chat_id(args, ctx)
    user_line = str(args.get("user_line") or ctx.user_line or "").strip()
    if not chat_id:
        return ToolResult(
            tool="telegram_sender",
            status="error",
            reply="Укажи chat_id или привяжи Telegram к аккаунту.",
            actions=[],
            data={"delivery_status": "failed", "error": "chat_id_required"},
        )
    if not message_text:
        return ToolResult(
            tool="telegram_sender",
            status="error",
            reply="Нужен текст сообщения (message_text).",
            actions=[],
            data={"delivery_status": "failed", "chat_id": chat_id, "error": "message_text_required"},
        )

    if not _outbound_may_send_now(args):
        preview = message_text if len(message_text) <= 240 else f"{message_text[:237]}…"
        return await _begin_outbound_confirm(
            tool="telegram_sender",
            kind="telegram_send",
            ctx=ctx,
            user_line=user_line,
            plan={
                "kind": "telegram_send",
                "chat_id": chat_id,
                "message_text": message_text[:32_000],
            },
            preview_reply=(f"Подготовила сообщение в Telegram (chat {chat_id}): «{preview}». Подтверди отправку?"),
        )

    result = await send_telegram_message(chat_id=chat_id, message_text=message_text)
    data = result.as_dict()
    if not result.ok:
        return ToolResult(
            tool="telegram_sender",
            status="error",
            reply=f"Telegram: не удалось отправить ({data.get('error') or 'failed'}).",
            actions=[],
            data=data,
        )
    return ToolResult(
        tool="telegram_sender",
        status="ok",
        reply="Сообщение отправлено в Telegram.",
        actions=[],
        data=data,
    )


async def _handle_email_dispatcher(args: Mapping[str, Any], ctx: ToolContext) -> ToolResult | None:
    from api.ewa_platform.companion.outbound.email_send import send_workflow_email
    from api.ewa_platform.companion.workflows.config import companion_wf_email_dispatcher_enabled

    if not companion_wf_email_dispatcher_enabled():
        return ToolResult(
            tool="email_dispatcher",
            status="error",
            reply="Email outbound is disabled (EWA_COMPANION_WF_EMAIL_DISPATCHER_ENABLED).",
            actions=[],
            data={"delivery_status": "failed", "error": "feature_disabled"},
        )

    to = str(args.get("to") or args.get("email") or "").strip()
    subject = str(args.get("subject") or "").strip()
    body = str(args.get("body") or args.get("text") or args.get("reply") or "").strip()
    html = str(args.get("html") or "").strip() or None
    user_line = str(args.get("user_line") or ctx.user_line or "").strip()
    if not to or not (body or html):
        return ToolResult(
            tool="email_dispatcher",
            status="error",
            reply="Нужны адрес (to) и текст письма (body).",
            actions=[],
            data={"delivery_status": "failed", "error": "to_and_body_required"},
        )

    if not _outbound_may_send_now(args):
        subj_preview = subject or "(без темы)"
        return await _begin_outbound_confirm(
            tool="email_dispatcher",
            kind="email_send",
            ctx=ctx,
            user_line=user_line,
            plan={
                "kind": "email_send",
                "to": to[:512],
                "subject": subject[:512],
                "body": body[:32_000],
                "html": (html or "")[:32_000] or None,
            },
            preview_reply=(f"Подготовила письмо на {to}, тема «{subj_preview}». Подтверди отправку?"),
        )

    result = await send_workflow_email(to=to, subject=subject, body=body, html=html)
    data = result.as_dict()
    if not result.ok:
        return ToolResult(
            tool="email_dispatcher",
            status="error",
            reply=f"Email: не удалось отправить ({data.get('error') or 'failed'}).",
            actions=[],
            data=data,
        )
    return ToolResult(
        tool="email_dispatcher",
        status="ok",
        reply="Письмо отправлено.",
        actions=[],
        data=data,
    )


HANDLERS: Final[dict[str, ToolHandler]] = {
    "telegram_sender": _handle_telegram_sender,
    "email_dispatcher": _handle_email_dispatcher,
}
