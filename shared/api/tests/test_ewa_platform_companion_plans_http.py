# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# HTTP contract tests for companion plans router handlers (feature flag, pool, bundle).
# Related:
# - api/ewa_platform/gateways/routers/companion_plans.py
# ---

from __future__ import annotations

import asyncio
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException  # type: ignore[import-untyped]

from api.core.auth import User
from api.ewa_platform.gateways.routers import companion_plans as plans_router


def _run(coro: Any) -> Any:
    return asyncio.run(coro)


def _user() -> User:
    return User(id="u-plan", email="a@b.c", username="t", role="admin")


def _request(pool: Any) -> MagicMock:
    req = MagicMock()
    req.app.state.ewa_orchestration_pool = pool
    return req


@pytest.mark.unit
def test_get_active_raises_404_when_feature_disabled(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("EWA_COMPANION_PLAN_ENABLED", raising=False)
    with pytest.raises(HTTPException) as exc:
        _run(plans_router.get_active_companion_plan(_request(object()), user=_user()))
    assert exc.value.status_code == 404


@pytest.mark.unit
def test_get_active_raises_503_without_pool(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_COMPANION_PLAN_ENABLED", "1")
    with pytest.raises(HTTPException) as exc:
        _run(plans_router.get_active_companion_plan(_request(None), user=_user()))
    assert exc.value.status_code == 503


@pytest.mark.unit
def test_get_active_returns_bundle(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_COMPANION_PLAN_ENABLED", "1")
    bundle = {
        "plan": {
            "id": "p1",
            "principal_id": "u-plan",
            "title": "Мой план",
            "description": None,
            "status": "progress",
            "progress": 50.0,
            "source_turn_id": None,
            "is_active": True,
            "metadata": {},
        },
        "goals": [
            {
                "id": "g1",
                "plan_id": "p1",
                "title": "Цель 1",
                "description": None,
                "category": "general",
                "progress": 0.0,
                "status": "active",
                "priority": "medium",
                "sort_order": 0,
            }
        ],
        "tasks": [
            {
                "id": "t1",
                "plan_id": "p1",
                "goal_id": "g1",
                "title": "Шаг 1",
                "description": None,
                "status": "pending",
                "priority": "medium",
                "due_date": None,
                "sort_order": 0,
                "completed_at": None,
            }
        ],
    }
    monkeypatch.setattr(
        plans_router.plans_pg,
        "plan_get_active",
        AsyncMock(return_value=bundle),
    )
    out = _run(plans_router.get_active_companion_plan(_request(object()), user=_user()))
    assert out.plan.id == "p1"
    assert len(out.tasks) == 1


@pytest.mark.unit
def test_archive_active_returns_empty_bundle(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_COMPANION_PLAN_ENABLED", "1")
    monkeypatch.setattr(
        plans_router.plans_pg,
        "plan_archive_active",
        AsyncMock(return_value=True),
    )
    out = _run(plans_router.archive_active_companion_plan(_request(object()), user=_user()))
    assert out.plan is None
    assert out.goals == []
    assert out.tasks == []


@pytest.mark.unit
def test_get_active_returns_empty_bundle_when_no_plan(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_COMPANION_PLAN_ENABLED", "1")
    monkeypatch.setattr(
        plans_router.plans_pg,
        "plan_get_active",
        AsyncMock(return_value=None),
    )
    out = _run(plans_router.get_active_companion_plan(_request(object()), user=_user()))
    assert out.plan is None
    assert out.goals == []
    assert out.tasks == []


@pytest.mark.unit
def test_patch_task_updates_bundle(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_COMPANION_PLAN_ENABLED", "1")
    bundle = {
        "plan": {
            "id": "p1",
            "principal_id": "u-plan",
            "title": "Мой план",
            "description": None,
            "status": "progress",
            "progress": 50.0,
            "source_turn_id": None,
            "is_active": True,
            "metadata": {},
        },
        "goals": [],
        "tasks": [
            {
                "id": "t1",
                "plan_id": "p1",
                "goal_id": None,
                "title": "Шаг утром",
                "description": None,
                "status": "pending",
                "priority": "medium",
                "due_date": "2026-08-19",
                "due_time": "10:00:00",
                "due_duration_minutes": 60,
                "sort_order": 0,
                "completed_at": None,
            }
        ],
    }
    monkeypatch.setattr(
        plans_router.plans_pg,
        "plan_task_update",
        AsyncMock(return_value=bundle),
    )
    from api.ewa_platform.schemas.pydantic.companion_plans import CompanionPlanTaskPatchIn

    out = _run(
        plans_router.patch_companion_plan_task(
            "t1",
            CompanionPlanTaskPatchIn(title="Шаг утром", due_time="10:00:00"),
            _request(object()),
            user=_user(),
        )
    )
    assert out.tasks[0].title == "Шаг утром"
    assert out.tasks[0].due_time is not None


@pytest.mark.unit
def test_patch_task_empty_body_is_422(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_COMPANION_PLAN_ENABLED", "1")
    from api.ewa_platform.schemas.pydantic.companion_plans import CompanionPlanTaskPatchIn

    with pytest.raises(HTTPException) as exc:
        _run(
            plans_router.patch_companion_plan_task(
                "t1",
                CompanionPlanTaskPatchIn(),
                _request(object()),
                user=_user(),
            )
        )
    assert exc.value.status_code == 422


@pytest.mark.unit
def test_patch_task_missing_for_principal_is_404(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_COMPANION_PLAN_ENABLED", "1")
    monkeypatch.setattr(plans_router.plans_pg, "plan_task_update", AsyncMock(return_value=None))
    from api.ewa_platform.schemas.pydantic.companion_plans import CompanionPlanTaskPatchIn

    with pytest.raises(HTTPException) as exc:
        _run(
            plans_router.patch_companion_plan_task(
                "foreign-task",
                CompanionPlanTaskPatchIn(title="Nope"),
                _request(object()),
                user=_user(),
            )
        )
    assert exc.value.status_code == 404
