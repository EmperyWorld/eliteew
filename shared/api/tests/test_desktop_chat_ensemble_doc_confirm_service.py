# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Behavioral tests for ensemble semi-auto document confirm persistence API.
# Invariants:
# - accept/decline mutate only the latest pending user message metadata.
# Related:
# - api/services/desktop_chat/service.py
# ---
"""Tests for ensemble document confirm service helper."""

from __future__ import annotations

import asyncio
from datetime import timedelta
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from fastapi import HTTPException

pytest.importorskip("sqlalchemy")

from api.services.desktop_chat.service import apply_ensemble_document_confirm
from api.services.desktop_chat_ensemble.doc_confirm_policy import ENSEMBLE_DOC_CONFIRM_ASKED_AT_KEY
from api.services.desktop_chat_ensemble.settings import (
    ENSEMBLE_DOC_CONFIRM_ACCEPTED,
    ENSEMBLE_DOC_CONFIRM_ASKED,
    ENSEMBLE_DOC_CONFIRM_DECLINED,
)
from api.utils.datetime_helpers import utc_now_naive


def _user_msg(*, msg_id: object, content: str, metadata: dict[str, object]) -> SimpleNamespace:
    return SimpleNamespace(
        id=msg_id,
        chat_id=None,
        role="user",
        content=content,
        message_metadata=metadata,
        created_at=utc_now_naive(),
    )


def test_apply_confirm_decline_updates_metadata() -> None:
    async def _run() -> None:
        chat_id = uuid4()
        msg_id = uuid4()
        chat = SimpleNamespace(id=chat_id, updated_at=None)
        user_msg = _user_msg(
            msg_id=msg_id,
            content="Сделай техплан",
            metadata={
                "ensemble_doc_confirm": ENSEMBLE_DOC_CONFIRM_ASKED,
                ENSEMBLE_DOC_CONFIRM_ASKED_AT_KEY: utc_now_naive().isoformat(timespec="seconds"),
                "ensemble_doc_confirm_reason": "reason",
            },
        )
        user_msg.chat_id = chat_id

        db = AsyncMock()
        db.get = AsyncMock(return_value=user_msg)
        result = MagicMock()
        result.scalars.return_value.all.return_value = [user_msg]
        db.execute = AsyncMock(return_value=result)
        db.commit = AsyncMock()

        with patch(
            "api.services.desktop_chat.service_persist.fetch_config_defaults",
            AsyncMock(return_value={}),
        ):
            text = await apply_ensemble_document_confirm(
                db,
                chat=chat,
                ref_message_id=msg_id,
                decision="decline",
            )

        assert text == "Сделай техплан"
        assert user_msg.message_metadata["ensemble_doc_confirm"] == ENSEMBLE_DOC_CONFIRM_DECLINED
        assert "ensemble_doc_confirm_reason" not in user_msg.message_metadata
        db.commit.assert_awaited()

    asyncio.run(_run())


def test_apply_confirm_accept_updates_metadata() -> None:
    async def _run() -> None:
        chat_id = uuid4()
        msg_id = uuid4()
        chat = SimpleNamespace(id=chat_id, updated_at=None)
        user_msg = _user_msg(
            msg_id=msg_id,
            content="Сделай техплан",
            metadata={
                "ensemble_doc_confirm": ENSEMBLE_DOC_CONFIRM_ASKED,
                ENSEMBLE_DOC_CONFIRM_ASKED_AT_KEY: utc_now_naive().isoformat(timespec="seconds"),
            },
        )
        user_msg.chat_id = chat_id

        db = AsyncMock()
        db.get = AsyncMock(return_value=user_msg)
        result = MagicMock()
        result.scalars.return_value.all.return_value = [user_msg]
        db.execute = AsyncMock(return_value=result)
        db.commit = AsyncMock()

        with patch(
            "api.services.desktop_chat.service_persist.fetch_config_defaults",
            AsyncMock(return_value={}),
        ):
            await apply_ensemble_document_confirm(
                db,
                chat=chat,
                ref_message_id=msg_id,
                decision="accept",
            )

        assert user_msg.message_metadata["ensemble_doc_confirm"] == ENSEMBLE_DOC_CONFIRM_ACCEPTED

    asyncio.run(_run())


def test_apply_confirm_expired_raises_conflict() -> None:
    async def _run() -> None:
        chat_id = uuid4()
        msg_id = uuid4()
        chat = SimpleNamespace(id=chat_id, updated_at=None)
        asked_at = (utc_now_naive() - timedelta(hours=3)).isoformat(timespec="seconds")
        user_msg = _user_msg(
            msg_id=msg_id,
            content="Сделай техплан",
            metadata={
                "ensemble_doc_confirm": ENSEMBLE_DOC_CONFIRM_ASKED,
                ENSEMBLE_DOC_CONFIRM_ASKED_AT_KEY: asked_at,
            },
        )
        user_msg.chat_id = chat_id

        db = AsyncMock()
        db.get = AsyncMock(return_value=user_msg)
        result = MagicMock()
        result.scalars.return_value.all.return_value = [user_msg]
        db.execute = AsyncMock(return_value=result)
        db.commit = AsyncMock()

        with patch(
            "api.services.desktop_chat.service_persist.fetch_config_defaults",
            AsyncMock(return_value={}),
        ):
            with pytest.raises(HTTPException) as exc:
                await apply_ensemble_document_confirm(
                    db,
                    chat=chat,
                    ref_message_id=msg_id,
                    decision="accept",
                )

        assert exc.value.status_code == 409
        assert exc.value.detail == "confirm_expired"
        assert user_msg.message_metadata["ensemble_doc_confirm"] == ENSEMBLE_DOC_CONFIRM_DECLINED

    asyncio.run(_run())
