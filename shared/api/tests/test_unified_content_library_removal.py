# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Recipient remove-from-library: share revoke without owner soft-delete or legacy array writes.
# Related:
# - api/services/unified_content/share_service.py
# ---
from __future__ import annotations

from uuid import UUID, uuid4

import pytest


@pytest.mark.unit
@pytest.mark.asyncio
async def test_leave_shared_content_revokes_content_shares_row_only(monkeypatch: pytest.MonkeyPatch) -> None:
    from api.services.unified_content.share_service import ShareService

    content_id = uuid4()
    owner_id = str(uuid4())
    recipient_id = str(uuid4())
    share_id = uuid4()
    audit_actions: list[str] = []
    executed_queries: list[str] = []

    class _Conn:
        async def fetchrow(self, query: str, *args: object):
            q = " ".join(query.split())
            if "FROM unified_content" in q and "deleted_at IS NULL" in q:
                return {
                    "id": content_id,
                    "user_id": owner_id,
                    "visibility": "private",
                    "friend_visibility": False,
                    "shared_with_user_ids": [UUID(recipient_id)],
                }
            if "FROM content_shares" in q and "shared_with_user_id" in q:
                return {"id": share_id}
            return None

        async def execute(self, query: str, *args: object) -> str:
            executed_queries.append(" ".join(query.split()))
            if "DELETE FROM content_shares" in query:
                return "DELETE 1"
            return "OK"

        async def fetch(self, query: str, *args: object):
            return []

        async def fetchval(self, query: str, *args: object):
            return None

        async def __aenter__(self):
            return self

        async def __aexit__(self, *_a: object) -> None:
            return None

        def transaction(self) -> _Txn:
            return _Txn()

    class _Txn:
        async def __aenter__(self):
            return None

        async def __aexit__(self, *_a: object) -> None:
            return None

    class _Pool:
        def acquire(self) -> _Conn:
            return _Conn()

    class _Audit:
        async def log(self, **kwargs: object) -> None:
            action = kwargs.get("action")
            audit_actions.append(str(getattr(action, "value", action)))

    svc = ShareService(_Pool(), _Audit(), None)  # type: ignore[arg-type]

    async def fake_refresh(_cid: UUID) -> None:
        return None

    monkeypatch.setattr(svc, "_refresh_search_acl", fake_refresh)

    ok = await svc.leave_shared_content(content_id, recipient_id)
    assert ok is True
    assert audit_actions == ["unshared"]
    assert any("DELETE FROM content_shares" in query for query in executed_queries)
    assert not any("shared_with_user_ids" in query for query in executed_queries)
