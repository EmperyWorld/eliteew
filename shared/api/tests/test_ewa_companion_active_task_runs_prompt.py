# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Unit tests for active task runs prompt block and status Q&A (music generation visibility).
# Invariants:
# - No live Postgres — companion_asyncpg is mocked.
# Related:
# - api/ewa_platform/companion/orchestration/active_task_runs_prompt.py
# ---

from __future__ import annotations

import asyncio
from typing import Any

import pytest

from api.ewa_platform.companion.orchestration import active_task_runs_prompt as atp


@pytest.mark.unit
def test_user_line_asks_operations_status_ru() -> None:
    assert atp.user_line_asks_active_operations_status("что там с генерацией песни на каком этапе")
    assert not atp.user_line_asks_active_operations_status("отметь задачу выполненной")


@pytest.mark.unit
def test_format_active_task_runs_prompt_block() -> None:
    block = atp.format_active_task_runs_prompt_block(
        [
            {
                "id": "run-1",
                "intent_kind": "music_generation_background",
                "status": "running",
                "user_message": "сделай песню",
                "plan_payload": {"theme_preview": "Лето"},
                "steps": [
                    {
                        "step_index": 2,
                        "status": "in_progress",
                        "title": "Генерация стиля",
                    }
                ],
            }
        ]
    )
    assert "Active_task_runs" in block
    assert "run-1" in block
    assert "этап 2/4" in block
    assert "Лето" in block


@pytest.mark.unit
def test_format_active_operations_status_reply_with_music_run() -> None:
    reply = atp.format_active_operations_status_reply(
        [
            {
                "id": "run-1",
                "intent_kind": "music_generation_background",
                "status": "running",
                "plan_payload": {"theme_preview": "Лето"},
                "steps": [
                    {
                        "step_index": 3,
                        "status": "in_progress",
                        "title": "Генерация трека",
                    }
                ],
            }
        ],
        user_line="на каком этапе генерация",
    )
    assert "этап 3 из 4" in reply
    assert "Лето" in reply


@pytest.mark.unit
def test_answer_active_operations_status_short_circuit(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def fake_load(
        _pool: Any,
        *,
        principal_id: str,
    ) -> list[dict[str, Any]]:
        assert principal_id == "p1"
        return [
            {
                "id": "run-1",
                "intent_kind": "music_generation_background",
                "status": "running",
                "plan_payload": {"theme_preview": "Test"},
                "steps": [],
            }
        ]

    monkeypatch.setattr(atp, "load_active_task_runs_with_steps", fake_load)
    out = asyncio.run(
        atp.answer_active_operations_status(
            None,
            principal_id="p1",
            user_line="что там с генерацией",
        )
    )
    assert out is not None
    assert "Test" in out["reply"]
