# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Lock: only document owner may create collaboration invites (collaborators can read).
# Invariants:
# - ValueError when get_document returns a doc owned by someone else.
# Related:
# - api/services/doc_editor_service.py create_collaboration_invite
# ---

"""Collaboration invite owner gate."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest

from api.services.doc_editor_service import DocEditorService


@pytest.mark.asyncio
async def test_create_collaboration_invite_rejects_non_owner() -> None:
    owner_id = str(uuid4())
    collaborator_id = str(uuid4())
    document_id = uuid4()
    service = DocEditorService(db_pool=MagicMock(), redis_service=None)
    service.get_document = AsyncMock(
        return_value={
            "id": str(document_id),
            "user_id": owner_id,
            "title": "Shared doc",
        }
    )
    service._are_friends = AsyncMock(return_value=True)

    with pytest.raises(ValueError, match="только владелец"):
        await service.create_collaboration_invite(
            document_id=document_id,
            from_user_id=collaborator_id,
            to_user_id=str(uuid4()),
        )

    service._are_friends.assert_not_awaited()
