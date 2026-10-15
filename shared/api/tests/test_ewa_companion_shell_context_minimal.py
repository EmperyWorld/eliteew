# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Behavioural tests for the **minimal** shell-context renderer
# (``api.ewa_platform.companion.sidecar.shell_context.shell_context_prompt_section``) introduced as Phase A of the
# server-only migration (see ``documentation/platform/EWA-COMPANION-SERVER-ONLY-MIGRATION.md``). The minimal mode
# keeps the LLM aware of (focused window + DocEditor body + open-apps roster) without rendering all 10–40 windows
# verbatim, which used to consume 5–14 KB of the system prompt budget per turn.
# Invariants:
# - ``EWA_COMPANION_SHELL_CONTEXT_MODE`` unset → minimal mode.
# - Minimal output capped at ``_MAX_SHELL_PROMPT_CHARS_MINIMAL=4000``.
# - Focused window is rendered with full payload; DocEditor window if any (and different from focus) also full.
# - Other windows surface only as their ``app_component`` names in ``other_open_apps``.
# - Full mode (``EWA_COMPANION_SHELL_CONTEXT_MODE=full``) preserves the legacy renderer (sanity test).
# Related:
# - api/ewa_platform/companion/sidecar/shell_context.py
# - documentation/platform/EWA-COMPANION-SERVER-ONLY-MIGRATION.md
# ---
"""Tests for minimal/legacy shell-context prompt rendering used by the EWA companion turn."""

from __future__ import annotations

import pytest

from api.ewa_platform.companion.sidecar.shell_context import shell_context_prompt_section


def _win(
    *,
    wid: str,
    app: str,
    title: str = "",
    z: int = 0,
    excerpt: str = "",
    listing: str = "",
    selection: str = "",
    minimized: bool = False,
    desktop_id: str = "",
) -> dict[str, object]:
    return {
        "window_id": wid,
        "app_component": app,
        "title": title,
        "z_index": z,
        "minimized": minimized,
        "desktop_id": desktop_id,
        "surface_excerpt": excerpt,
        "surface_listing": listing,
        "surface_selection": selection,
    }


@pytest.mark.unit
def test_minimal_mode_renders_focused_doc_editor_and_app_roster(monkeypatch: pytest.MonkeyPatch) -> None:
    """With 10 windows open we expect: focused window + DocEditor + a compact roster of other app names."""

    monkeypatch.delenv("EWA_COMPANION_SHELL_CONTEXT_MODE", raising=False)
    norm = {
        "schema_version": 1,
        "active_desktop_id": "d-main",
        "active_window_id": "w-focus",
        "windows": [
            _win(wid="w-focus", app="EwaApp", title="EWA", z=10),
            _win(
                wid="w-editor",
                app="DocEditor",
                title="diary.md",
                z=9,
                excerpt="My diary text",
                listing="- diary.md [document] uc=11111111-1111-1111-1111-111111111111",
            ),
            _win(wid="w-music", app="Music", title="Lo-fi", z=8),
            _win(wid="w-mail", app="Mail", title="Inbox (12)", z=7),
            _win(wid="w-browser", app="Browser", title="eliteew.ru", z=6),
            _win(wid="w-files", app="ContentManager", title="Files", z=5),
            _win(wid="w-settings", app="DesktopShellSettings", title="Settings", z=4),
            _win(wid="w-photos", app="Photos", title="Album", z=3),
            _win(wid="w-comfy", app="ComfyUI", title="comfy", z=2),
            _win(wid="w-chat", app="Chat", title="Convo", z=1),
        ],
    }
    out = shell_context_prompt_section(norm)
    assert out, "Minimal mode must render a non-empty section"
    assert "active_desktop_id: d-main" in out
    assert "focused_window_id: w-focus" in out
    assert "focused_window:" in out
    assert "doc_editor_window:" in out
    assert "other_open_apps:" in out
    assert "Music" in out and "ContentManager" in out and "Mail" in out, "App roster must list other components"
    # The minimal cap is 4000 chars (vs 14000 in legacy). Even with 10 windows we stay within.
    assert len(out) <= 4000


@pytest.mark.unit
def test_minimal_mode_drops_non_focused_window_excerpts(monkeypatch: pytest.MonkeyPatch) -> None:
    """Long surface_excerpts in non-focused / non-DocEditor windows must NOT enter the prompt."""

    monkeypatch.delenv("EWA_COMPANION_SHELL_CONTEXT_MODE", raising=False)
    big = "Q" * 3000
    norm = {
        "schema_version": 1,
        "active_window_id": "w-focus",
        "windows": [
            _win(wid="w-focus", app="EwaApp", title="EWA", z=10),
            _win(wid="w-mail", app="Mail", title="Inbox", z=9, excerpt=big, listing=big),
        ],
    }
    out = shell_context_prompt_section(norm)
    assert big not in out, "Other-windows' surface_excerpt must not leak verbatim"
    assert "Mail" in out, "Mail must still appear in the roster"


@pytest.mark.unit
def test_full_mode_preserves_legacy_renderer(monkeypatch: pytest.MonkeyPatch) -> None:
    """``EWA_COMPANION_SHELL_CONTEXT_MODE=full`` restores the legacy ``windows:`` enumeration."""

    monkeypatch.setenv("EWA_COMPANION_SHELL_CONTEXT_MODE", "full")
    norm = {
        "schema_version": 1,
        "active_window_id": "w-focus",
        "windows": [
            _win(wid="w-focus", app="EwaApp", title="EWA", z=10),
            _win(wid="w-mail", app="Mail", title="Inbox", z=9),
        ],
    }
    out = shell_context_prompt_section(norm)
    assert "- windows:" in out, "Legacy mode renders the windows: list"


@pytest.mark.unit
def test_empty_windows_returns_empty_string(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("EWA_COMPANION_SHELL_CONTEXT_MODE", raising=False)
    assert shell_context_prompt_section({"windows": []}) == ""
    assert shell_context_prompt_section(None) == ""


@pytest.mark.unit
def test_minimal_focused_window_falls_back_to_top_z_when_no_active_id(monkeypatch: pytest.MonkeyPatch) -> None:
    """Without ``active_window_id`` the focused row defaults to the highest z."""

    monkeypatch.delenv("EWA_COMPANION_SHELL_CONTEXT_MODE", raising=False)
    norm = {
        "schema_version": 1,
        "windows": [
            _win(wid="w-low", app="Low", z=1),
            _win(wid="w-top", app="Top", z=99),
        ],
    }
    out = shell_context_prompt_section(norm)
    assert "focused_window:" in out
    assert '"id": "w-top"' in out, "Top z-index wins when there is no active_window_id"
