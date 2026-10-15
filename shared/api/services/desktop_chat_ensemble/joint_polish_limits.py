# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Backend module `services/desktop_chat_ensemble/joint_polish_limits.py`; preserves its existing EliteEW API/service responsibilities.
# Invariants:
# - Keep existing public contracts and side effects stable across Python 3.14 syntax remediation.
# Related:
# - documentation/worklog/session-summaries/2026-05-28-0124-eliteew-api-worker-audit.md
# ---

"""Пороги длины для joint_polish: отдельный модуль без тяжёлых зависимостей (тесты, конфиг)."""

from __future__ import annotations

from typing import Any

# Дефолты жёстче, чем раньше: сильное сжатие чаще откатывается (остаётся склейка до polish).
_DEFAULT_MIN_POST_RATIO_SHORT = 0.93  # pre < 4k: не короче ~93% исходника
_DEFAULT_MIN_POST_RATIO_MID = 0.68  # 4k…28k: не короче ~68% (раньше 0.32 допускало почти 70% выкидывания)
_DEFAULT_MIN_POST_FLOOR_MID = 2_500
_DEFAULT_LARGE_PRE = 28_000
_DEFAULT_MIN_POST_RATIO_LONG = 0.45  # длинные склейки: минимум ~45% длины (раньше 0.18)
_DEFAULT_MIN_POST_FLOOR_LONG = 18_000


def compute_joint_polish_min_post(pre: int, defaults: dict[str, Any]) -> int:
    """Минимально допустимая длина ответа шлифовки; если меньше — откат к исходной склейке."""
    ratio_short_raw = defaults.get("ensemble_joint_polish_min_post_ratio_short")
    try:
        ratio_short = (
            float(ratio_short_raw)
            if ratio_short_raw is not None and str(ratio_short_raw).strip() != ""
            else _DEFAULT_MIN_POST_RATIO_SHORT
        )
    except (TypeError, ValueError):  # fmt: skip
        ratio_short = _DEFAULT_MIN_POST_RATIO_SHORT

    ratio_mid_raw = defaults.get("ensemble_joint_polish_min_post_ratio")
    try:
        ratio_mid = (
            float(ratio_mid_raw)
            if ratio_mid_raw is not None and str(ratio_mid_raw).strip() != ""
            else _DEFAULT_MIN_POST_RATIO_MID
        )
    except (TypeError, ValueError):  # fmt: skip
        ratio_mid = _DEFAULT_MIN_POST_RATIO_MID

    floor_mid_raw = defaults.get("ensemble_joint_polish_min_post_floor")
    try:
        floor_mid = (
            int(floor_mid_raw)
            if floor_mid_raw is not None and str(floor_mid_raw).strip() != ""
            else _DEFAULT_MIN_POST_FLOOR_MID
        )
    except (TypeError, ValueError):  # fmt: skip
        floor_mid = _DEFAULT_MIN_POST_FLOOR_MID

    ratio_long_raw = defaults.get("ensemble_joint_polish_min_post_ratio_long")
    try:
        ratio_long = (
            float(ratio_long_raw)
            if ratio_long_raw is not None and str(ratio_long_raw).strip() != ""
            else _DEFAULT_MIN_POST_RATIO_LONG
        )
    except (TypeError, ValueError):  # fmt: skip
        ratio_long = _DEFAULT_MIN_POST_RATIO_LONG

    floor_long_raw = defaults.get("ensemble_joint_polish_min_post_floor_long")
    try:
        floor_long = (
            int(floor_long_raw)
            if floor_long_raw is not None and str(floor_long_raw).strip() != ""
            else _DEFAULT_MIN_POST_FLOOR_LONG
        )
    except (TypeError, ValueError):  # fmt: skip
        floor_long = _DEFAULT_MIN_POST_FLOOR_LONG

    large_pre_raw = defaults.get("ensemble_joint_polish_large_pre_chars")
    try:
        large_pre = (
            int(large_pre_raw) if large_pre_raw is not None and str(large_pre_raw).strip() != "" else _DEFAULT_LARGE_PRE
        )
    except (TypeError, ValueError):  # fmt: skip
        large_pre = _DEFAULT_LARGE_PRE

    if pre < 4_000:
        return int(pre * ratio_short)
    if pre < large_pre:
        return max(floor_mid, int(pre * ratio_mid))
    return max(floor_long, int(pre * ratio_long))


def joint_polish_compression_retry_enabled(defaults: dict[str, Any]) -> bool:
    """Второй тип retry: модель закончила по stop, но сильно сжала текст (не обрезка по лимиту)."""
    return defaults.get("ensemble_joint_polish_compression_retry") is not False


def joint_polish_truncation_retryable(result: dict[str, Any], max_tokens_requested: int) -> bool:
    """True if a short polish output is plausibly due to the generation limit (one retry with higher cap)."""
    fr = str(result.get("finish_reason") or "").strip().lower()
    if fr == "length":
        return True
    if max_tokens_requested <= 0:
        return False
    comp = int(result.get("completion_tokens") or 0)
    return comp >= int(max_tokens_requested * 0.95)


def resolve_large_pre_threshold(defaults: dict[str, Any]) -> int:
    """Граница «длинной» склейки для num_predict (совпадает с compute по умолчанию)."""
    try:
        raw = defaults.get("ensemble_joint_polish_large_pre_chars")
        if raw is not None and str(raw).strip() != "":
            return int(raw)
    except (TypeError, ValueError):  # fmt: skip
        pass
    return _DEFAULT_LARGE_PRE
