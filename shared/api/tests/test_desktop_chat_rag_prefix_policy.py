# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Verify RAG context guard policy behavior in desktop chat enriched prompt assembly.
# Invariants:
# - `context_policy_applied` is true only when RAG blocks are injected.
# - Enriched prompt includes policy section before RAG fragments.
# Related:
# - api/services/desktop_chat/service_rag.py
# ---
"""Tests for desktop chat RAG prefix context policy."""

from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest

pytest.importorskip("sqlalchemy")

from api.services.desktop_chat import service_rag as desktop_chat_rag
from api.services.marketing_project_rag_service import MarketingRagChunk


def test_build_rag_prefix_adds_policy_guard_when_context_present() -> None:
    async def _run() -> None:
        with (
            patch.object(
                desktop_chat_rag,
                "search_desktop_chat_rag_chunks",
                AsyncMock(
                    return_value=[
                        MarketingRagChunk(
                            text="контекст из вложения",
                            ordinal=1,
                            content_id=str(uuid4()),
                            chunk_index=0,
                            source_label="doc.txt",
                        )
                    ]
                ),
            ),
            patch.object(
                desktop_chat_rag,
                "dedupe_desktop_chat_rag_chunks",
                lambda chunks, **_kwargs: chunks,
            ),
            patch.object(
                desktop_chat_rag,
                "load_context_source_lineage",
                AsyncMock(return_value={}),
            ),
        ):
            enriched, summary = await desktop_chat_rag.build_rag_prefix(
                db_pool=AsyncMock(),
                user_id=uuid4(),
                chat_id=uuid4(),
                project_id=None,
                use_project_rag=False,
                history=[],
                user_text="Что делать дальше?",
                defaults={"rag_top_k": 4, "rag_max_chunks_chars": 1000},
            )

        assert summary["chat_rag_chunks"] == 1
        assert summary["chat_rag_cap"] == 4
        assert summary["chat_rag_requested"] == 4
        assert summary["chat_rag_quality"]["chunks"] == 1
        assert summary["context_policy_applied"] is True
        assert summary["context_sources"][0]["citation_id"] == "C1"
        assert enriched.startswith("### Политика использования контекста")
        assert "### Материалы этого чата" in enriched
        assert "source=C1" in enriched
        assert "content_id=" not in enriched
        assert enriched.endswith("Что делать дальше?")

    asyncio.run(_run())


def test_build_rag_prefix_skips_policy_guard_without_context() -> None:
    async def _run() -> None:
        with patch.object(
            desktop_chat_rag,
            "search_desktop_chat_rag_chunks",
            AsyncMock(return_value=[]),
        ):
            enriched, summary = await desktop_chat_rag.build_rag_prefix(
                db_pool=AsyncMock(),
                user_id=uuid4(),
                chat_id=uuid4(),
                project_id=None,
                use_project_rag=False,
                history=[],
                user_text="Короткий вопрос",
                defaults={"rag_top_k": 4, "rag_max_chunks_chars": 1000},
            )

        assert summary["chat_rag_chunks"] == 0
        assert summary["project_vault_chunks"] == 0
        assert summary["chat_rag_quality"]["chunks"] == 0
        assert summary["project_vault_quality"]["chunks"] == 0
        assert summary["context_policy_applied"] is False
        assert enriched == "Короткий вопрос"

    asyncio.run(_run())


def test_build_rag_prefix_applies_chat_budget_cap_and_score_diagnostics() -> None:
    async def _run() -> None:
        chunks = [
            MarketingRagChunk(
                text=f"контекст {i}",
                ordinal=i + 1,
                content_id=str(uuid4()),
                chunk_index=i,
                source_label=f"doc-{i}.txt",
                score=0.9 - i * 0.1,
            )
            for i in range(4)
        ]
        with (
            patch.object(
                desktop_chat_rag,
                "search_desktop_chat_rag_chunks",
                AsyncMock(return_value=chunks),
            ),
            patch.object(
                desktop_chat_rag,
                "dedupe_desktop_chat_rag_chunks",
                lambda in_chunks, *, limit, **_kwargs: in_chunks[:limit],
            ),
            patch.object(
                desktop_chat_rag,
                "load_context_source_lineage",
                AsyncMock(return_value={}),
            ),
        ):
            _enriched, summary = await desktop_chat_rag.build_rag_prefix(
                db_pool=AsyncMock(),
                user_id=uuid4(),
                chat_id=uuid4(),
                project_id=None,
                use_project_rag=False,
                history=[],
                user_text="Собери контекст",
                defaults={
                    "rag_top_k": 8,
                    "rag_chat_max_chunks": 2,
                    "rag_max_chunks_chars": 1000,
                    "rag_rerank_enabled": False,
                },
            )

        assert summary["chat_rag_requested"] == 8
        assert summary["chat_rag_cap"] == 2
        assert summary["chat_rag_chunks"] == 2
        assert summary["chat_rag_quality"]["chunks"] == 2
        assert summary["chat_rag_quality"]["scored"] == 2
        assert summary["chat_rag_quality"]["score_max"] == 0.9
        assert summary["chat_rag_quality"]["score_min"] == 0.8
        assert summary["chat_rag_quality"]["score_avg"] == 0.85

    asyncio.run(_run())


