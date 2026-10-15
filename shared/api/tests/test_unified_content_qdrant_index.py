# ---
# EliteEW · Empery World
# https://empery.world
# ---
# Purpose:
# Contract tests for unified_content Qdrant indexer module.
# Related:
# - api/services/unified_content/unified_content_qdrant_service.py
# ---

from __future__ import annotations

from pathlib import Path

API_ROOT = Path(__file__).resolve().parents[1]


def _read(rel: str) -> str:
    return (API_ROOT / rel).read_text(encoding="utf-8")


def test_unified_content_qdrant_service_exports_index_and_delete() -> None:
    source = _read("services/unified_content/unified_content_qdrant_service.py")
    assert 'UNIFIED_CONTENT_QDRANT_COLLECTION = "eliteew_documents"' in source
    assert "async def index_unified_content_qdrant" in source
    assert "async def delete_qdrant_chunks_for_content" in source
    assert "reindex_desktop_chat_attachments_for_content" in source


def test_worker_hooks_reference_qdrant_indexer() -> None:
    source = _read("workers/queue_handlers.py")
    assert "index_unified_content_qdrant" in source
