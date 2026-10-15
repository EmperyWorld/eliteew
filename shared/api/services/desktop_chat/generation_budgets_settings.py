# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Single source for Desktop AI Chat generation token/timeout budgets (admin + runtime).
# Invariants:
# - Admin PATCH clamps only keys present in the patch.
# - Runtime readers share the same defaults and hard ceilings.
# Related:
# - api/routers/desktop_admin_ai_chat.py
# - api/services/desktop_chat/llm/runtime.py
# - documentation/product/DESKTOP-LLAMA-CHAT.md
# ---

from __future__ import annotations

from typing import Any

# Global generation ceiling (solo stream + upper room for ensemble sections).
NUM_PREDICT_DEFAULT = 98_304
NUM_PREDICT_LO = 256
NUM_PREDICT_HI = 131_072

TIMEOUT_SEC_DEFAULT = 300.0
TIMEOUT_SEC_LO = 30.0
TIMEOUT_SEC_HI = 600.0

# Per-reply / per-step admin override ceiling (aligned with productive long-form).
REPLY_OVERRIDE_CAP = 98_304
SEPARATE_REPLY_LO = 128
JOINT_SECTION_LO = 128
BLUEPRINT_STEP_LO = 512

SEPARATE_STANDARD_DEFAULT = 32_768
SEPARATE_ASSESSMENT_DEFAULT = 24_576
JOINT_STANDARD_DEFAULT = 40_960
JOINT_ASSESSMENT_DEFAULT = 32_768
BLUEPRINT_STEP_DEFAULT = 40_960

# Admin form always writes these when saving structured defaults.
GENERATION_BUDGET_ADMIN_KEYS: tuple[str, ...] = (
    "desktop_chat_num_predict",
    "desktop_chat_timeout_sec",
    "ensemble_separate_reply_max_tokens",
    "ensemble_joint_section_max_tokens",
    "ensemble_blueprint_step_max_tokens",
)


def _clamp_int(raw: Any, *, default: int, lo: int, hi: int) -> int:
    try:
        n = int(raw)
    except TypeError, ValueError:
        return default
    return max(lo, min(hi, n))


def _clamp_float(raw: Any, *, default: float, lo: float, hi: float) -> float:
    try:
        v = float(raw)
    except TypeError, ValueError:
        return default
    return max(lo, min(hi, v))


def desktop_chat_num_predict(defaults: dict[str, Any] | None) -> int:
    d = defaults or {}
    raw = d.get("desktop_chat_num_predict")
    if raw is None or raw == "":
        return NUM_PREDICT_DEFAULT
    return _clamp_int(raw, default=NUM_PREDICT_DEFAULT, lo=NUM_PREDICT_LO, hi=NUM_PREDICT_HI)


def desktop_chat_timeout_sec(defaults: dict[str, Any] | None) -> float:
    d = defaults or {}
    raw = d.get("desktop_chat_timeout_sec")
    if raw is None or raw == "":
        return TIMEOUT_SEC_DEFAULT
    return _clamp_float(raw, default=TIMEOUT_SEC_DEFAULT, lo=TIMEOUT_SEC_LO, hi=TIMEOUT_SEC_HI)


def ensemble_separate_reply_max_tokens(defaults: dict[str, Any] | None) -> int:
    """Admin-configured separate-mode override; 0 means use turn_mode defaults."""
    d = defaults or {}
    raw = d.get("ensemble_separate_reply_max_tokens")
    if raw is None or raw == "":
        return 0
    return _clamp_int(raw, default=0, lo=SEPARATE_REPLY_LO, hi=REPLY_OVERRIDE_CAP)


def ensemble_joint_section_max_tokens(defaults: dict[str, Any] | None) -> int:
    d = defaults or {}
    raw = d.get("ensemble_joint_section_max_tokens")
    if raw is None or raw == "":
        return 0
    return _clamp_int(raw, default=0, lo=JOINT_SECTION_LO, hi=REPLY_OVERRIDE_CAP)


def ensemble_blueprint_step_max_tokens(defaults: dict[str, Any] | None) -> int:
    d = defaults or {}
    raw = d.get("ensemble_blueprint_step_max_tokens")
    if raw is None or raw == "":
        return 0
    return _clamp_int(raw, default=0, lo=BLUEPRINT_STEP_LO, hi=REPLY_OVERRIDE_CAP)


def normalize_generation_budgets_admin_defaults(patch: dict[str, Any]) -> dict[str, Any]:
    """Sanitize admin PATCH fragment for generation budget keys only."""
    out: dict[str, Any] = {}
    if "desktop_chat_num_predict" in patch:
        out["desktop_chat_num_predict"] = desktop_chat_num_predict(
            {"desktop_chat_num_predict": patch.get("desktop_chat_num_predict")}
        )
    if "desktop_chat_timeout_sec" in patch:
        out["desktop_chat_timeout_sec"] = desktop_chat_timeout_sec(
            {"desktop_chat_timeout_sec": patch.get("desktop_chat_timeout_sec")}
        )
    if "ensemble_separate_reply_max_tokens" in patch:
        # Persist clamped positive override (admin form always sends an explicit value).
        out["ensemble_separate_reply_max_tokens"] = _clamp_int(
            patch.get("ensemble_separate_reply_max_tokens"),
            default=SEPARATE_STANDARD_DEFAULT,
            lo=SEPARATE_REPLY_LO,
            hi=REPLY_OVERRIDE_CAP,
        )
    if "ensemble_joint_section_max_tokens" in patch:
        out["ensemble_joint_section_max_tokens"] = _clamp_int(
            patch.get("ensemble_joint_section_max_tokens"),
            default=JOINT_STANDARD_DEFAULT,
            lo=JOINT_SECTION_LO,
            hi=REPLY_OVERRIDE_CAP,
        )
    if "ensemble_blueprint_step_max_tokens" in patch:
        out["ensemble_blueprint_step_max_tokens"] = _clamp_int(
            patch.get("ensemble_blueprint_step_max_tokens"),
            default=BLUEPRINT_STEP_DEFAULT,
            lo=BLUEPRINT_STEP_LO,
            hi=REPLY_OVERRIDE_CAP,
        )
    return out
