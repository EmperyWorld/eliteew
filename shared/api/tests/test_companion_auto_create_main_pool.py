# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Regression lock — agentic auto-accept file create must use application DB pool
# (unified_content), never EWA companion_pool alone.
# Related:
# - api/ewa_platform/companion/orchestration/tools/handlers_files.py
# ---

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from api.ewa_platform.agentic.auto_accept_hitl import ARGS_FLAG
from api.ewa_platform.companion.orchestration.tools.handlers_files import _auto_create_document_result
from api.ewa_platform.companion.orchestration.tools.registry_types import ToolContext


@pytest.mark.asyncio
async def test_auto_create_uses_resolve_main_pool_not_companion_pool() -> None:
    companion = MagicMock(name="companion_pool")
    main = MagicMock(name="main_pool")
    created = MagicMock()
    created.id = "11111111-1111-1111-1111-111111111111"

    ctx = ToolContext(
        principal_id="p1",
        user_line="создай файл",
        content_catalog_user_id="22222222-2222-2222-2222-222222222222",
        oauth2_sub_for_content_alternate=None,
        main_pool=None,
        companion_pool=companion,
    )

    with (
        patch(
            "api.ewa_platform.companion.orchestration.tools.handlers_files._resolve_main_pool",
            AsyncMock(return_value=main),
        ) as resolve_main,
        patch(
            "api.ewa_platform.companion.storage.catalog_pipeline.make_content_storage_service",
        ) as make_storage,
        patch(
            "api.ewa_platform.companion.storage.catalog_pipeline.create_unified_companion_document",
            AsyncMock(return_value=created),
        ) as create_doc,
    ):
        storage = MagicMock()
        make_storage.return_value = storage
        out = await _auto_create_document_result(
            tool="file_create",
            branch="file_create",
            args={ARGS_FLAG: True},
            ctx=ctx,
            user_line="создай файл",
            name="note.md",
            body="hello",
            task_key="sess-1",
            folder_label="создай файл",
        )

    assert out is not None
    assert out.get("status") == "ok"
    resolve_main.assert_awaited_once()
    make_storage.assert_called_once_with(main)
    assert create_doc.await_args is not None
    assert create_doc.await_args.kwargs["content_user_id"] == "22222222-2222-2222-2222-222222222222"


@pytest.mark.asyncio
async def test_auto_create_skips_without_flag() -> None:
    ctx = ToolContext(
        principal_id="p1",
        user_line="x",
        content_catalog_user_id="22222222-2222-2222-2222-222222222222",
        oauth2_sub_for_content_alternate=None,
        companion_pool=MagicMock(),
    )
    out = await _auto_create_document_result(
        tool="file_create",
        branch="file_create",
        args={},
        ctx=ctx,
        user_line="x",
        name="note.md",
        body="hello",
        task_key=None,
        folder_label="x",
    )
    assert out is None
