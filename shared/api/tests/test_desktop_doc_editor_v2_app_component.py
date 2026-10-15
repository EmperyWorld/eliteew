#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Contract tests for the Document Editor V2 desktop app component across backend allowlists.
# Invariants:
# - DocEditorV2 must be accepted wherever persisted/catalog desktop app components are validated.
# - Assistant and companion open-app allowlists must not drift from the desktop catalog for V2.
# Related:
# - api/routers/desktop.py
# - api/gaf_chat/system_gaf_instruction.py
# - api/ewa_platform/companion/actions/allowlist.py
# ---

from api.ewa_platform.companion.actions.allowlist import ALLOWED_APP_COMPONENTS
from api.gaf_chat.system_gaf_instruction import ALLOWED_DESKTOP_APP_COMPONENTS
from api.routers.desktop import KNOWN_DESKTOP_APP_COMPONENTS


def test_doc_editor_v2_app_component_is_backend_allowlisted() -> None:
    assert "DocEditorV2" in KNOWN_DESKTOP_APP_COMPONENTS
    assert "DocEditorV2" in ALLOWED_DESKTOP_APP_COMPONENTS
    assert "DocEditorV2" in ALLOWED_APP_COMPONENTS
