# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Agentic catalogue user id resolution for ToolContext.
# ---

from __future__ import annotations

from api.ewa_platform.agentic.adapters.tool_context import resolve_content_catalog_user_id


async def test_resolve_content_catalog_user_id_prefers_policy() -> None:
    class _Pool:
        async def acquire(self):  # noqa: ANN204
            raise AssertionError("DB must not be queried when policy stores catalog user id")

    uid = await resolve_content_catalog_user_id(
        _Pool(),  # type: ignore[arg-type]
        principal_id="kc-sub",
        oauth2_sub="kc-sub",
        policy_catalog_user_id="db-user-uuid",
    )
    assert uid == "db-user-uuid"
