# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Unit tests for companion **DocEditor body edit** heuristics и allow-list HTML sanitizer (**без** живого LLM/storage).
# Invariants:
# - Без сети; без async fixtures.
# Related:
# - api/ewa_platform/companion/storage/doceditor_edit_body.py
# - api/ewa_platform/companion/storage/doceditor_translate_body.py
# ---
from __future__ import annotations

from api.ewa_platform.companion.storage.doceditor_edit_body import (
    companion_user_intent_edit_replace_editor,
    doc_editor_surface_selection_from_shell,
    sanitize_companion_doc_body_html,
)
from api.ewa_platform.companion.storage.doceditor_translate_body import (
    resolve_doc_editor_unified_id_for_shell,
)


def test_edit_intent_positive_ru() -> None:
    assert companion_user_intent_edit_replace_editor("Сократи текст в документе, оставь главное")


def test_edit_intent_negative_translate_wins() -> None:
    assert not companion_user_intent_edit_replace_editor("Переведи весь документ на английский и замени в редакторе")


def test_surface_selection_from_shell_doceditor_z_order() -> None:
    sel = doc_editor_surface_selection_from_shell(
        {
            "schema_version": 1,
            "windows": [
                {"window_id": "b", "app_component": "DocEditor", "z_index": 3, "surface_selection": "alpha"},
                {"window_id": "a", "app_component": "DocEditor", "z_index": 10, "surface_selection": "beta"},
            ],
        }
    )
    assert sel == "beta"


def test_resolve_doc_editor_uc_prefers_active_window_over_z_order() -> None:
    high = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
    low = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
    shell = {
        "schema_version": 1,
        "active_window_id": "w-low",
        "windows": [
            {
                "window_id": "w-high",
                "app_component": "DocEditor",
                "z_index": 100,
                "surface_listing": f"- top.md [document] uc={high}",
            },
            {
                "window_id": "w-low",
                "app_component": "DocEditor",
                "z_index": 10,
                "surface_listing": f"- smoke.md [document] uc={low}",
            },
        ],
    }
    assert resolve_doc_editor_unified_id_for_shell(shell) == low


def test_resolve_doc_editor_uc_z_order_when_no_active_match() -> None:
    high = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
    low = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
    shell = {
        "schema_version": 1,
        "windows": [
            {
                "window_id": "w-high",
                "app_component": "DocEditor",
                "z_index": 100,
                "surface_listing": f"- top.md [document] uc={high}",
            },
            {
                "window_id": "w-low",
                "app_component": "DocEditor",
                "z_index": 10,
                "surface_listing": f"- smoke.md [document] uc={low}",
            },
        ],
    }
    assert resolve_doc_editor_unified_id_for_shell(shell) == high


def test_resolve_doc_editor_uc_fallback_when_active_is_not_doc_editor() -> None:
    high = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
    low = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
    shell = {
        "schema_version": 1,
        "active_window_id": "ewa-chat",
        "windows": [
            {"window_id": "ewa-chat", "app_component": "EwaApp", "z_index": 200},
            {
                "window_id": "w-high",
                "app_component": "DocEditor",
                "z_index": 100,
                "surface_listing": f"- top.md [document] uc={high}",
            },
            {
                "window_id": "w-low",
                "app_component": "DocEditor",
                "z_index": 10,
                "surface_listing": f"- smoke.md [document] uc={low}",
            },
        ],
    }
    assert resolve_doc_editor_unified_id_for_shell(shell) == high


def test_resolve_doc_editor_uc_prefers_excerpt_when_chat_window_active() -> None:
    high = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
    low = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
    shell = {
        "schema_version": 1,
        "active_window_id": "ewa-chat",
        "windows": [
            {"window_id": "ewa-chat", "app_component": "EwaApp", "z_index": 200},
            {
                "window_id": "w-high",
                "app_component": "DocEditor",
                "z_index": 100,
                "surface_excerpt": "",
                "surface_listing": f"- top.md [document] uc={high}",
            },
            {
                "window_id": "w-low",
                "app_component": "DocEditor",
                "z_index": 10,
                "surface_excerpt": "manual-smoke-line-one and more text in the excerpt",
                "surface_listing": f"- smoke.md [document] uc={low}",
            },
        ],
    }
    assert resolve_doc_editor_unified_id_for_shell(shell) == low


def test_sanitize_strips_script_keeps_structure() -> None:
    raw = "<p>Hi</p><script>alert(1)</script><ul><li>One</li></ul>"
    got = sanitize_companion_doc_body_html(raw)
    assert got is not None
    assert "<script" not in got
    assert "<ul>" in got and "<li>" in got


def test_sanitize_rejects_bad_href_keep_text() -> None:
    raw = '<p><a href="javascript:alert(1)">evil</a>x</p>'
    got = sanitize_companion_doc_body_html(raw)
    assert got is not None
    assert "javascript" not in got
    assert "evil" in got
