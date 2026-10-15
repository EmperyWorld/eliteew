# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Contract tests for the Poemma desktop app component across backend validation and assistant allowlists.
# Invariants:
# - PoemmaApp must be accepted wherever persisted/catalog desktop app components are validated.
# - Assistant and companion open-app allowlists must not drift from the desktop catalog for Poemma.
# Related:
# - api/routers/desktop.py
# - api/gaf_chat/system_gaf_instruction.py
# - api/ewa_platform/companion/actions/allowlist.py
# ---

from api.ewa_platform.companion.actions.allowlist import ALLOWED_APP_COMPONENTS
from api.gaf_chat.system_gaf_instruction import ALLOWED_DESKTOP_APP_COMPONENTS
from api.routers.desktop import KNOWN_DESKTOP_APP_COMPONENTS


def test_poemma_app_component_is_backend_allowlisted() -> None:
    assert "PoemmaApp" in KNOWN_DESKTOP_APP_COMPONENTS
    assert "PoemmaApp" in ALLOWED_DESKTOP_APP_COMPONENTS
    assert "PoemmaApp" in ALLOWED_APP_COMPONENTS
