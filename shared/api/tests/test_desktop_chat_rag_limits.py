# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Unit tests for desktop chat RAG limit helpers.
# Invariants:
# - Vault per-content cap defaults and clamps match product contract.
# Related:
# - api/services/desktop_chat/rag_limits.py
# ---
"""Tests for desktop chat RAG limit helpers."""

from __future__ import annotations

from api.services.desktop_chat.rag_limits import (
    desktop_project_vault_chunk_cap,
    desktop_project_vault_max_per_content_id,
)


def test_project_vault_max_per_content_id_defaults_and_clamps() -> None:
    assert desktop_project_vault_max_per_content_id({}) == 2
    assert desktop_project_vault_max_per_content_id({"rag_project_vault_max_per_content_id": 0}) == 1
    assert desktop_project_vault_max_per_content_id({"rag_project_vault_max_per_content_id": 99}) == 8


def test_project_vault_chunk_cap_defaults_and_clamps() -> None:
    assert desktop_project_vault_chunk_cap({}) == 16
    assert desktop_project_vault_chunk_cap({"rag_project_vault_max_chunks": 0}) == 1
    assert desktop_project_vault_chunk_cap({"rag_project_vault_max_chunks": 64}) == 32
