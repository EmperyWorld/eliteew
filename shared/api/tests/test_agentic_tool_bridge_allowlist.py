# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# effective_session_tool_allowlist hides runtime-disabled tools from agentic Think/Act.
# ---

from __future__ import annotations

import pytest

from api.ewa_platform.agentic.tools.bridge import effective_session_tool_allowlist


def test_effective_allowlist_excludes_document_extractor_when_disabled(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("EWA_AGENTIC_TOOL_ALLOWLIST", raising=False)
    monkeypatch.setenv("EWA_COMPANION_WF_DOCUMENT_EXTRACTOR_ENABLED", "0")
    allowlist = effective_session_tool_allowlist({})
    assert allowlist is not None
    assert "document_extractor" not in allowlist


def test_effective_allowlist_keeps_document_extractor_when_enabled(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("EWA_AGENTIC_TOOL_ALLOWLIST", raising=False)
    monkeypatch.setenv("EWA_COMPANION_WF_ENGINE_ENABLED", "1")
    monkeypatch.setenv("EWA_COMPANION_WF_DOCUMENT_EXTRACTOR_ENABLED", "1")
    allowlist = effective_session_tool_allowlist({})
    assert allowlist is None or "document_extractor" in allowlist
