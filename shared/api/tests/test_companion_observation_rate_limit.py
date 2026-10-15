# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Contract tests for **companion observation** token-bucket limiting (principal-keyed).
# Invariants:
# - No FastAPI stack; exercises env parsing + ``RateLimiter`` wiring only.
# Related:
# - api/ewa_platform/companion/ux/observation_rate_limit.py
# - api/ewa_platform/gateways/routers/companion_chat.py
# ---
"""Tests: companion proactive observation tick rate limiting."""

from __future__ import annotations

import os
from unittest.mock import patch

from api.ewa_platform.companion.ux.observation_rate_limit import (
    COMPANION_OBSERVATION_RATE_LIMIT_DEFAULT_PER_MIN,
    COMPANION_OBSERVATION_RATE_LIMIT_DISABLED_ENV,
    COMPANION_OBSERVATION_RATE_LIMIT_ENV_KEY,
    companion_observation_rate_limit_allow,
    parse_companion_observation_rate_limit_per_minute_from_env,
    reset_companion_observation_rate_limiter_for_tests,
)


def setup_function() -> None:
    reset_companion_observation_rate_limiter_for_tests()


def teardown_function() -> None:
    reset_companion_observation_rate_limiter_for_tests()


def test_parse_rate_limit_clamps_high() -> None:
    key = COMPANION_OBSERVATION_RATE_LIMIT_ENV_KEY
    with patch.dict(os.environ, {key: "9999"}, clear=False):
        assert parse_companion_observation_rate_limit_per_minute_from_env() == 480


def test_parse_rate_limit_clamps_low() -> None:
    key = COMPANION_OBSERVATION_RATE_LIMIT_ENV_KEY
    with patch.dict(os.environ, {key: "3"}, clear=False):
        assert parse_companion_observation_rate_limit_per_minute_from_env() == 20


def test_disabled_env_skips_limiter() -> None:
    key = COMPANION_OBSERVATION_RATE_LIMIT_DISABLED_ENV
    env = {
        key: "1",
        COMPANION_OBSERVATION_RATE_LIMIT_ENV_KEY: "1",
    }
    reset_companion_observation_rate_limiter_for_tests()
    with patch.dict(os.environ, env, clear=False):
        for _ in range(5000):
            allowed, retry = companion_observation_rate_limit_allow("principal-x")
            assert allowed is True
            assert retry is None


def test_tick_denied_when_bucket_exhausted() -> None:
    """Twenty-first immediate tick exceeds burst when cap/minute equals burst (20 minimum clamp)."""

    env = {
        COMPANION_OBSERVATION_RATE_LIMIT_ENV_KEY: "20",
        COMPANION_OBSERVATION_RATE_LIMIT_DISABLED_ENV: "",
    }
    reset_companion_observation_rate_limiter_for_tests()
    with patch.dict(os.environ, env, clear=False):
        pid = "p-limit-20-test"
        for _ in range(20):
            allowed, retry = companion_observation_rate_limit_allow(pid)
            assert allowed is True
            assert retry is None
        allowed21, retry21 = companion_observation_rate_limit_allow(pid)
        assert allowed21 is False
        assert retry21 is not None
        assert float(retry21) > 0.0


def test_principal_key_isolation() -> None:
    env = {
        COMPANION_OBSERVATION_RATE_LIMIT_ENV_KEY: str(COMPANION_OBSERVATION_RATE_LIMIT_DEFAULT_PER_MIN),
    }
    reset_companion_observation_rate_limiter_for_tests()
    with patch.dict(os.environ, env, clear=False):
        a_allowed, _ = companion_observation_rate_limit_allow("user-a-isolated")
        b_allowed, _ = companion_observation_rate_limit_allow("user-b-isolated")
        assert a_allowed is True
        assert b_allowed is True
