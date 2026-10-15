#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Regression coverage for S3 vector cutover: semantic/document paths must target Qdrant-first runtime.
# Invariants:
# - Semantic search defaults to Qdrant; Chroma backend is retired (ES-only degrade, structured log).
# - Document embedding persistence uses Qdrant upsert and no direct Chroma client references.
# Related:
# - api/services/unified_content/semantic_search_service.py
# - api/services/unified_content/qdrant_migration_job.py
# - api/core/database_manager.py
# ---
"""S3 Qdrant cutover regression tests."""

from __future__ import annotations

from pathlib import Path

API_ROOT = Path(__file__).resolve().parents[1]


def _read(rel_path: str) -> str:
    return (API_ROOT / rel_path).read_text(encoding="utf-8")


def test_semantic_search_service_qdrant_first_chroma_retired() -> None:
    source = _read("services/unified_content/semantic_search_service.py")
    assert 'UNIFIED_VECTOR_READ_BACKEND", VECTOR_BACKEND_QDRANT' in source
    assert "query_points(" in source
    assert "def _build_qdrant_filter(" in source
    assert "unified_content_search_chroma_retired" in source
    assert "async def _vector_search_chroma" not in source
    assert "chromadb_service" not in source


def test_content_search_service_es_only_no_chroma() -> None:
    source = _read("services/unified_content/content_search_service.py")
    assert "Chroma is not a living backend" in source
    assert "chromadb" not in source.lower()


def test_unified_content_qdrant_service_chroma_not_living() -> None:
    source = _read("services/unified_content/unified_content_qdrant_service.py")
    assert "Chroma is retired" in source


def test_qdrant_migration_job_uses_runtime_indexer() -> None:
    source = _read("services/unified_content/qdrant_migration_job.py")
    assert "index_unified_content_qdrant" in source
    assert "UnifiedContentQdrantMigrationJob" in source
    assert "FROM unified_content" in source


def test_database_manager_initializes_and_exposes_qdrant_client() -> None:
    source = _read("core/database_manager.py")
    assert 'ENABLE_QDRANT = os.environ.get("ENABLE_QDRANT", "true")' in source
    assert "if DatabaseFeatures.ENABLE_QDRANT and QDRANT_AVAILABLE and await self._init_qdrant()" in source
    assert "def get_qdrant_client(self)" in source
    assert 'self.health_status["qdrant"]' in source


def test_qdrant_migration_job_present_with_recall_canary() -> None:
    source = _read("services/unified_content/qdrant_migration_job.py")
    assert "class UnifiedContentQdrantMigrationJob" in source
    assert "verify_recall_sample" in source
    assert "run_unified_content_qdrant_migration" in source
