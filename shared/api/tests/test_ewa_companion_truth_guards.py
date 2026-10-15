# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---

from __future__ import annotations

from api.ewa_platform.companion.context.truth_guard_registry import TruthGuardContext, apply_truth_guards


def test_async_accepted_strips_ready_claim() -> None:
    reply = "Песня уже готова, включай!"
    ctx = TruthGuardContext(
        user_line="как там?",
        effective_branch="music_generation",
        task_run_status="running",
    )
    cleaned, triggered = apply_truth_guards(reply, ctx)
    assert triggered
    assert "уже готова" not in cleaned.lower()


def test_fell_through_strips_open_app_claim() -> None:
    reply = "Я уже открыла DocEditor для тебя."
    ctx = TruthGuardContext(
        user_line="привет",
        effective_branch="",
        orchestration_outcome="fell_through",
        has_recent_server_action=False,
    )
    cleaned, triggered = apply_truth_guards(reply, ctx)
    assert triggered
    assert "открыла" not in cleaned.lower() or "диалог" in cleaned.lower()


def test_file_study_deferred_music() -> None:
    reply = "Генерация уже запущена."
    ctx = TruthGuardContext(
        user_line="анализ",
        effective_branch="file_study_compose",
        deferred_music_generation=True,
    )
    cleaned, triggered = apply_truth_guards(reply, ctx)
    assert triggered
    assert "не запущена" in cleaned.lower() or "not started" in cleaned.lower()
