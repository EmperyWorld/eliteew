# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Unit tests for llama.cpp model id resolve (basename vs /models/… path).
# Invariants:
# - — (нет)
# Related:
# - api/utils/llama_models.py
# ---
"""resolve_model_id: env basename ↔ server /models/*.gguf id."""

from __future__ import annotations

from api.utils.llama_models import resolve_model_id


def test_resolve_exact_match() -> None:
    available = ["/models/gemma-4-26B.gguf"]
    assert resolve_model_id("/models/gemma-4-26B.gguf", available) == "/models/gemma-4-26B.gguf"


def test_resolve_basename_to_server_path() -> None:
    available = ["/models/gemma-4-26B.gguf"]
    assert resolve_model_id("gemma-4-26B.gguf", available) == "/models/gemma-4-26B.gguf"


def test_resolve_missing() -> None:
    available = ["/models/gemma-4-26B.gguf"]
    assert resolve_model_id("other.gguf", available) is None


def test_resolve_empty() -> None:
    assert resolve_model_id("", ["/models/a.gguf"]) is None
    assert resolve_model_id("a.gguf", []) is None
