# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Unit tests for chat_history Qdrant schema migration helpers.
# Related:
# - api/services/desktop_chat/chat_history_schema_migration_job.py
# ---

from __future__ import annotations

import pytest

from api.services.desktop_chat.chat_history_schema_migration_job import (
    MigrationStats,
    _migrate_payload,
    _needs_migration,
)


def test_needs_migration_turn_with_message_id_only() -> None:
    payload = {"memory_kind": "turn", "message_id": "abc", "chat_profile": "desktop_ai_chat"}
    assert _needs_migration(payload) is True


def test_needs_migration_skips_when_source_message_id_present() -> None:
    payload = {
        "memory_kind": "turn",
        "message_id": "abc",
        "source_message_id": "abc",
    }
    assert _needs_migration(payload) is False


def test_migrate_payload_moves_message_id_to_source() -> None:
    out = _migrate_payload({"memory_kind": "turn", "message_id": "m1"})
    assert out["source_message_id"] == "m1"
    assert "message_id" not in out


@pytest.mark.asyncio
async def test_run_migration_apply_deletes_legacy_message_id_key(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from api.services.desktop_chat import chat_history_schema_migration_job as job

    deleted: list[list[str]] = []

    class FakeClient:
        async def scroll(self, **kwargs):  # noqa: ANN003
            from types import SimpleNamespace

            pt = SimpleNamespace(
                id="p1",
                payload={
                    "memory_kind": "turn",
                    "message_id": "m1",
                    "session_id": "s1",
                    "text": "User: hi\nAssistant: hello",
                },
            )
            return [pt], None

        async def set_payload(self, **kwargs):  # noqa: ANN003
            return None

        async def delete_payload(self, **kwargs):  # noqa: ANN003
            deleted.append(list(kwargs.get("keys") or []))
            return None

    async def _fake_client():
        return FakeClient()

    monkeypatch.setattr(
        "api.services.chat_memory_service._get_qdrant_client",
        _fake_client,
    )

    stats = await job.run_chat_history_schema_migration(apply=True)
    assert stats.updated == 1
    assert deleted == [["message_id"]]


def test_migration_stats_as_dict() -> None:
    stats = MigrationStats(scanned=10, updated=2, skipped=8, errors=0)
    assert stats.as_dict() == {"scanned": 10, "updated": 2, "skipped": 8, "errors": 0}
