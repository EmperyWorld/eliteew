# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Lock Desktop AI Chat evidence classification, citation formatting, and public metadata safety.
# Invariants:
# - Derived AI artifacts never receive project-document authority.
# - Prompt formatting and public records never expose storage identifiers.
# Related:
# - api/services/desktop_chat/context_evidence.py
# - api/services/desktop_chat/done_context_contract.py
# ---
"""Tests for the Desktop AI Chat provenance-aware evidence registry."""

from __future__ import annotations

from uuid import uuid4

from api.services.desktop_chat.context_evidence import (
    build_context_sources,
    format_context_chunks_for_prompt,
    public_context_sources,
    web_context_sources,
)
from api.services.marketing_project_rag_service import MarketingRagChunk


def _chunk(*, content_id: str, label: str, ordinal: int = 1) -> MarketingRagChunk:
    return MarketingRagChunk(
        text="Проверяемый фрагмент материала",
        ordinal=ordinal,
        content_id=content_id,
        chunk_index=ordinal - 1,
        source_label=label,
        score=0.87,
    )


def test_project_registry_separates_primary_and_derived_sources() -> None:
    project_id = str(uuid4())
    derived_id = str(uuid4())
    chunks = [
        _chunk(content_id=project_id, label="Рынок 2026"),
        _chunk(content_id=derived_id, label="Копия — Чат", ordinal=2),
    ]
    sources = build_context_sources(
        chunks,
        scope="project",
        lineage_by_content_id={
            project_id: {
                "title": "Исследование рынка",
                "source_service": "marketing_cabinet",
                "tags": ["research"],
            },
            derived_id: {
                "title": "Стратегия из предыдущего чата",
                "source_service": "desktop_ai_chat",
                "tags": ["desktop-ai-chat", "blueprint"],
            },
        },
    )

    assert [(source.citation_id, source.kind, source.authority) for source in sources] == [
        ("P1", "project_document", "project_material"),
        ("D1", "derived_ai_artifact", "derived"),
    ]
    assert public_context_sources(sources) == [
        {
            "citation_id": "P1",
            "kind": "project_document",
            "authority": "project_material",
            "title": "Исследование рынка",
        },
        {
            "citation_id": "D1",
            "kind": "derived_ai_artifact",
            "authority": "derived",
            "title": "Стратегия из предыдущего чата",
        },
    ]


def test_prompt_uses_public_citations_without_raw_rag_coordinates() -> None:
    content_id = str(uuid4())
    chunks = [_chunk(content_id=content_id, label="brief.md")]
    sources = build_context_sources(chunks, scope="chat")

    prompt = format_context_chunks_for_prompt(
        chunks,
        scope="chat",
        sources=sources,
        max_chars=2000,
    )

    assert "source=C1" in prompt
    assert "【C1】" in prompt
    assert content_id not in prompt
    assert "content_id=" not in prompt
    assert "chunk_index=" not in prompt
    assert "score=" not in prompt


def test_web_sources_keep_only_safe_absolute_urls() -> None:
    sources = web_context_sources(
        [
            {"title": "Report", "url": "https://example.com/report"},
            {"title": "Duplicate", "url": "https://example.com/report"},
            {"title": "Credential leak", "url": "https://user:pass@example.com/private"},
            {"title": "Script", "url": "javascript:alert(1)"},
            {"title": "Relative", "url": "/report"},
        ]
    )

    assert sources == [
        {
            "citation_id": "W1",
            "kind": "web",
            "authority": "external",
            "title": "Report",
            "url": "https://example.com/report",
        }
    ]
