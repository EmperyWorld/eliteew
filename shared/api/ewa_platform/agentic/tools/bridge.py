# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Bridge agentic Act phase to companion tool registry without modifying registry_core.
# Invariants:
# - All tool calls go through dispatch_tool_by_name; exceptions become AgenticActResult error.
# - Write tools with a known unified_content_id receive expected_version enrichment (AIP Phase 1).
# Related:
# - api/ewa_platform/companion/workflows/dag/tool_registry_adapter.py
# - api/services/unified_content/content_storage_service.py
# ---

from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import Any
from uuid import UUID

from api.ewa_platform.agentic.agentic_locale import (
    agentic_tool_denied_summary,
    agentic_tool_none_summary,
)
from api.ewa_platform.agentic.config import agentic_tool_allowlist
from api.ewa_platform.agentic.kernel.types import AgenticActResult
from api.ewa_platform.agentic.tools.profiles import resolve_tools_allowlist
from api.ewa_platform.companion.orchestration.tool_registry import (
    REGISTRY,
    ToolContext,
    dispatch_tool_by_name,
)

logger = logging.getLogger(__name__)

_WRITE_TOOLS_WITH_VERSION_LOCK = frozenset({"file_rewrite", "doc_append_block"})
_DOC_CREATE_CONFIRM_TOOLS = frozenset({"file_create", "file_save_text"})


async def _enrich_write_tool_expected_version(
    tool_name: str,
    args: dict[str, Any],
    ctx: ToolContext,
) -> dict[str, Any]:
    """Attach ``expected_version`` when the tool args already carry a target content id."""
    if tool_name not in _WRITE_TOOLS_WITH_VERSION_LOCK:
        return args
    if args.get("expected_version") is not None:
        return args
    cid_raw = args.get("unified_content_id") or args.get("content_id")
    uid = (ctx.content_catalog_user_id or "").strip()
    if not cid_raw or not uid:
        return args
    try:
        content_id = UUID(str(cid_raw).strip())
    except ValueError:
        return args
    from api.ewa_platform.companion.orchestration.tools.registry_helpers import _resolve_main_pool

    pool = await _resolve_main_pool(ctx)
    if pool is None:
        return args
    try:
        from api.ewa_platform.companion.storage.catalog_pipeline import make_content_storage_service

        storage = make_content_storage_service(pool)
        row = await storage.get_content(content_id, uid)
        version = int(row.version or 0)
    except Exception as exc:  # noqa: BLE001 — best-effort enrich; handler may fetch again
        logger.debug("[STEP] agentic_write_version_enrich_skip content_id=%s err=%s", cid_raw, exc)
        return args
    enriched = dict(args)
    enriched["expected_version"] = version
    logger.info(
        "[STEP] agentic_write_version_enrich tool=%s content_id=%s version=%s",
        tool_name,
        content_id,
        version,
    )
    return enriched


def _session_tool_allowlist(session: Mapping[str, Any]) -> frozenset[str] | None:
    policy = session.get("policy_json")
    if isinstance(policy, Mapping):
        profile_list = resolve_tools_allowlist(policy)
        if profile_list is not None:
            return profile_list
        raw = policy.get("tools")
        if isinstance(raw, list):
            names = {str(x).strip() for x in raw if str(x).strip()}
            return frozenset(names) if names else None
    return agentic_tool_allowlist()


def effective_session_tool_allowlist(session: Mapping[str, Any]) -> frozenset[str] | None:
    """Session tool allowlist with runtime-disabled tools removed from Think/Act."""

    from api.ewa_platform.companion.workflows.config import companion_wf_document_extractor_enabled

    base = _session_tool_allowlist(session)
    if companion_wf_document_extractor_enabled():
        return base
    if base is None:
        return frozenset(n for n in REGISTRY if n != "document_extractor")
    return frozenset(n for n in base if n != "document_extractor")


def extract_created_content_from_act_raw(
    raw: Mapping[str, Any] | None,
) -> tuple[str | None, str | None]:
    """Return ``(unified_content_id, display_name)`` from a tool ToolResult envelope when present."""

    if not isinstance(raw, Mapping):
        return None, None
    content_id = ""
    data = raw.get("data")
    if isinstance(data, Mapping):
        for key in ("unified_content_id", "created_unified_content_id", "content_id"):
            content_id = str(data.get(key) or "").strip()
            if content_id:
                break
    if not content_id:
        actions = raw.get("actions")
        if isinstance(actions, list):
            for action in actions:
                if not isinstance(action, Mapping):
                    continue
                if str(action.get("type") or "") != "open_app":
                    continue
                content_id = str(action.get("unified_content_id") or "").strip()
                if content_id:
                    break
    if not content_id:
        return None, None
    name = ""
    if isinstance(data, Mapping):
        name = str(data.get("document_name") or data.get("name") or "").strip()
    if not name:
        reply = str(raw.get("reply") or "").strip()
        if "«" in reply and "»" in reply:
            try:
                name = reply.split("«", 1)[1].split("»", 1)[0].strip()
            except IndexError:
                name = ""
    return content_id, (name or None)


