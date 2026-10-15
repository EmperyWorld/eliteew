# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Unit tests for ``domain_hints`` wire normalization and predicates used before ``domain_hints`` events persist.
# Invariants:
# - No HTTP or Postgres.
# Related:
# - api/ewa_platform/contracts/domain_hints_wire.py
# - api/ewa_platform/io/domain_hints.py
# ---
from __future__ import annotations

from api.ewa_platform.contracts.domain_hints_wire import (
    content_manager_hint_wire_wellformed,
    documents_workspace_hint_wire_wellformed,
    normalize_content_manager_hint_wire,
    normalize_documents_workspace_hint_wire,
)
from api.ewa_platform.io.domain_hints import (
    ensure_content_manager_hint_wire_or_raise,
    ensure_documents_workspace_hint_wire_or_raise,
)


def test_normalize_documents_fills_source_and_items_type() -> None:
    raw: dict[str, object] = {"open_document_count": 0}
    got = normalize_documents_workspace_hint_wire(raw)
    assert got["source"] == "unspecified_source_normalized"
    assert got["items"] == []
    assert got["open_document_count"] == 0
    assert documents_workspace_hint_wire_wellformed(got)


def test_normalize_documents_preserves_status_code() -> None:
    raw = {"items": [], "open_document_count": 0, "source": "x", "status_code": 502}
    got = normalize_documents_workspace_hint_wire(raw)
    assert got["status_code"] == 502


def test_normalize_content_roots_strip_strings() -> None:
    raw = {"roots": [" a ", 3, "b"], "source": ""}
    got = normalize_content_manager_hint_wire(raw)
    assert got["roots"] == ["a", "b"]
    assert got["source"] == "unspecified_source_normalized"
    assert content_manager_hint_wire_wellformed(got)


def test_ensure_documents_roundtrip_empty_mapping() -> None:
    """Normalizer fills canonical triple from empty mapping."""

    got = ensure_documents_workspace_hint_wire_or_raise({})
    assert documents_workspace_hint_wire_wellformed(got)


def test_ensure_content_roundtrip_empty_mapping() -> None:
    got = ensure_content_manager_hint_wire_or_raise({})
    assert content_manager_hint_wire_wellformed(got)
