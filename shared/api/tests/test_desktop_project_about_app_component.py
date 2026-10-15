# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Contract tests for the «О проекте» desktop app component across backend validation and assistant allowlists.
# Invariants:
# - ProjectAboutApp must be accepted wherever persisted/catalog desktop app components are validated.
# Related:
# - api/routers/desktop.py
# - api/gaf_chat/system_gaf_instruction.py
# - api/ewa_platform/companion/actions/allowlist.py
# ---

from api.ewa_platform.companion.actions.allowlist import ALLOWED_APP_COMPONENTS
from api.gaf_chat.system_gaf_instruction import ALLOWED_DESKTOP_APP_COMPONENTS
from api.routers.desktop import KNOWN_DESKTOP_APP_COMPONENTS


def test_project_about_app_component_is_backend_allowlisted() -> None:
    assert "ProjectAboutApp" in KNOWN_DESKTOP_APP_COMPONENTS
    assert "ProjectAboutApp" in ALLOWED_DESKTOP_APP_COMPONENTS
    assert "ProjectAboutApp" in ALLOWED_APP_COMPONENTS