def map_tool_result_to_act_result(
    tool_name: str,
    tool_result: Mapping[str, Any] | None,
    *,
    session: Mapping[str, Any] | None = None,
) -> AgenticActResult:
    if tool_result is None:
        return AgenticActResult(
            status="unhandled",
            summary=agentic_tool_none_summary(tool_name, session=session),
            tool_name=tool_name,
        )
    status = str(tool_result.get("status") or "error").strip().lower()
    reply = str(tool_result.get("reply") or "").strip()
    data = tool_result.get("data")
    summary = reply or str(data)[:500] if data else f"status={status}"
    task_run = tool_result.get("task_run")
    if status == "accepted":
        return AgenticActResult(status="accepted", summary=summary[:4000], tool_name=tool_name, raw=dict(tool_result))
    if status == "continue":
        return AgenticActResult(
            status="continue",
            summary=summary[:4000] or "compose_continue",
            tool_name=tool_name,
            raw=dict(tool_result),
        )
    if status in {"ok", "memory_append"}:
        if tool_name in _DOC_CREATE_CONFIRM_TOOLS and task_run is None:
            data_map = data if isinstance(data, Mapping) else {}
            if not str(data_map.get("unified_content_id") or data_map.get("created_unified_content_id") or "").strip():
                logger.info(
                    "[STEP] agentic_doc_create_noop_reject tool=%s summary=%s",
                    tool_name,
                    summary[:120],
                )
                return AgenticActResult(
                    status="error",
                    summary=reply[:4000] if reply else "doc_create_did_not_propose_storage",
                    tool_name=tool_name,
                    raw=dict(tool_result),
                )
        return AgenticActResult(status="ok", summary=summary[:4000], tool_name=tool_name, raw=dict(tool_result))
    if status == "unavailable":
        return AgenticActResult(status="error", summary=summary[:4000], tool_name=tool_name, raw=dict(tool_result))
    if status == "needs_confirm":
        return AgenticActResult(
            status="needs_confirm", summary=summary[:4000], tool_name=tool_name, raw=dict(tool_result)
        )
    return AgenticActResult(status="error", summary=summary[:4000], tool_name=tool_name, raw=dict(tool_result))


async def agentic_dispatch_tool(
    tool_name: str,
    args: dict[str, Any],
    ctx: ToolContext,
    *,
    session: Mapping[str, Any] | None = None,
) -> AgenticActResult:
    name = str(tool_name or "").strip()
    if not name:
        return AgenticActResult(status="error", summary="missing_tool_name")
    if name not in REGISTRY:
        return AgenticActResult(status="unregistered", summary=f"tool {name!r} not in registry", tool_name=name)

    allowlist = effective_session_tool_allowlist(session or {})
    if allowlist is not None and name not in allowlist:
        logger.info("[STEP] agentic_tool_denied tool=%s reason=allowlist", name)
        return AgenticActResult(
            status="denied",
            summary=agentic_tool_denied_summary(name, session=session or {}),
            tool_name=name,
        )

    safe_args = dict(args)
    safe_args.setdefault("_tool_router_bypass_line_match", True)
    # Outbound HITL: never trust planner-supplied confirm flags; router bypass ≠ send auth.
    if name in {"telegram_sender", "email_dispatcher"}:
        for key in ("confirmed", "outbound_confirmed", "_dag_outbound_authorized"):
            safe_args.pop(key, None)
    safe_args = await _enrich_write_tool_expected_version(name, safe_args, ctx)

    logger.info("[STEP] agentic_tool_dispatch name=%s", name)
    try:
        result = await dispatch_tool_by_name(name, safe_args, ctx)
    except Exception as exc:  # noqa: BLE001 — registry boundary
        logger.exception("[STEP] agentic_tool_dispatch_error name=%s err=%s", name, exc)
        return AgenticActResult(status="error", summary=str(exc)[:500], tool_name=name)

    return map_tool_result_to_act_result(name, result, session=session)
