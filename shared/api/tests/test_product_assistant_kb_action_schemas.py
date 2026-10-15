# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Contract tests for assistant KB bulk action OpenAPI response models.
# Related:
# - api/routers/product_desktop_assistant_kb.py
# ---

from __future__ import annotations

from api.routers.product_desktop_assistant_kb import (
    AssistantKbPurgeOut,
    AssistantKbReindexAllOut,
    AssistantKbSyncHandbookOut,
)


def test_assistant_kb_sync_handbook_out_dry_run_shape() -> None:
    out = AssistantKbSyncHandbookOut(
        status="dry_run",
        message="Dry run complete; no documents written.",
        files=3,
        ok=3,
        fail=0,
        dry_run=True,
        handbook_dir="/tmp/handbook",
    )
    restored = AssistantKbSyncHandbookOut.model_validate(out.model_dump())
    assert restored.handbook_dir == "/tmp/handbook"
    assert restored.files == 3


def test_assistant_kb_reindex_all_out_started_shape() -> None:
    out = AssistantKbReindexAllOut(
        status="started",
        message="Handbook KB reindex started in background. Check API logs for progress.",
    )
    restored = AssistantKbReindexAllOut.model_validate(out.model_dump())
    assert restored.status == "started"


def test_assistant_kb_purge_out_shape() -> None:
    out = AssistantKbPurgeOut(
        status="ok",
        message="Handbook KB documents removed and RAG collection cleared.",
        removed_documents="12",
    )
    restored = AssistantKbPurgeOut.model_validate(out.model_dump())
    assert restored.removed_documents == "12"
