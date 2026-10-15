# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Contract tests for ``parse_ugs_generation_request_id`` (stdlib-only; no aiohttp import chain).
# Invariants:
# - Missing or empty `request_id` must raise ValueError.
# Related:
# - api/workers/ugs_queue_validation.py
# ---
"""Tests for UGS queue payload validation."""

from __future__ import annotations

import pytest

from api.workers.ugs_queue_validation import parse_ugs_generation_request_id


def test_parse_ugs_generation_request_id_rejects_missing() -> None:
    with pytest.raises(ValueError, match="missing request_id"):
        parse_ugs_generation_request_id({})


def test_parse_ugs_generation_request_id_rejects_empty() -> None:
    with pytest.raises(ValueError, match="empty request_id"):
        parse_ugs_generation_request_id({"request_id": "   "})


def test_parse_ugs_generation_request_id_ok() -> None:
    assert parse_ugs_generation_request_id({"request_id": "  uuid-here  "}) == "uuid-here"
