"""Predicate for joint_polish retry when output was likely truncated by max_tokens."""

from __future__ import annotations

from api.services.desktop_chat_ensemble.joint_polish_limits import (
    joint_polish_compression_retry_enabled,
    joint_polish_truncation_retryable,
)


def test_joint_polish_truncation_retryable_finish_length() -> None:
    assert joint_polish_truncation_retryable({"finish_reason": "length", "completion_tokens": 1}, 10_000)


def test_joint_polish_truncation_retryable_near_token_cap() -> None:
    assert joint_polish_truncation_retryable({"finish_reason": "stop", "completion_tokens": 9500}, 10_000)


def test_joint_polish_truncation_retryable_not_when_stop_and_low_usage() -> None:
    assert not joint_polish_truncation_retryable({"finish_reason": "stop", "completion_tokens": 100}, 10_000)


def test_joint_polish_truncation_retryable_zero_cap() -> None:
    assert not joint_polish_truncation_retryable({"finish_reason": "stop", "completion_tokens": 100}, 0)


def test_joint_polish_compression_retry_enabled_default() -> None:
    assert joint_polish_compression_retry_enabled({})


def test_joint_polish_compression_retry_disabled() -> None:
    assert not joint_polish_compression_retry_enabled({"ensemble_joint_polish_compression_retry": False})
