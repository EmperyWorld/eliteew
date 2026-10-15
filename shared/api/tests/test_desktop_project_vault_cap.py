"""Потолок чанков project vault в desktop build_rag_prefix."""

from __future__ import annotations

from api.services.desktop_chat.rag_limits import desktop_project_vault_chunk_cap


def test_desktop_project_vault_chunk_cap_default() -> None:
    assert desktop_project_vault_chunk_cap({}) == 16


def test_desktop_project_vault_chunk_cap_override() -> None:
    assert desktop_project_vault_chunk_cap({"rag_project_vault_max_chunks": 12}) == 12


def test_desktop_project_vault_chunk_cap_clamped() -> None:
    assert desktop_project_vault_chunk_cap({"rag_project_vault_max_chunks": 99}) == 32
    assert desktop_project_vault_chunk_cap({"rag_project_vault_max_chunks": 0}) == 1
