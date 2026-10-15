"""Fuzz-style smoke tests for dashboard widget_config sanitization (I.89)."""

from __future__ import annotations

import random
import string

import pytest

from api.services.marketing_cabinet.dashboard_widget_config import (
    MARKETING_DASHBOARD_WIDGET_KEYS,
    sanitize_widget_config,
)

_KEYS = tuple(MARKETING_DASHBOARD_WIDGET_KEYS)


def _rand_str(rng: random.Random, max_len: int = 32) -> str:
    n = rng.randint(0, max_len)
    alphabet = string.ascii_letters + string.digits + " \t\n{}[]\"':/"
    return "".join(rng.choice(alphabet) for _ in range(n))


def _rand_json(rng: random.Random, depth: int) -> object:
    if depth <= 0:
        choice = rng.randint(0, 4)
        if choice == 0:
            return rng.randint(-1000, 1000)
        if choice == 1:
            return rng.random()
        if choice == 2:
            return rng.choice([True, False, None])
        return _rand_str(rng)
    choice = rng.randint(0, 3)
    if choice == 0:
        return [_rand_json(rng, depth - 1) for _ in range(rng.randint(0, 5))]
    if choice == 1:
        return {_rand_str(rng, 8): _rand_json(rng, depth - 1) for _ in range(rng.randint(0, 6))}
    return _rand_str(rng)


@pytest.mark.parametrize("_run", range(25))
def test_sanitize_widget_config_random_payloads_never_crash(_run: int) -> None:
    rng = random.Random(_run + 42)
    for key in _KEYS:
        raw = _rand_json(rng, 4)
        payload = raw if isinstance(raw, dict) else {"v": raw}
        out = sanitize_widget_config(key, payload)
        assert isinstance(out, dict)
