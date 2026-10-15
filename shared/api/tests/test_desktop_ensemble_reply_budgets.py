# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T && TZBrand
# ---
# Purpose:
# Lock long-form generation budgets for ensemble experts (legacy separate/joint + blueprint steps).
# Invariants:
# - Standard/assessment defaults stay high enough that replies are not truncated mid-thought.
# - Ack/social stay short; admin overrides remain clamped.
# Related:
# - api/services/desktop_chat/generation_budgets_settings.py
# - api/services/desktop_chat_ensemble/archive/legacy_freeform/stream_turn.py
# - api/services/desktop_chat_ensemble/blueprint/stream_turn.py
# - documentation/product/DESKTOP-LLAMA-CHAT.md
# ---

from __future__ import annotations

from api.services.desktop_chat.generation_budgets_settings import (
    BLUEPRINT_STEP_DEFAULT,
    JOINT_ASSESSMENT_DEFAULT,
    JOINT_STANDARD_DEFAULT,
    NUM_PREDICT_DEFAULT,
    REPLY_OVERRIDE_CAP,
    SEPARATE_ASSESSMENT_DEFAULT,
    SEPARATE_STANDARD_DEFAULT,
)
from api.services.desktop_chat_ensemble.archive.legacy_freeform.stream_turn import (
    _reply_contract_block,
    _reply_max_tokens,
)
from api.services.desktop_chat_ensemble.blueprint.stream_turn import _step_max_tokens


def test_legacy_separate_standard_budget_is_long_form() -> None:
    assert _reply_max_tokens({}, turn_mode="standard", is_joint=False) == SEPARATE_STANDARD_DEFAULT
    assert _reply_max_tokens({}, turn_mode="assessment", is_joint=False) == SEPARATE_ASSESSMENT_DEFAULT
    assert _reply_max_tokens({}, turn_mode="ack", is_joint=False) <= 280


def test_legacy_joint_standard_budget_is_long_form() -> None:
    assert _reply_max_tokens({}, turn_mode="standard", is_joint=True) == JOINT_STANDARD_DEFAULT
    assert _reply_max_tokens({}, turn_mode="assessment", is_joint=True) == JOINT_ASSESSMENT_DEFAULT


def test_legacy_admin_override_ceiling_raised() -> None:
    assert (
        _reply_max_tokens(
            {"ensemble_separate_reply_max_tokens": 120_000},
            turn_mode="standard",
            is_joint=False,
        )
        == REPLY_OVERRIDE_CAP
    )
    assert (
        _reply_max_tokens(
            {"ensemble_joint_section_max_tokens": 120_000},
            turn_mode="standard",
            is_joint=True,
        )
        == REPLY_OVERRIDE_CAP
    )


def test_blueprint_step_budget_default_and_override() -> None:
    assert _step_max_tokens({}) == BLUEPRINT_STEP_DEFAULT
    assert _step_max_tokens({"ensemble_blueprint_step_max_tokens": 10_000}) == 10_000
    assert _step_max_tokens({"ensemble_blueprint_step_max_tokens": 200_000}) == REPLY_OVERRIDE_CAP
    assert _step_max_tokens({"ensemble_joint_section_max_tokens": 4_000}) == 4_000


def test_standard_reply_contract_asks_for_full_professional_volume() -> None:
    separate = _reply_contract_block("standard", is_joint=False)
    assert "объёмно" in separate.casefold() or "полноценно" in separate.casefold()
    assert "2–5 коротких" not in separate
    joint = _reply_contract_block("standard", is_joint=True)
    assert "компактной" not in joint


def test_desktop_chat_runtime_default_num_predict_allows_long_ensemble() -> None:
    from api.services.desktop_chat.llm.runtime import resolve_desktop_chat_llm_runtime

    _base, _model, num_predict, _ctx, timeout_sec = resolve_desktop_chat_llm_runtime(defaults={})
    assert num_predict >= SEPARATE_STANDARD_DEFAULT
    assert num_predict == NUM_PREDICT_DEFAULT
    assert timeout_sec == 300.0
