# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Regression tests for IMC result readiness and Marketing Project RAG source indexing helpers.
# Keeps long embedding work out of synchronous UI mutations.
# Invariants:
# - Short/partial IMC results must not be imported into project RAG.
# - Disabled RAG sources must not be reindexed by stale background tasks.
# Related:
# - api.services.marketing_project_rag_sources_service
# - api.services.marketing_cabinet.amka_plan_import_sanitize
# ---
"""Единый критерий готовности IMC к upsert в project RAG и префлайт плана AMKA."""

from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from api.services.marketing_cabinet.amka_plan_import_sanitize import (
    sanitize_amka_plan_import_analysis_operations,
)
from api.services.marketing_project_rag_service import MIN_EXTRACTED_TEXT_CHARS
from api.services.marketing_project_rag_sources_service import (
    IMC_IMPORT_NOT_READY_NO_ROW,
    IMC_IMPORT_NOT_READY_RESULT_TEXT_TOO_SHORT,
    imc_run_row_ready_for_project_rag_upsert,
    reindex_marketing_rag_source_if_included,
)


@pytest.mark.unit
def test_imc_run_ready_rejects_none_row() -> None:
    ok, reason = imc_run_row_ready_for_project_rag_upsert(None)
    assert ok is False
    assert reason == IMC_IMPORT_NOT_READY_NO_ROW


@pytest.mark.unit
def test_imc_run_ready_rejects_short_text() -> None:
    body = "x" * (MIN_EXTRACTED_TEXT_CHARS - 1)
    ok, reason = imc_run_row_ready_for_project_rag_upsert({"result_text": body})
    assert ok is False
    assert reason == IMC_IMPORT_NOT_READY_RESULT_TEXT_TOO_SHORT


@pytest.mark.unit
def test_imc_run_ready_accepts_min_length_text() -> None:
    body = "x" * MIN_EXTRACTED_TEXT_CHARS
    ok, reason = imc_run_row_ready_for_project_rag_upsert({"result_text": body})
    assert ok is True
    assert reason is None


@pytest.mark.unit
def test_sanitize_prunes_import_when_text_too_short() -> None:
    async def _run() -> None:
        pid = uuid4()
        rid = uuid4()
        conn = MagicMock()
        row_dict = {"id": rid, "result_text": "x" * 5, "status": "completed"}
        conn.fetch = AsyncMock(return_value=[row_dict])

        pool = MagicMock()
        pool.acquire = MagicMock()
        pool.acquire.return_value.__aenter__ = AsyncMock(return_value=conn)
        pool.acquire.return_value.__aexit__ = AsyncMock(return_value=None)

        tasks = [
            {
                "section_key": "evidence",
                "operations": [
                    {
                        "kind": "import_analysis_artifact",
                        "source_ref": {"type": "imc_run", "id": str(rid)},
                    },
                ],
            }
        ]
        out = await sanitize_amka_plan_import_analysis_operations(
            pool,
            tasks=tasks,
            project_id=pid,
            run_id=uuid4(),
        )
        assert out[0]["operations"] == []

    asyncio.run(_run())


@pytest.mark.unit
def test_sanitize_keeps_import_when_text_long_enough() -> None:
    async def _run() -> None:
        pid = uuid4()
        rid = uuid4()
        conn = MagicMock()
        long_text = "y" * MIN_EXTRACTED_TEXT_CHARS
        row_dict = {"id": rid, "result_text": long_text, "status": "completed"}
        conn.fetch = AsyncMock(return_value=[row_dict])

        pool = MagicMock()
        pool.acquire = MagicMock()
        pool.acquire.return_value.__aenter__ = AsyncMock(return_value=conn)
        pool.acquire.return_value.__aexit__ = AsyncMock(return_value=None)

        op = {
            "kind": "import_analysis_artifact",
            "source_ref": {"type": "imc_run", "id": str(rid)},
        }
        tasks = [{"section_key": "evidence", "operations": [op]}]
        out = await sanitize_amka_plan_import_analysis_operations(
            pool,
            tasks=tasks,
            project_id=pid,
            run_id=None,
        )
        assert len(out[0]["operations"]) == 1
        assert out[0]["operations"][0]["kind"] == "import_analysis_artifact"

    asyncio.run(_run())


@pytest.mark.unit
def test_reindex_skips_disabled_source_after_queueing() -> None:
    async def _run() -> None:
        cid = uuid4()
        conn = MagicMock()
        conn.fetchrow = AsyncMock(return_value={"marketing_rag_included": False, "deleted_at": None})

        pool = MagicMock()
        pool.acquire = MagicMock()
        pool.acquire.return_value.__aenter__ = AsyncMock(return_value=conn)
        pool.acquire.return_value.__aexit__ = AsyncMock(return_value=None)

        with patch(
            "api.services.marketing_project_rag_sources_service.index_unified_content_marketing_rag",
            new_callable=AsyncMock,
        ) as mock_index:
            ok = await reindex_marketing_rag_source_if_included(pool, content_id=cid)  # type: ignore[arg-type]

        assert ok is False
        mock_index.assert_not_awaited()

    asyncio.run(_run())
