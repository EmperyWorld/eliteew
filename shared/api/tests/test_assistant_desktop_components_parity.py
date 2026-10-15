# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Parity guard: shared manifest, GAF allowlist, and frontend assistant link set stay aligned.
# Invariants:
# - EliteEW/shared/assistant_desktop_link_components.json is the single source of truth.
# Related:
# - api/gaf_chat/system_gaf_instruction.py
# - api/routers/desktop.py (KNOWN_DESKTOP_APP_COMPONENTS)
# - shared/web/frontend/src/pages/Desktop/utils/assistantDesktopLinkComponents.ts
# - shared/web/frontend/src/pages/Admin/systemGafInstructionShared.ts
# ---

from __future__ import annotations

import json
import re
from pathlib import Path

from api.gaf_chat.assistant_desktop_link_manifest import load_assistant_desktop_link_manifest
from api.gaf_chat.system_gaf_instruction import ALLOWED_DESKTOP_APP_COMPONENTS
from api.routers.desktop import KNOWN_DESKTOP_APP_COMPONENTS

_MANIFEST_PATH = Path(__file__).resolve().parents[2] / "assistant_desktop_link_components.json"
_FRONTEND_TS_PATH = (
    Path(__file__).resolve().parents[2]
    / "web"
    / "frontend"
    / "src"
    / "pages"
    / "Desktop"
    / "utils"
    / "assistantDesktopLinkComponents.ts"
)


def _manifest_app_components() -> frozenset[str]:
    data = load_assistant_desktop_link_manifest()
    return frozenset(data["app_components"])


def _frontend_manifest_import_path() -> str:
    text = _FRONTEND_TS_PATH.read_text(encoding="utf-8")
    match = re.search(
        r"from\s+['\"](.+assistant_desktop_link_components\.json)['\"]",
        text,
    )
    assert match is not None, "frontend must import shared assistant desktop link manifest"
    return match.group(1)


def test_manifest_app_components_match_allowed_desktop_app_components() -> None:
    manifest_apps = _manifest_app_components()
    assert manifest_apps == ALLOWED_DESKTOP_APP_COMPONENTS
    assert "MusicForgeApp" in manifest_apps
    assert "MusicGenerator" not in manifest_apps
    assert "MusicEvolutionApp" not in manifest_apps
    assert "VideoCallApp" in manifest_apps


def test_manifest_app_components_subset_of_known_desktop_catalog() -> None:
    manifest_apps = _manifest_app_components()
    extras = manifest_apps - KNOWN_DESKTOP_APP_COMPONENTS
    assert not extras, (
        "manifest app_components must be subset of KNOWN_DESKTOP_APP_COMPONENTS; "
        f"missing from catalog: {sorted(extras)}"
    )
    assert "VideoCallApp" in KNOWN_DESKTOP_APP_COMPONENTS
    assert "MusicForgeApp" in KNOWN_DESKTOP_APP_COMPONENTS


def test_frontend_imports_shared_manifest_and_app_set_matches() -> None:
    raw = json.loads(_MANIFEST_PATH.read_text(encoding="utf-8"))
    manifest_apps = frozenset(raw["app_components"])
    manifest_shell = frozenset(raw["shell_link_components"])
    assert manifest_apps.isdisjoint(manifest_shell)

    import_rel = _frontend_manifest_import_path()
    assert import_rel.endswith("assistant_desktop_link_components.json")
    assert "shared/shared/" not in import_rel.replace("\\", "/")

    ts_text = _FRONTEND_TS_PATH.read_text(encoding="utf-8")
    assert "assistantDesktopLinkManifest.app_components" in ts_text
    assert "assistantDesktopLinkManifest.shell_link_components" in ts_text
    assert "MusicGenerator: 'MusicForgeApp'" in ts_text

    expected_frontend = manifest_apps | manifest_shell
    assert len(expected_frontend) == len(manifest_apps) + len(manifest_shell)
