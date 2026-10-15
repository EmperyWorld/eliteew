"""Пороги joint_polish без импорта legacy_freeform-пакета (там тянется весь стрим)."""

from __future__ import annotations

from api.services.desktop_chat_ensemble.joint_polish_limits import compute_joint_polish_min_post


def test_compute_joint_polish_min_post_short_band() -> None:
    assert compute_joint_polish_min_post(1000, {}) == int(1000 * 0.93)


def test_compute_joint_polish_min_post_mid_band() -> None:
    assert compute_joint_polish_min_post(9924, {}) == max(2500, int(9924 * 0.68))


def test_compute_joint_polish_min_post_long_band() -> None:
    pre = 50_000
    assert compute_joint_polish_min_post(pre, {}) == max(18_000, int(pre * 0.45))
