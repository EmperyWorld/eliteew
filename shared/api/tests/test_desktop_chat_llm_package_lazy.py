# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Lock lazy llm package barrel — no eager json_sidecar/runtime cycle on import.
# Related:
# - api/services/desktop_chat/llm/__init__.py
# - api/services/desktop_chat_ensemble/blueprint/stream_turn.py
# ---

from __future__ import annotations

import importlib
import sys
from collections.abc import Iterator

import pytest

_LLM_PREFIX = "api.services.desktop_chat.llm"


def _purge_llm_modules() -> None:
    for key in list(sys.modules):
        if key == _LLM_PREFIX or key.startswith(f"{_LLM_PREFIX}."):
            del sys.modules[key]


@pytest.fixture(autouse=True)
def isolate_llm_modules() -> Iterator[None]:
    _purge_llm_modules()
    yield
    _purge_llm_modules()


def test_llm_package_init_is_lazy() -> None:
    pkg = importlib.import_module(_LLM_PREFIX)
    assert f"{_LLM_PREFIX}.runtime" not in sys.modules
    assert f"{_LLM_PREFIX}.json_sidecar" not in sys.modules
    assert "desktop_stream_chat_completion" in pkg.__all__


def test_importing_runtime_submodule_skips_json_sidecar() -> None:
    """blueprint.stream_turn imports llm.runtime — must not pull sidecar via package init."""
    importlib.import_module(f"{_LLM_PREFIX}.runtime")
    assert f"{_LLM_PREFIX}.runtime" in sys.modules
    assert f"{_LLM_PREFIX}.json_sidecar" not in sys.modules


def test_lazy_getattr_loads_runtime_export() -> None:
    pkg = importlib.import_module(_LLM_PREFIX)
    fn = pkg.desktop_stream_chat_completion
    assert callable(fn)
    assert f"{_LLM_PREFIX}.runtime" in sys.modules
    assert f"{_LLM_PREFIX}.json_sidecar" not in sys.modules