def test_build_rag_prefix_enforces_project_rag_permission_boundary() -> None:
    async def _run() -> None:
        lead_check = AsyncMock()
        with (
            patch.object(
                desktop_chat_rag,
                "search_desktop_chat_rag_chunks",
                AsyncMock(return_value=[]),
            ),
            patch.object(
                desktop_chat_rag,
                "assert_project_marketing_lead",
                lead_check,
            ),
            patch.object(
                desktop_chat_rag,
                "search_marketing_project_rag_chunks",
                AsyncMock(return_value=[]),
            ),
        ):
            _enriched, summary = await desktop_chat_rag.build_rag_prefix(
                db_pool=AsyncMock(),
                user_id=uuid4(),
                chat_id=uuid4(),
                project_id=uuid4(),
                use_project_rag=True,
                history=[],
                user_text="Используй vault",
                defaults={"rag_top_k": 6},
            )
        lead_check.assert_awaited_once()
        assert summary["project_vault_requested"] is True
        assert summary["project_vault_cap"] == 6

    asyncio.run(_run())


def test_build_rag_prefix_limits_vault_chunks_per_content_id() -> None:
    async def _run() -> None:
        shared_content = str(uuid4())
        other_content = str(uuid4())
        vault_chunks = [
            MarketingRagChunk(
                text=f"shared chunk {i}",
                ordinal=i + 1,
                content_id=shared_content,
                chunk_index=i,
                source_label="shared.doc",
                score=0.95 - i * 0.05,
            )
            for i in range(4)
        ] + [
            MarketingRagChunk(
                text=f"other chunk {i}",
                ordinal=i + 5,
                content_id=other_content,
                chunk_index=i,
                source_label="other.doc",
                score=0.7 - i * 0.05,
            )
            for i in range(3)
        ]
        lead_check = AsyncMock()
        with (
            patch.object(
                desktop_chat_rag,
                "search_desktop_chat_rag_chunks",
                AsyncMock(return_value=[]),
            ),
            patch.object(
                desktop_chat_rag,
                "assert_project_marketing_lead",
                lead_check,
            ),
            patch.object(
                desktop_chat_rag,
                "search_marketing_project_rag_chunks",
                AsyncMock(return_value=vault_chunks),
            ),
            patch.object(
                desktop_chat_rag,
                "load_context_source_lineage",
                AsyncMock(return_value={}),
            ),
        ):
            _enriched, summary = await desktop_chat_rag.build_rag_prefix(
                db_pool=AsyncMock(),
                user_id=uuid4(),
                chat_id=uuid4(),
                project_id=uuid4(),
                use_project_rag=True,
                history=[],
                user_text="Используй vault",
                defaults={
                    "rag_top_k": 8,
                    "rag_project_vault_max_chunks": 8,
                    "rag_project_vault_max_per_content_id": 1,
                    "rag_max_chunks_chars": 4000,
                    "rag_rerank_enabled": False,
                },
            )

        assert summary["project_vault_max_per_content_id"] == 1
        assert summary["project_vault_chunks"] == 2
        assert summary["project_vault_quality"]["unique_content_ids"] == 2
        assert summary["context_policy_applied"] is True
        assert [source["citation_id"] for source in summary["context_sources"]] == ["P1", "P2"]
        assert "### Материалы проекта" in _enriched
        assert "content_id=" not in _enriched

    asyncio.run(_run())
