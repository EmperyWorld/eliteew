# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T && TZBrand
# ---
# Purpose:
# Behavioral tests for companion presentation show/open (post-generation EWRP open).
# Invariants:
# - Show intent must not collide with presentation generation create verbs.
# Related:
# - api/ewa_platform/companion/orchestration/companion_presentation_generation.py
# - api/ewa_platform/companion/orchestration/task_orchestrator.py
# ---

from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from api.ewa_platform.companion.orchestration import task_orchestrator
from api.ewa_platform.companion.orchestration.companion_presentation_generation import (
    extract_ewrp_job_id_from_user_line,
    user_line_requests_presentation_show,
)

pytestmark = pytest.mark.unit

_JOB = "34881699-0d6b-421f-a68d-ed1ad9a7930b"


def test_user_line_requests_presentation_show_positive_ru_en() -> None:
    assert user_line_requests_presentation_show("покажи презентацию")
    assert user_line_requests_presentation_show("open the presentation")
    assert user_line_requests_presentation_show(f"show presentation {_JOB}")


def test_user_line_requests_presentation_show_rejects_create_verbs() -> None:
    assert not user_line_requests_presentation_show("создай презентацию про AI")
    assert not user_line_requests_presentation_show("generate slides about sales")


def test_extract_ewrp_job_id_from_user_line() -> None:
    assert extract_ewrp_job_id_from_user_line(f"открой {_JOB}") == _JOB
    assert extract_ewrp_job_id_from_user_line("покажи презентацию") is None


@pytest.mark.asyncio
async def test_resume_latest_completed_presentation_emits_open_app_action() -> None:
    pool = AsyncMock()
    with patch(
        "api.ewa_platform.companion.orchestration.companion_presentation_generation.resolve_presentation_open_target",
        new=AsyncMock(
            return_value={
                "ewrp_job_id": _JOB,
                "title": "AI strategy",
                "topic": "AI strategy",
            }
        ),
    ):
        out = await task_orchestrator._resume_latest_completed_presentation(
            pool,
            principal_id="principal-1",
            user_line="покажи презентацию",
            shell_norm={"client_surface": "desktop"},
        )

    assert out is not None
    assert out["actions"] == [{"type": "open_app", "app_component": "EWRP", "ewrp_job_id": _JOB}]
    assert "AI strategy" in str(out["reply"])


@pytest.mark.asyncio
async def test_resume_latest_completed_presentation_mobile_hint() -> None:
    pool = AsyncMock()
    out = await task_orchestrator._resume_latest_completed_presentation(
        pool,
        principal_id="principal-1",
        user_line="покажи презентацию",
        shell_norm={"client_surface": "mobile"},
    )
    assert out is not None
    assert out["actions"] == []
    assert "PDF" in str(out["reply"])
