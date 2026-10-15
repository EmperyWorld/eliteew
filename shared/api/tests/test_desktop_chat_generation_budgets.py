# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Lock generation budget constants, admin normalize clamps, and runtime defaults.
# Related:
# - api/services/desktop_chat/generation_budgets_settings.py
# ---

from __future__ import annotations

from api.services.desktop_chat.generation_budgets_settings import (
    BLUEPRINT_STEP_DEFAULT,
    JOINT_STANDARD_DEFAULT,
    NUM_PREDICT_DEFAULT,
    NUM_PREDICT_HI,
    REPLY_OVERRIDE_CAP,
    SEPARATE_STANDARD_DEFAULT,
    TIMEOUT_SEC_DEFAULT,
    normalize_generation_budgets_admin_defaults,
)


def test_normalize_clamps_out_of_range() -> None:
    out = normalize_generation_budgets_admin_defaults(
        {
            "desktop_chat_num_predict": 9_999_999,
            "desktop_chat_timeout_sec": 5,
            "ensemble_separate_reply_max_tokens": 10,
            "ensemble_joint_section_max_tokens": 200_000,
            "ensemble_blueprint_step_max_tokens": 100,
        }
    )
    assert out["desktop_chat_num_predict"] == NUM_PREDICT_HI
    assert out["desktop_chat_timeout_sec"] == 30.0
    assert out["ensemble_separate_reply_max_tokens"] == 128
    assert out["ensemble_joint_section_max_tokens"] == REPLY_OVERRIDE_CAP
    assert out["ensemble_blueprint_step_max_tokens"] == 512


def test_normalize_only_touched_keys() -> None:
    out = normalize_generation_budgets_admin_defaults({"desktop_chat_num_predict": 4096})
    assert set(out.keys()) == {"desktop_chat_num_predict"}
    assert out["desktop_chat_num_predict"] == 4096


def test_defaults_match_product_canon() -> None:
    assert NUM_PREDICT_DEFAULT == 98_304
    assert TIMEOUT_SEC_DEFAULT == 300.0
    assert SEPARATE_STANDARD_DEFAULT == 32_768
    assert JOINT_STANDARD_DEFAULT == 40_960
    assert BLUEPRINT_STEP_DEFAULT == 40_960
    assert REPLY_OVERRIDE_CAP == 98_304
