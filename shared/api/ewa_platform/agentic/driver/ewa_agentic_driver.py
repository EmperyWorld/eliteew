# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# EWA agentic AMKA-style driver: READ snapshot, POLICY gate, OBSERVE after ACT.
# Invariants:
# - Does not import amka_core; wraps existing agentic tools and unified_content blocks.
# - Session FSM uses the EWA orchestration pool; content blocks always load from the
#   main ``DATABASE_URL`` pool (``unified_content``), never ``EWA_DATABASE_URL``.
# Related:
# - api/ewa_platform/agentic/kernel/loop.py
# - api/ewa_platform/companion/storage/catalog_pipeline.py
# ---

from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import Any
from uuid import UUID

import asyncpg

from api.ewa_platform.agentic.driver.protocol import (
    AgenticDriverSnapshot,
    AgenticPolicyDecision,
    AgenticPolicyDecisionKind,
)
from api.ewa_platform.agentic.goal_json import goal_text_from_goal_json, mission_anchor_from_goal_json
from api.ewa_platform.agentic.kernel.types import AgenticContext
from api.ewa_platform.agentic.tools.bridge import effective_session_tool_allowlist
from api.ewa_platform.agentic.tools.profiles import require_hitl_for_tool
from api.ewa_platform.companion.orchestration.tool_registry import REGISTRY
from api.services.unified_content.content_blocks import load_blocks_from_row

logger = logging.getLogger(__name__)


def _content_target_from_session(session: Mapping[str, Any]) -> tuple[str | None, int | None]:
    policy = session.get("policy_json")
    if not isinstance(policy, Mapping):
        return None, None
    raw = policy.get("unified_content_id") or policy.get("target_content_id")
    if not raw:
        return None, None
    version_raw = policy.get("unified_content_version")
    try:
        version = int(version_raw) if version_raw is not None else None
    except TypeError, ValueError:
        version = None
    return str(raw).strip() or None, version


def _expert_sessions_from_working_memory(session: Mapping[str, Any]) -> tuple[str, ...]:
    wm = session.get("working_memory_json")
    if not isinstance(wm, Mapping):
        return ()
    raw = wm.get("expert_session_ids")
    if not isinstance(raw, list):
        return ()
    return tuple(str(x).strip() for x in raw if str(x).strip())


async def resolve_unified_content_pool(
    content_pool: asyncpg.Pool | None = None,
) -> asyncpg.Pool | None:
    """Main app pool for ``unified_content`` (not the EWA agentic orchestration pool)."""
    if content_pool is not None:
        return content_pool
    try:
        from api.core.database_manager import get_asyncpg_pool

        return await get_asyncpg_pool()
    except Exception as exc:  # noqa: BLE001 — caller degrades to empty blocks
        logger.warning(
            "[STEP] agentic_driver_content_pool_skip err=%s",
            type(exc).__name__,
        )
        return None


