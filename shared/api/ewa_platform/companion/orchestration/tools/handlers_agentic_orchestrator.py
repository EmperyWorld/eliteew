# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Agentic orchestrator companion tools (expert chat bridge, block-aware writes).
# Related:
# - api/ewa_platform/agentic/orchestration/expert_chat_bridge.py
# ---

from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import Any, Final
from uuid import UUID

from api.ewa_platform.companion.orchestration.tools.handlers_files import _resolve_main_pool
from api.ewa_platform.companion.orchestration.tools.registry_types import ToolContext, ToolHandler, ToolResult

logger = logging.getLogger(__name__)


async def _handle_call_expert_chat(args: Mapping[str, Any], ctx: ToolContext) -> ToolResult | None:
    from api.ewa_platform.agentic.orchestration.expert_chat_bridge import run_agentic_expert_chat
    from api.ewa_platform.companion.storage.catalog_pipeline import make_content_storage_service
    from api.services.unified_content.content_blocks import new_content_block
    from api.services.unified_content.content_storage_service import ContentVersionConflictError

    uid_raw = (ctx.content_catalog_user_id or "").strip()
    if not uid_raw:
        return None
    prompt = str(args.get("user_line") or args.get("prompt") or args.get("task_context") or "").strip()
    if not prompt:
        return ToolResult(tool="call_expert_chat", status="error", reply="Missing user_line/prompt for expert chat.")
    roles_raw = args.get("expert_roles") or args.get("heroes") or args.get("hero_ids") or []
    expert_roles = [str(r).strip() for r in roles_raw if str(r).strip()] if isinstance(roles_raw, list) else []
    agentic_session_id = str(args.get("_agentic_session_id") or args.get("agentic_session_id") or "").strip()
    pool = await _resolve_main_pool(ctx)
    if pool is None:
        return ToolResult(tool="call_expert_chat", status="unavailable", reply="Database pool unavailable.")

    try:
        user_id = UUID(uid_raw)
    except ValueError:
        return ToolResult(tool="call_expert_chat", status="error", reply="Invalid catalog user id.")

    plan_titles_raw = args.get("plan_titles")
    plan_titles = (
        [str(t).strip() for t in plan_titles_raw if str(t).strip()] if isinstance(plan_titles_raw, list) else None
    )
    result = await run_agentic_expert_chat(
        pool,
        user_id=user_id,
        company_id=None,
        project_id=None,
        agentic_session_id=agentic_session_id or "agentic",
        user_prompt=prompt,
        expert_roles=expert_roles,
        blueprint_template_id=str(args.get("blueprint_template_id") or "") or None,
        goal_text=str(args.get("goal_text") or args.get("mission_goal") or "").strip() or None,
        plan_titles=plan_titles,
        use_web_search=bool(args.get("use_web_search") is True)
        or str(args.get("use_web_search") or "").strip().lower() in ("1", "true", "yes", "on"),
    )
    expert_chat_id = str(result.get("expert_chat_id") or "")
    output_text = str(result.get("output_text") or "").strip()
    if result.get("error"):
        logger.info(
            "[STEP] call_expert_chat_error agentic_session_id=%s expert_chat_id=%s err=%s",
            agentic_session_id,
            expert_chat_id,
            result.get("error"),
        )
        return ToolResult(
            tool="call_expert_chat",
            status="error",
            reply=str(result.get("error"))[:500],
            data={"expert_chat_id": expert_chat_id, "error_code": "expert_chat_failed"},
        )

    block_id: str | None = None
    content_id_raw = str(args.get("unified_content_id") or args.get("content_id") or "").strip()
    append_to_doc = args.get("append_to_document", True)
    if content_id_raw and output_text and append_to_doc is not False:
        author_role = str(args.get("author_role") or expert_roles[0] if expert_roles else "expert").strip() or "expert"
        try:
            content_id = UUID(content_id_raw)
            storage = make_content_storage_service(pool)
            meta = await storage.get_content(content_id, uid_raw)
            version = int(meta.version or 0)
            block = new_content_block(content=output_text, author_role=author_role)
            await storage.append_to_content(
                content_id,
                uid_raw,
                [block.model_dump(mode="json")],
                expected_version=version,
            )
            block_id = str(block.id)
            logger.info(
                "[STEP] call_expert_chat_block_appended agentic_session_id=%s expert_chat_id=%s "
                "content_id=%s block_id=%s role=%s",
                agentic_session_id,
                expert_chat_id,
                content_id,
                block_id,
                author_role,
            )
        except ContentVersionConflictError as exc:
            logger.info(
                "[STEP] call_expert_chat_version_conflict agentic_session_id=%s expert_chat_id=%s "
                "expected=%s current=%s",
                agentic_session_id,
                expert_chat_id,
                exc.expected_version,
                exc.current_version,
            )
            return ToolResult(
                tool="call_expert_chat",
                status="error",
                reply="Document version changed during expert chat — refresh and retry.",
                data={
                    "expert_chat_id": expert_chat_id,
                    "error_code": "version_conflict",
                    "expected_version": exc.expected_version,
                    "current_version": exc.current_version,
                },
            )
        except (PermissionError, ValueError) as exc:
            logger.info("call_expert_chat_append_denied content_id=%s err=%s", content_id_raw, exc)
            return ToolResult(
                tool="call_expert_chat",
                status="error",
                reply="Could not append expert output to document.",
                data={"expert_chat_id": expert_chat_id, "error_code": "append_denied"},
            )

    logger.info(
        "[STEP] call_expert_chat_success agentic_session_id=%s expert_chat_id=%s block_id=%s roles=%s",
        agentic_session_id,
        expert_chat_id,
        block_id or "-",
        ",".join(expert_roles) or "default",
    )
    from api.ewa_platform.agentic.kernel.visible_text import user_facing_expert_chat_reply

    return ToolResult(
        tool="call_expert_chat",
        status="ok",
        reply=user_facing_expert_chat_reply(output_text),
        data={
            "expert_chat_id": expert_chat_id,
            "block_id": block_id,
            "expert_roles": expert_roles,
            "output_preview": output_text[:500],
            "output_text": output_text[:24_000],
        },
    )


HANDLERS: Final[dict[str, ToolHandler]] = {
    "call_expert_chat": _handle_call_expert_chat,
}
