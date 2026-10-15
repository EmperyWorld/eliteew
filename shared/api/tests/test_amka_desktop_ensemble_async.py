"""Blueprint picker forced template + AMKA ensemble async smoke."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from api.services.desktop_chat_ensemble.blueprint.picker import pick_template_for_turn
from api.services.marketing_cabinet.amka_ensemble_core import run_amka_desktop_ensemble_for_project


def _mini_catalog() -> MagicMock:
    catalog = MagicMock()
    catalog.templates_by_id = {"research_plan_v1": MagicMock()}
    return catalog


@pytest.mark.asyncio
async def test_pick_template_for_turn_forced_id() -> None:
    tid = await pick_template_for_turn(
        llama=None,
        model="test",
        user_excerpt="anything",
        catalog=_mini_catalog(),
        defaults={},
        forced_template_id="research_plan_v1",
    )
    assert tid == "research_plan_v1"


@pytest.mark.asyncio
async def test_run_amka_desktop_ensemble_awaits_database_manager() -> None:
    run_id = uuid4()
    project_id = uuid4()
    user_id = uuid4()
    chat_id = uuid4()

    fake_manager = MagicMock()
    fake_db = AsyncMock()
    fake_manager.get_postgres_session.return_value.__aenter__ = AsyncMock(return_value=fake_db)
    fake_manager.get_postgres_session.return_value.__aexit__ = AsyncMock(return_value=None)

    fake_chat = MagicMock()
    fake_chat.id = chat_id
    fake_db.refresh = AsyncMock()
    fake_db.add = MagicMock()
    fake_db.commit = AsyncMock()

    async def _stream(*_args, **_kwargs):
        yield 'data: {"event":"token","delta":"# OK"}\n\n'
        yield 'data: {"event":"done","ensemble":true}\n\n'

    with (
        patch(
            "api.services.marketing_cabinet.amka_ensemble_core.get_database_manager",
            new=AsyncMock(return_value=fake_manager),
        ),
        patch(
            "api.services.marketing_cabinet.amka_ensemble_core.fetch_config_defaults",
            new=AsyncMock(return_value={}),
        ),
        patch(
            "api.services.marketing_cabinet.amka_ensemble_core.stream_chat_turn",
            side_effect=_stream,
        ),
        patch(
            "api.services.marketing_cabinet.amka_ensemble_core._load_last_assistant_markdown",
            new=AsyncMock(return_value=("", {})),
        ),
        patch(
            "api.services.marketing_cabinet.amka_ensemble_core._delete_ephemeral_chat",
            new=AsyncMock(),
        ),
    ):
        out = await run_amka_desktop_ensemble_for_project(
            AsyncMock(),
            user_id=user_id,
            company_id=None,
            project_id=project_id,
            run_id=run_id,
            step_id="step-1",
            section_key="evidence",
            title="Evidence",
            rationale="test",
            user_instruction="",
            audit_payload={},
            plan_payload={"ensemble_template_hint": "research_plan_v1"},
        )

    assert out.get("error") is None
    assert "# OK" in str(out.get("output_text") or "")


@pytest.mark.asyncio
async def test_run_amka_desktop_ensemble_empty_output_returns_error() -> None:
    run_id = uuid4()
    project_id = uuid4()
    user_id = uuid4()

    fake_manager = MagicMock()
    fake_db = AsyncMock()
    fake_manager.get_postgres_session.return_value.__aenter__ = AsyncMock(return_value=fake_db)
    fake_manager.get_postgres_session.return_value.__aexit__ = AsyncMock(return_value=None)
    fake_db.refresh = AsyncMock()
    fake_db.add = MagicMock()
    fake_db.commit = AsyncMock()

    async def _empty_stream(*_args, **_kwargs):
        yield 'data: {"event":"done","ensemble":true}\n\n'

    with (
        patch(
            "api.services.marketing_cabinet.amka_ensemble_core.get_database_manager",
            new=AsyncMock(return_value=fake_manager),
        ),
        patch(
            "api.services.marketing_cabinet.amka_ensemble_core.fetch_config_defaults",
            new=AsyncMock(return_value={}),
        ),
        patch(
            "api.services.marketing_cabinet.amka_ensemble_core.stream_chat_turn",
            side_effect=_empty_stream,
        ),
        patch(
            "api.services.marketing_cabinet.amka_ensemble_core._load_last_assistant_markdown",
            new=AsyncMock(return_value=("", {})),
        ),
        patch(
            "api.services.marketing_cabinet.amka_ensemble_core._delete_ephemeral_chat",
            new=AsyncMock(),
        ),
    ):
        out = await run_amka_desktop_ensemble_for_project(
            AsyncMock(),
            user_id=user_id,
            company_id=None,
            project_id=project_id,
            run_id=run_id,
            step_id="step-empty",
            section_key="evidence",
            title="Evidence",
            rationale="test",
            user_instruction="",
            audit_payload={},
            plan_payload={},
        )

    assert out.get("error") == "ensemble_empty_output"
    assert not str(out.get("output_text") or "").strip()
