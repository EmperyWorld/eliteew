# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Unit coverage for **companion-chat** ``shell_context`` normalization + prompt section budgeting (privacy trim, caps).
# Invariants:
# - Pure helpers — no network / Postgres.
# Related:
# - api/ewa_platform/companion/sidecar/shell_context.py
# - api/ewa_platform/schemas/pydantic/companion_chat.py
# ---
"""Tests: companion shell_context prompt shaping."""

from __future__ import annotations

from api.ewa_platform.companion.sidecar.shell_context import (
    MAX_SHELL_PROMPT_CHARS,
    normalize_shell_context_payload,
    shell_context_prompt_section,
)


def test_normalize_shell_context_preserves_client_surface() -> None:
    raw = {"schema_version": 1, "client_surface": "mobile", "windows": []}
    norm = normalize_shell_context_payload(raw)
    assert norm.get("client_surface") == "mobile"


def test_shell_context_is_mobile() -> None:
    from api.ewa_platform.companion.sidecar.shell_context import shell_context_is_mobile

    assert shell_context_is_mobile({"client_surface": "mobile"})
    assert shell_context_is_mobile({"client_surface": "embedded"})
    assert not shell_context_is_mobile({"client_surface": "desktop"})
    assert not shell_context_is_mobile(None)


def test_normalize_shell_context_drops_unknown_schema_version() -> None:
    raw = {"schema_version": 99, "windows": [{"window_id": "w1", "app_component": "EwaApp"}]}
    norm = normalize_shell_context_payload(raw)
    assert norm["windows"] == []


def test_normalize_shell_context_sanitizes_title_and_caps_z() -> None:
    long_title = "a" * 200
    raw = {
        "schema_version": 1,
        "active_desktop_id": "desk-1",
        "active_window_id": "win-active",
        "windows": [
            {
                "window_id": "w1",
                "app_component": "GAFChatApp",
                "title": f"meet user@evil.example.com — {long_title}",
                "z_index": 9_999_999,
                "minimized": True,
                "desktop_id": "desk-1",
            }
        ],
    }
    norm = normalize_shell_context_payload(raw)
    assert norm["active_desktop_id"] == "desk-1"
    assert norm["active_window_id"] == "win-active"
    assert len(norm["windows"]) == 1
    row = norm["windows"][0]
    assert "[redacted]" in row["title"]
    assert len(row["title"]) <= 121  # TITLE_MAX_LEN + ellipsis
    assert row["z_index"] == 2_000_000


def test_normalize_shell_context_truncates_surface_excerpt() -> None:
    huge = "α" * 5000
    norm = normalize_shell_context_payload(
        {
            "schema_version": 1,
            "windows": [
                {
                    "window_id": "w1",
                    "app_component": "DocEditor",
                    "surface_excerpt": huge,
                    "z_index": 1,
                    "minimized": False,
                }
            ],
        }
    )
    ex = norm["windows"][0]["surface_excerpt"]
    assert ex.endswith("…")
    assert len(ex) <= 4002


def test_shell_context_prompt_section_includes_excerpt_key() -> None:
    norm = normalize_shell_context_payload(
        {
            "schema_version": 1,
            "windows": [
                {
                    "window_id": "w1",
                    "app_component": "DocEditor",
                    "title": "Note",
                    "surface_excerpt": "First line of user doc",
                    "z_index": 5,
                    "minimized": False,
                    "desktop_id": "d1",
                }
            ],
        }
    )
    blob = shell_context_prompt_section(norm)
    assert '"excerpt"' in blob
    assert "First line" in blob


def test_shell_context_prompt_section_includes_web_search_context() -> None:
    blob = shell_context_prompt_section(
        {
            "schema_version": 1,
            "windows": [],
            "web_search_context": "Ozon HDMI extender 4K result",
        }
    )

    assert "Web search context for this turn" in blob
    assert "server has already performed live web search" in blob
    assert "Do not say you cannot access websites" in blob
    assert "Ozon HDMI extender 4K result" in blob


def test_shell_context_prompt_section_includes_selection_key() -> None:
    norm = normalize_shell_context_payload(
        {
            "schema_version": 1,
            "windows": [
                {
                    "window_id": "w1",
                    "app_component": "DocEditor",
                    "title": "Note",
                    "surface_selection": "User picked this\nline",
                    "z_index": 5,
                    "minimized": False,
                    "desktop_id": "d1",
                }
            ],
        }
    )
    blob = shell_context_prompt_section(norm)
    assert '"selection"' in blob
    assert "User picked" in blob


def test_normalize_shell_context_truncates_surface_listing() -> None:
    huge = ("\n".join([f"n{i}|" + "β" * 120 for i in range(120)])).strip()
    norm = normalize_shell_context_payload(
        {
            "schema_version": 1,
            "windows": [
                {
                    "window_id": "w1",
                    "app_component": "DesktopFolder",
                    "surface_listing": huge,
                    "z_index": 1,
                    "minimized": False,
                }
            ],
        }
    )
    lst = norm["windows"][0]["surface_listing"]
    assert lst.endswith("…")
    assert len(lst) <= 4002


def test_shell_context_prompt_section_includes_listing_key() -> None:
    norm = normalize_shell_context_payload(
        {
            "schema_version": 1,
            "windows": [
                {
                    "window_id": "w1",
                    "app_component": "DesktopFolder",
                    "title": "Stuff",
                    "surface_listing": "readme.txt\nnotes.md",
                    "z_index": 5,
                    "minimized": False,
                    "desktop_id": "d1",
                }
            ],
        }
    )
    blob = shell_context_prompt_section(norm)
    assert '"listing"' in blob
    assert "readme.txt" in blob


def test_shell_context_prompt_section_respects_budget() -> None:
    wins = []
    for i in range(40):
        wins.append(
            {
                "window_id": f"w{i}",
                "app_component": "NotificationsApp",
                "title": f"t{i}",
                "z_index": i,
                "minimized": False,
            }
        )
    norm = normalize_shell_context_payload({"schema_version": 1, "windows": wins})
    blob = shell_context_prompt_section(norm)
    assert blob
    assert len(blob) <= MAX_SHELL_PROMPT_CHARS
