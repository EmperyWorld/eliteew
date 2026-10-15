# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Load shared assistant/GAF desktop deep-link allowlist from JSON manifest.
# Invariants:
# - Single source of truth: shared/assistant_desktop_link_components.json (host).
# - Container bake: /app/shared/assistant_desktop_link_components.json.
# - app_components and shell_link_components are disjoint sets.
# Related:
# - api/gaf_chat/system_gaf_instruction.py
# - shared/web/frontend/src/pages/Desktop/utils/assistantDesktopLinkComponents.ts
# ---

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path


def _resolve_manifest_path() -> Path:
    """Host Wave4: shared/api → shared/<file>; container: /app/api → /app/shared/<file>."""
    api_root = Path(__file__).resolve().parents[1]
    candidates = (
        api_root.parent / "assistant_desktop_link_components.json",
        api_root.parent / "shared" / "assistant_desktop_link_components.json",
    )
    for path in candidates:
        if path.is_file():
            return path
    joined = ", ".join(str(p) for p in candidates)
    raise FileNotFoundError("assistant_desktop_link_components.json not found; tried: " + joined)


_MANIFEST_PATH = _resolve_manifest_path()


@lru_cache(maxsize=1)
def load_assistant_desktop_link_manifest() -> dict[str, list[str]]:
    raw = _MANIFEST_PATH.read_text(encoding="utf-8")
    data = json.loads(raw)
    if not isinstance(data, dict):
        msg = "assistant desktop link manifest must be a JSON object"
        raise TypeError(msg)
    app = data.get("app_components")
    shell = data.get("shell_link_components")
    if not isinstance(app, list) or not all(isinstance(x, str) for x in app):
        msg = "app_components must be a list of strings"
        raise TypeError(msg)
    if not isinstance(shell, list) or not all(isinstance(x, str) for x in shell):
        msg = "shell_link_components must be a list of strings"
        raise TypeError(msg)
    overlap = set(app) & set(shell)
    if overlap:
        msg = f"app_components and shell_link_components overlap: {overlap!r}"
        raise ValueError(msg)
    return {"app_components": app, "shell_link_components": shell}


def assistant_app_components() -> frozenset[str]:
    return frozenset(load_assistant_desktop_link_manifest()["app_components"])


def assistant_shell_link_components() -> frozenset[str]:
    return frozenset(load_assistant_desktop_link_manifest()["shell_link_components"])
