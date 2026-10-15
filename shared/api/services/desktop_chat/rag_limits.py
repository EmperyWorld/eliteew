# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# RAG budget limits for desktop chat (chat attachments and project vault caps).
# Invariants:
# - Vault and chat caps stay within documented clamp ranges for admin defaults.
# Related:
# - api/services/desktop_chat/service.py
# ---

"""Лимиты RAG для desktop chat (без тяжёлых импортов — удобно для тестов)."""

from __future__ import annotations

from typing import Any

_DEFAULT_PROJECT_VAULT_CHUNK_CAP = 16
_DEFAULT_PROJECT_VAULT_MAX_PER_CONTENT_ID = 2
# Phase 3 redesign inject budgets (code fallback when key absent from stored defaults).
DEFAULT_RAG_TOP_K = 8
DEFAULT_RAG_MAX_CHUNKS_CHARS = 8_000
DEFAULT_RAG_CHAT_MAX_CHUNKS = 8


def desktop_rag_top_k(defaults: dict[str, Any]) -> int:
    """Pool size for desktop RAG retrieval (clamp 1…32). Stored ``rag_top_k`` wins when set."""
    raw = defaults.get("rag_top_k")
    try:
        n = int(raw) if raw is not None and str(raw).strip() != "" else DEFAULT_RAG_TOP_K
    except (TypeError, ValueError):  # fmt: skip
        n = DEFAULT_RAG_TOP_K
    return max(1, min(32, n))


def desktop_rag_max_chunks_chars(defaults: dict[str, Any]) -> int:
    """Max chars of RAG chunk text injected into the prompt. Stored key wins when set."""
    raw = defaults.get("rag_max_chunks_chars")
    try:
        n = int(raw) if raw is not None and str(raw).strip() != "" else DEFAULT_RAG_MAX_CHUNKS_CHARS
    except (TypeError, ValueError):  # fmt: skip
        n = DEFAULT_RAG_MAX_CHUNKS_CHARS
    # Hard clamp: never silent-raise above 48k even if admin mis-sets.
    return max(500, min(48_000, n))


def desktop_project_vault_chunk_cap(defaults: dict[str, Any]) -> int:
    """Макс. число чанков vault проекта в промпте (сверху ограничено ``rag_top_k`` в вызывающем коде)."""
    raw = defaults.get("rag_project_vault_max_chunks")
    try:
        n = int(raw) if raw is not None and str(raw).strip() != "" else _DEFAULT_PROJECT_VAULT_CHUNK_CAP
    except (TypeError, ValueError):  # fmt: skip
        n = _DEFAULT_PROJECT_VAULT_CHUNK_CAP
    return max(1, min(32, n))


def desktop_project_vault_max_per_content_id(defaults: dict[str, Any]) -> int:
    """Сколько чанков одного unified_content допускается в vault-контексте desktop chat."""
    raw = defaults.get("rag_project_vault_max_per_content_id")
    try:
        n = int(raw) if raw is not None and str(raw).strip() != "" else _DEFAULT_PROJECT_VAULT_MAX_PER_CONTENT_ID
    except (TypeError, ValueError):  # fmt: skip
        n = _DEFAULT_PROJECT_VAULT_MAX_PER_CONTENT_ID
    return max(1, min(8, n))
