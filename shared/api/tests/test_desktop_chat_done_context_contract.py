# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Contract tests for SSE done.context summary shape shared with the frontend.
# Invariants:
# - build_rag_prefix baseline summary satisfies validate_done_context_summary.
# Related:
# - api/services/desktop_chat/done_context_contract.py
# - api/tests/fixtures/desktop_chat_done_context_golden.json
# ---

"""Desktop AI Chat done.context contract tests."""

from __future__ import annotations

import asyncio
import json
from pathlib import Path
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest

pytest.importorskip("sqlalchemy")

from api.services.desktop_chat import service as desktop_chat_service
from api.services.desktop_chat import service_rag as desktop_chat_service_rag
from api.services.desktop_chat.done_context_contract import (
    iter_sse_data_payloads,
    validate_done_context_in_sse_file,
    validate_done_context_summary,
)
from api.services.marketing_project_rag_service import MarketingRagChunk

_GOLDEN_PATH = Path(__file__).parent / "fixtures" / "desktop_chat_done_context_golden.json"
_FOOTNOTE_GOLDEN_PATH = Path(__file__).parent / "fixtures" / "desktop_chat_context_footnote_golden.json"
_SSE_GOLDEN_PATH = Path(__file__).parent / "fixtures" / "desktop_chat_done_context_sse_golden.sse"


def test_golden_done_context_fixture_validates() -> None:
    row = json.loads(_GOLDEN_PATH.read_text(encoding="utf-8"))
    assert isinstance(row, dict)
    errors = validate_done_context_summary(row)
    assert errors == []
    assert row.get("project_vault_requested") is False


def test_footnote_golden_done_context_fixture_validates() -> None:
    row = json.loads(_FOOTNOTE_GOLDEN_PATH.read_text(encoding="utf-8"))
    assert isinstance(row, dict)
    errors = validate_done_context_summary(row)
    assert errors == []
    assert row["project_vault_requested"] is True
    assert row["context_policy_applied"] is True


def test_build_rag_prefix_empty_summary_matches_contract() -> None:
    async def _run() -> dict[str, object]:
        with (
            patch.object(
                desktop_chat_service_rag,
                "search_desktop_chat_rag_chunks",
                AsyncMock(return_value=[]),
            ),
            patch(
                "api.services.chat_memory_service.search_memory",
                AsyncMock(return_value=[]),
            ),
        ):
            _text, summary = await desktop_chat_service.build_rag_prefix(
                db_pool=AsyncMock(),
                user_id=uuid4(),
                chat_id=uuid4(),
                project_id=None,
                use_project_rag=False,
                history=[],
                user_text="hello",
                defaults={"rag_top_k": 12},
            )
        return summary

    summary = asyncio.run(_run())
    errors = validate_done_context_summary(summary)
    assert errors == []
    assert summary["context_policy_applied"] is False
    assert summary["chat_attachment_chunks"] == 0
    assert summary["chat_memory_hits"] == 0
    assert summary["history_messages_used"] == 0


def test_build_rag_prefix_with_chunks_sets_policy_flag() -> None:
    async def _run() -> dict[str, object]:
        with (
            patch.object(
                desktop_chat_service_rag,
                "search_desktop_chat_rag_chunks",
                AsyncMock(
                    return_value=[
                        MarketingRagChunk(
                            text="fact",
                            ordinal=1,
                            content_id=str(uuid4()),
                            chunk_index=0,
                            source_label="doc.txt",
                        )
                    ]
                ),
            ),
            patch.object(
                desktop_chat_service_rag,
                "dedupe_desktop_chat_rag_chunks",
                lambda chunks, **_kwargs: chunks,
            ),
            patch.object(
                desktop_chat_service_rag,
                "load_context_source_lineage",
                AsyncMock(return_value={}),
            ),
            patch(
                "api.services.chat_memory_service.search_memory",
                AsyncMock(return_value=[]),
            ),
        ):
            _text, summary = await desktop_chat_service.build_rag_prefix(
                db_pool=AsyncMock(),
                user_id=uuid4(),
                chat_id=uuid4(),
                project_id=None,
                use_project_rag=False,
                history=[],
                user_text="hello",
                defaults={"rag_top_k": 12, "rag_rerank_enabled": False},
            )
        return summary

    summary = asyncio.run(_run())
    errors = validate_done_context_summary(summary)
    assert errors == []
    assert summary["context_policy_applied"] is True
    assert summary["chat_rag_chunks"] == 1
    assert summary["chat_attachment_chunks"] == 1
    assert summary["context_sources"] == [
        {
            "citation_id": "C1",
            "kind": "chat_attachment",
            "authority": "user_material",
            "title": "doc.txt",
        }
    ]


