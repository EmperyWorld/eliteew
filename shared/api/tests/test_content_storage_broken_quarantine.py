# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Contract locks for storage quarantine: fail-fast IncompleteRead, reason codes,
# SQL exclude clause, owner ACL on integrity ops.
# Related:
# - documentation/product/CONTENT-BROKEN-FILES-AND-WEBP-DISPLAY.md
# ---

from __future__ import annotations

import asyncio
from http.client import IncompleteRead as HTTPIncompleteRead
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest

from api.services.unified_content.storage_integrity import (
    REASON_INCOMPLETE_READ,
    REASON_SEAWEED_NEEDLE_MISSING,
    SQL_EXCLUDE_BROKEN_QUARANTINED,
    STORAGE_INTEGRITY_BROKEN_QUARANTINED,
    reason_from_storage_error,
)


@pytest.mark.unit
def test_sql_exclude_broken_quarantined_clause() -> None:
    assert "broken_quarantined" in SQL_EXCLUDE_BROKEN_QUARANTINED
    assert "storage_integrity_status" in SQL_EXCLUDE_BROKEN_QUARANTINED


@pytest.mark.unit
def test_reason_from_storage_error_codes() -> None:
    assert (
        reason_from_storage_error(Exception("IncompleteRead(0 bytes read, 100 more expected)"))
        == REASON_SEAWEED_NEEDLE_MISSING
    )
    assert reason_from_storage_error(Exception("Incomplete SeaweedFS read; partial data")) == REASON_INCOMPLETE_READ
    assert reason_from_storage_error(Exception("Content not found in SeaweedFS")) == REASON_SEAWEED_NEEDLE_MISSING


@pytest.mark.unit
def test_list_content_source_excludes_broken_quarantined() -> None:
    from pathlib import Path

    source = Path("services/unified_content/content_storage_list.py").read_text(encoding="utf-8")
    assert "SQL_EXCLUDE_BROKEN_QUARANTINED" in source


@pytest.mark.unit
def test_download_router_rejects_known_broken_outside_retrieve_try() -> None:
    """Regression: HTTPException must not be raised inside bare except Exception (404→500)."""
    from pathlib import Path

    source = Path("routers/unified_content_download.py").read_text(encoding="utf-8")
    assert "_reject_known_broken_blob" in source
    assert "ensure_storage_blob_readable" in source
    # Neg-cache / known-broken gate must run before retrieve try body.
    gate_at = source.index("await _reject_known_broken_blob")
    retrieve_at = source.index("backend.retrieve(content.file_path")
    assert gate_at < retrieve_at


@pytest.mark.unit
def test_seaweed_empty_incomplete_read_maps_to_not_found(monkeypatch: pytest.MonkeyPatch) -> None:
    import api.services.unified_content.storage_backends.minio_storage as seaweed_module  # noqa: PLC0415

    calls = {"n": 0}

    class _FailingClient:
        def get_object(self, _bucket: str, _object_name: str) -> object:
            calls["n"] += 1

            class _Resp:
                def read(self) -> bytes:
                    raise HTTPIncompleteRead(b"", 100)

                def close(self) -> None:
                    return None

                def release_conn(self) -> None:
                    return None

            return _Resp()

    async def _noop_init() -> None:
        return None

    storage = object.__new__(seaweed_module.SeaweedFSStorage)
    storage._ensure_initialized = _noop_init  # type: ignore[attr-defined]
    storage.read_client = _FailingClient()  # type: ignore[attr-defined]
    storage.fast_client = _FailingClient()  # type: ignore[attr-defined]

    with pytest.raises(seaweed_module.SeaweedFileNotFoundError):
        asyncio.run(
            storage.retrieve(
                f"unified-content/{uuid4()}/asset.bin",
                uuid4(),
                fail_fast=True,
            )
        )
    assert calls["n"] == 1


@pytest.mark.unit
def test_seaweed_partial_incomplete_read_maps_to_corrupted() -> None:
    import api.services.unified_content.storage_backends.minio_storage as seaweed_module  # noqa: PLC0415

    class _FailingClient:
        def get_object(self, _bucket: str, _object_name: str) -> object:
            class _Resp:
                def read(self) -> bytes:
                    raise HTTPIncompleteRead(b"partial-bytes", 100)

                def close(self) -> None:
                    return None

                def release_conn(self) -> None:
                    return None

            return _Resp()

    async def _noop_init() -> None:
        return None

    storage = object.__new__(seaweed_module.SeaweedFSStorage)
    storage._ensure_initialized = _noop_init  # type: ignore[attr-defined]
    storage.read_client = _FailingClient()  # type: ignore[attr-defined]
    storage.fast_client = _FailingClient()  # type: ignore[attr-defined]

    with pytest.raises(seaweed_module.SeaweedFileCorruptedError):
        asyncio.run(
            storage.retrieve(
                f"unified-content/{uuid4()}/asset.bin",
                uuid4(),
                fail_fast=True,
            )
        )


@pytest.mark.unit
def test_quarantine_storage_broken_idempotent() -> None:
    from api.services.unified_content.content_storage_integrity_ops import (  # noqa: PLC0415
        ContentStorageIntegrityOpsMixin,
    )

    class _Svc(ContentStorageIntegrityOpsMixin):
        def __init__(self) -> None:
            self.db_pool = MagicMock()
            self.audit_logger = MagicMock()
            self.audit_logger.log = AsyncMock()
            self._neg = AsyncMock()
            self._set_storage_broken_negative_cache = self._neg  # type: ignore[method-assign]

    svc = _Svc()
    conn = AsyncMock()
    owner = uuid4()
    cid = uuid4()
    conn.fetchrow = AsyncMock(
        return_value={"user_id": owner, "storage_integrity_status": STORAGE_INTEGRITY_BROKEN_QUARANTINED}
    )
    acquire_cm = MagicMock()
    acquire_cm.__aenter__ = AsyncMock(return_value=conn)
    acquire_cm.__aexit__ = AsyncMock(return_value=False)
    svc.db_pool.acquire = MagicMock(return_value=acquire_cm)

    ok = asyncio.run(svc.quarantine_storage_broken(cid, reason=REASON_INCOMPLETE_READ))
    assert ok is True
    conn.execute.assert_not_called()
    svc._neg.assert_awaited()


@pytest.mark.unit
def test_permanent_delete_denies_non_owner() -> None:
    from api.services.unified_content.content_storage_integrity_ops import (  # noqa: PLC0415
        ContentStorageIntegrityOpsMixin,
    )

    class _Svc(ContentStorageIntegrityOpsMixin):
        def __init__(self) -> None:
            self.db_pool = MagicMock()
            self.storage_factory = MagicMock()
            self.audit_logger = MagicMock()

    svc = _Svc()
    conn = AsyncMock()
    conn.fetchrow = AsyncMock(
        return_value={
            "id": uuid4(),
            "user_id": uuid4(),
            "file_path": "b/k",
            "thumbnail_path": None,
            "sb": "seaweedfs",
            "storage_integrity_status": STORAGE_INTEGRITY_BROKEN_QUARANTINED,
        }
    )
    acquire_cm = MagicMock()
    acquire_cm.__aenter__ = AsyncMock(return_value=conn)
    acquire_cm.__aexit__ = AsyncMock(return_value=False)
    svc.db_pool.acquire = MagicMock(return_value=acquire_cm)

    with pytest.raises(PermissionError):
        asyncio.run(svc.permanent_delete_broken(uuid4(), str(uuid4())))
