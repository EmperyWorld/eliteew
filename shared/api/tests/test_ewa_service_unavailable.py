# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Unit tests for structured EWA **503** payloads (``ewa_service_unavailable``).
# Invariants:
# - No HTTP server; only ``detail`` shape and env branching.
# Related:
# - api/ewa_platform/gateways/ewa_service_unavailable.py
# - documentation/platform/docker-re_doc/EWA-POSTGRES-RUNBOOK.md
# ---
from __future__ import annotations

import pytest

from api.ewa_platform.gateways.ewa_service_unavailable import (
    CODE_COMPANION_CHAT_LLM_DISABLED,
    CODE_EWA_DATABASE_URL_UNSET,
    CODE_EWA_ORCHESTRATION_POOL_UNAVAILABLE,
    companion_chat_llm_disabled_exception,
    ewa_pool_unavailable_detail,
    ewa_pool_unavailable_exception,
)


def test_ewa_pool_detail_unset_when_no_dsn(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("EWA_DATABASE_URL", raising=False)
    d = ewa_pool_unavailable_detail()
    assert d["code"] == CODE_EWA_DATABASE_URL_UNSET


def test_ewa_pool_detail_unavailable_when_dsn_but_expected_pool_missing(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_DATABASE_URL", "postgresql://x:y@localhost:5432/ewa")
    d = ewa_pool_unavailable_detail()
    assert d["code"] == CODE_EWA_ORCHESTRATION_POOL_UNAVAILABLE


def test_ewa_pool_exception_is_503() -> None:
    exc = ewa_pool_unavailable_exception()
    assert exc.status_code == 503
    assert isinstance(exc.detail, dict)


def test_companion_llm_disabled_code_constant() -> None:
    exc = companion_chat_llm_disabled_exception()
    assert exc.status_code == 503
    assert exc.detail["code"] == CODE_COMPANION_CHAT_LLM_DISABLED