def test_done_context_accepts_safe_additive_evidence_records() -> None:
    summary = json.loads(_GOLDEN_PATH.read_text(encoding="utf-8"))
    summary["context_sources"] = [
        {
            "citation_id": "P1",
            "kind": "project_document",
            "authority": "project_material",
            "title": "Исследование рынка",
        },
        {
            "citation_id": "W1",
            "kind": "web",
            "authority": "external",
            "title": "Industry report",
            "url": "https://example.com/report",
        },
    ]
    assert validate_done_context_summary(summary) == []


def test_done_context_rejects_storage_ids_and_unsafe_urls() -> None:
    summary = json.loads(_GOLDEN_PATH.read_text(encoding="utf-8"))
    summary["context_sources"] = [
        {
            "citation_id": "P1",
            "kind": "project_document",
            "authority": "project_material",
            "title": "Leak",
            "content_id": str(uuid4()),
        },
        {
            "citation_id": "W1",
            "kind": "web",
            "authority": "external",
            "title": "Unsafe",
            "url": "javascript:alert(1)",
        },
    ]
    errors = validate_done_context_summary(summary)
    assert any("forbidden keys: content_id" in error for error in errors)
    assert any("url unsafe" in error for error in errors)


def test_iter_sse_data_payloads_parses_done_event() -> None:
    ctx = json.loads(_GOLDEN_PATH.read_text(encoding="utf-8"))
    text = f"data: {json.dumps({'event': 'done', 'context': ctx})}\n\n"
    payloads = iter_sse_data_payloads(text)
    assert len(payloads) == 1
    assert payloads[0]["event"] == "done"


def test_validate_done_context_in_sse_file_accepts_golden(tmp_path: Path) -> None:
    ctx = json.loads(_GOLDEN_PATH.read_text(encoding="utf-8"))
    sse_file = tmp_path / "stream.sse"
    sse_file.write_text(
        f": keep-alive\n\ndata: {json.dumps({'event': 'done', 'context': ctx})}\n\n",
        encoding="utf-8",
    )
    parsed = validate_done_context_in_sse_file(sse_file, case_label="unit")
    assert parsed["context_policy_applied"] is False


def test_validate_done_context_in_sse_file_rejects_missing_context(tmp_path: Path) -> None:
    sse_file = tmp_path / "bad.sse"
    sse_file.write_text('data: {"event": "done"}\n\n', encoding="utf-8")
    with pytest.raises(ValueError, match="done.context missing"):
        validate_done_context_in_sse_file(sse_file, case_label="unit")


def test_validate_done_context_in_shared_sse_golden_fixture() -> None:
    parsed = validate_done_context_in_sse_file(_SSE_GOLDEN_PATH, case_label="golden")
    assert parsed["project_vault_requested"] is True
    assert parsed["chat_rag_chunks"] == 2
    assert parsed["project_vault_chunks"] == 4
    assert parsed["context_policy_applied"] is True


def test_shared_sse_golden_fixture_summary_fields() -> None:
    """Mirror assert CLI --json-summary fields used by offline eval golden gate."""
    parsed = validate_done_context_in_sse_file(_SSE_GOLDEN_PATH, case_label="golden")
    summary = {
        "done_context_keys": sorted(parsed.keys()),
        "project_vault_requested": parsed.get("project_vault_requested"),
        "context_policy_applied": parsed.get("context_policy_applied"),
        "chat_rag_chunks": parsed.get("chat_rag_chunks"),
        "project_vault_chunks": parsed.get("project_vault_chunks"),
    }
    assert summary["project_vault_requested"] is True
    assert summary["context_policy_applied"] is True
    assert summary["chat_rag_chunks"] == 2
    assert summary["project_vault_chunks"] == 4
    assert "chat_rag_quality" in summary["done_context_keys"]
