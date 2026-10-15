# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Lock: unmatched blueprint template falls back to legacy freeform when conversational fallback is on.
# Invariants:
# - ensemble_blueprint_template_not_selected only when conversational fallback is explicitly false.
# Related:
# - api/services/desktop_chat_ensemble/blueprint/stream_turn.py
# - api/services/desktop_chat_ensemble/blueprint/stream_planning.py
# ---
"""Blueprint missing-template → legacy freeform fallback."""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

pytest.importorskip("sqlalchemy")

from api.services.desktop_chat_ensemble.blueprint import stream_planning as bp_plan
from api.services.desktop_chat_ensemble.blueprint import stream_turn as bp_stream


async def _collect(gen: object) -> list[str]:
    out: list[str] = []
    async for line in gen:  # type: ignore[union-attr]
        out.append(line)
    return out


@pytest.mark.asyncio
async def test_blueprint_missing_template_falls_back_to_legacy() -> None:
    chat = SimpleNamespace(
        id=uuid4(),
        user_id=uuid4(),
        settings={},
        system_prompt_override=None,
        project_id=None,
        use_project_rag=False,
    )
    catalog = SimpleNamespace(templates_by_id={})

    async def _legacy(*_a: object, **_k: object):
        yield 'data: {"event":"token","delta":"ok"}\n\n'
        yield 'data: {"event":"done","ensemble":true}\n\n'

    with (
        patch.object(bp_plan, "desktop_ai_chat_session") as sess,
        patch.object(bp_plan, "get_plan_catalog_for_session", AsyncMock(return_value=catalog)),
        patch.object(bp_plan, "get_ensemble_roster", return_value=["bezrazdel"]),
        patch.object(bp_plan, "pick_template_for_turn", AsyncMock(return_value="")),
        patch.object(bp_plan, "stream_legacy_freeform_turn", _legacy),
        patch.object(bp_plan, "resolve_desktop_chat_model", return_value="model"),
    ):
        sess.return_value.__aenter__ = AsyncMock(return_value=MagicMock())
        sess.return_value.__aexit__ = AsyncMock(return_value=False)
        lines = await _collect(
            bp_stream.stream_blueprint_turn(
                AsyncMock(),
                chat=chat,
                user_id=uuid4(),
                history=[],
                user_text="риторический ответ без шаблона плана",
                defaults={"ensemble_blueprint_conversational_fallback": True},
            )
        )
    joined = "".join(lines)
    assert "ensemble_blueprint_template_not_selected" not in joined
    assert '"event":"token"' in joined
    assert '"event":"done"' in joined


@pytest.mark.asyncio
async def test_blueprint_missing_template_errors_when_fallback_disabled() -> None:
    chat = SimpleNamespace(
        id=uuid4(),
        user_id=uuid4(),
        settings={},
        system_prompt_override=None,
        project_id=None,
        use_project_rag=False,
    )
    catalog = SimpleNamespace(templates_by_id={})

    with (
        patch.object(bp_plan, "desktop_ai_chat_session") as sess,
        patch.object(bp_plan, "get_plan_catalog_for_session", AsyncMock(return_value=catalog)),
        patch.object(bp_plan, "get_ensemble_roster", return_value=["bezrazdel"]),
        patch.object(bp_plan, "pick_template_for_turn", AsyncMock(return_value="")),
        patch.object(bp_plan, "resolve_desktop_chat_model", return_value="model"),
    ):
        sess.return_value.__aenter__ = AsyncMock(return_value=MagicMock())
        sess.return_value.__aexit__ = AsyncMock(return_value=False)
        lines = await _collect(
            bp_stream.stream_blueprint_turn(
                AsyncMock(),
                chat=chat,
                user_id=uuid4(),
                history=[],
                user_text="риторический ответ без шаблона плана",
                defaults={"ensemble_blueprint_conversational_fallback": False},
            )
        )
    joined = "".join(lines)
    assert "ensemble_blueprint_template_not_selected" in joined