class EwaAgenticDriver:
    """Think-as-a-Driver implementation for the EWA agentic substrate."""

    driver_key = "ewa_agentic"

    def __init__(
        self,
        pool: asyncpg.Pool | None = None,
        *,
        content_pool: asyncpg.Pool | None = None,
    ) -> None:
        # ``pool`` kept for call-site compatibility (agentic session DB); unused for blocks.
        self._pool = pool
        self._content_pool = content_pool

    async def read(
        self,
        *,
        session: Mapping[str, Any],
        ctx: AgenticContext | None = None,
    ) -> AgenticDriverSnapshot:
        session_id = str(session.get("id") or "")
        goal_json = session.get("goal_json")
        goal_text = goal_text_from_goal_json(goal_json) if isinstance(goal_json, Mapping) else ""
        anchor = mission_anchor_from_goal_json(goal_json) if isinstance(goal_json, Mapping) else None
        objectives = tuple(anchor.objectives) if anchor and anchor.objectives else ()
        tree_summary = dict(ctx.tree_summary) if ctx is not None else {}
        content_id, content_version = _content_target_from_session(session)
        blocks: list[dict[str, Any]] = []
        if content_id:
            blocks, content_version = await self._load_content_blocks(content_id, session, content_version)
        snapshot = AgenticDriverSnapshot(
            session_id=session_id,
            goal_text=goal_text,
            mission_objectives=objectives,
            tree_summary=tree_summary,
            content_blocks=tuple(blocks),
            unified_content_id=content_id,
            content_version=content_version,
            expert_session_ids=_expert_sessions_from_working_memory(session),
        )
        logger.info(
            "[STEP] agentic_driver_read session_id=%s goal_len=%s blocks=%s content_version=%s",
            session_id,
            len(goal_text),
            len(blocks),
            content_version,
        )
        return snapshot

    async def _load_content_blocks(
        self,
        content_id: str,
        session: Mapping[str, Any],
        version_hint: int | None,
    ) -> tuple[list[dict[str, Any]], int | None]:
        pool = await resolve_unified_content_pool(self._content_pool)
        if pool is None:
            return [], version_hint
        policy = session.get("policy_json")
        uid = ""
        if isinstance(policy, Mapping):
            uid = str(policy.get("content_catalog_user_id") or policy.get("catalog_user_id") or "").strip()
        if not uid:
            uid = str(session.get("principal_id") or "").strip()
        try:
            cid = UUID(content_id)
        except ValueError:
            return [], version_hint
        try:
            from api.ewa_platform.companion.storage.catalog_pipeline import (
                make_content_storage_service,
            )

            storage = make_content_storage_service(pool)
            row = await storage.get_content(cid, uid)
            version = int(row.version or 0)
            async with pool.acquire() as conn:
                db_row = await conn.fetchrow(
                    "SELECT content_payload, extracted_text FROM unified_content WHERE id = $1 AND deleted_at IS NULL",
                    cid,
                )
            payload = db_row.get("content_payload") if db_row else None
            extracted = db_row.get("extracted_text") if db_row else None
            loaded = load_blocks_from_row(payload, extracted)
            return [b.model_dump(mode="json") for b in loaded], version
        except Exception as exc:  # noqa: BLE001 — snapshot degrade
            logger.warning(
                "[STEP] agentic_driver_read_blocks_skip content_id=%s err=%s",
                content_id,
                type(exc).__name__,
            )
            return [], version_hint

    async def policy(
        self,
        *,
        session: Mapping[str, Any],
        snapshot: AgenticDriverSnapshot,
        tool_name: str,
        tool_args: Mapping[str, Any],
    ) -> AgenticPolicyDecision:
        name = str(tool_name or "").strip()
        if not name:
            return AgenticPolicyDecision(
                kind=AgenticPolicyDecisionKind.DENY,
                tool_name=name,
                allowed=False,
                reason="missing_tool_name",
            )
        if name not in REGISTRY:
            return AgenticPolicyDecision(
                kind=AgenticPolicyDecisionKind.DENY,
                tool_name=name,
                allowed=False,
                reason="tool_not_registered",
            )
        allowlist = effective_session_tool_allowlist(session)
        if allowlist is not None and name not in allowlist:
            return AgenticPolicyDecision(
                kind=AgenticPolicyDecisionKind.DENY,
                tool_name=name,
                allowed=False,
                reason="tool_not_in_allowlist",
            )
        if name == "call_expert_chat":
            return AgenticPolicyDecision(
                kind=AgenticPolicyDecisionKind.ALLOW,
                tool_name=name,
                allowed=True,
                reason="expert_chat_permitted",
                metadata={"lifecycle": "awaiting_expert_consultation"},
            )
        if require_hitl_for_tool(session.get("policy_json"), name):
            return AgenticPolicyDecision(
                kind=AgenticPolicyDecisionKind.REQUIRE_HITL,
                tool_name=name,
                allowed=False,
                reason="hitl_required",
            )
        _ = snapshot
        _ = tool_args
        return AgenticPolicyDecision(
            kind=AgenticPolicyDecisionKind.ALLOW,
            tool_name=name,
            allowed=True,
        )

    async def observe(
        self,
        *,
        session: Mapping[str, Any],
        ctx: AgenticContext | None = None,
        act_summary: str = "",
        act_tool: str | None = None,
    ) -> AgenticDriverSnapshot:
        snapshot = await self.read(session=session, ctx=ctx)
        logger.info(
            "[STEP] agentic_driver_observe session_id=%s act_tool=%s blocks=%s content_version=%s summary=%s",
            snapshot.session_id,
            act_tool or "-",
            len(snapshot.content_blocks),
            snapshot.content_version,
            (act_summary or "")[:120],
        )
        return snapshot
