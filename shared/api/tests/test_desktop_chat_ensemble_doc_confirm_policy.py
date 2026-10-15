# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Unit tests for ensemble semi-auto document confirm TTL policy.
# Invariants:
# - Expired `asked` resolves to declined without requiring user action.
# Related:
# - api/services/desktop_chat_ensemble/doc_confirm_policy.py
# ---
"""Tests for ensemble document confirm TTL helpers."""

from __future__ import annotations

from datetime import timedelta
from types import SimpleNamespace

from api.services.desktop_chat_ensemble.doc_confirm_policy import (
    ENSEMBLE_DOC_CONFIRM_ASKED_AT_KEY,
    doc_confirm_is_expired,
    resolve_doc_confirm_state,
    resolve_ensemble_doc_confirm_ttl_seconds,
    stamp_doc_confirm_asked,
)
from api.services.desktop_chat_ensemble.settings import (
    ENSEMBLE_DOC_CONFIRM_ASKED,
    ENSEMBLE_DOC_CONFIRM_DECLINED,
)
from api.utils.datetime_helpers import utc_now_naive


def test_resolve_ttl_seconds_clamps_and_defaults() -> None:
    assert resolve_ensemble_doc_confirm_ttl_seconds({}) == 3600
    assert resolve_ensemble_doc_confirm_ttl_seconds({"desktop_ensemble_doc_confirm_ttl_seconds": 30}) == 60
    assert resolve_ensemble_doc_confirm_ttl_seconds({"desktop_ensemble_doc_confirm_ttl_seconds": 999_999}) == 86_400


def test_expired_asked_reports_declined_state() -> None:
    asked_at = (utc_now_naive() - timedelta(hours=2)).isoformat(timespec="seconds")
    msg = SimpleNamespace(
        message_metadata={
            "ensemble_doc_confirm": ENSEMBLE_DOC_CONFIRM_ASKED,
            ENSEMBLE_DOC_CONFIRM_ASKED_AT_KEY: asked_at,
        },
        created_at=asked_at,
    )
    assert doc_confirm_is_expired(msg, {}) is True
    assert resolve_doc_confirm_state(msg, {}) == ENSEMBLE_DOC_CONFIRM_DECLINED


def test_fresh_asked_stays_pending() -> None:
    asked_at = utc_now_naive().isoformat(timespec="seconds")
    msg = SimpleNamespace(
        message_metadata={
            "ensemble_doc_confirm": ENSEMBLE_DOC_CONFIRM_ASKED,
            ENSEMBLE_DOC_CONFIRM_ASKED_AT_KEY: asked_at,
        },
        created_at=asked_at,
    )
    assert doc_confirm_is_expired(msg, {}) is False
    assert resolve_doc_confirm_state(msg, {}) == ENSEMBLE_DOC_CONFIRM_ASKED


def test_stamp_doc_confirm_asked_preserves_first_timestamp() -> None:
    first = stamp_doc_confirm_asked({})
    second = stamp_doc_confirm_asked(first)
    assert first[ENSEMBLE_DOC_CONFIRM_ASKED_AT_KEY] == second[ENSEMBLE_DOC_CONFIRM_ASKED_AT_KEY]
