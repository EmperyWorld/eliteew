# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Regression tests for the pre-LLM deterministic EWA companion router.
# Invariants:
# - Exact deterministic commands must not call the main chat LLM.
# - Ambiguous/free-chat turns still fall through to the normal chat path.
# Related:
# - api/ewa_platform/companion/orchestration/deterministic_router.py
# - api/ewa_platform/companion/turn/chat_turn.py
# ---

from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock


def test_catalog_list_gate_matches_plain_ru_list_request() -> None:
    from api.ewa_platform.companion.orchestration.branch_line_gates import early_tool_branch_may_probe

    assert early_tool_branch_may_probe(
        "catalog_list",
        "покажи список файлов",
        {},
        principal_id="principal",
    )
    assert early_tool_branch_may_probe(
        "catalog_list",
        "посмотри список всех моих документов",
        {},
        principal_id="principal",
    )


def test_classify_document_tool_routes_are_typed() -> None:
    from api.ewa_platform.companion.orchestration.deterministic_router import classify_deterministic_tool_route

    file_list = classify_deterministic_tool_route(
        "catalog_list",
        {"output_surface": {"mode": "file_list"}},
    )
    assert file_list.intent == "file_list"
    assert file_list.tool == "catalog_list"
    assert file_list.surface == "file_list"

    editor = classify_deterministic_tool_route(
        "file_open",
        {"output_surface": {"mode": "document_editor"}},
    )
    assert editor.intent == "document_edit_surface"
    assert editor.tool == "file_open"
    assert editor.surface == "document_editor"


def test_deterministic_final_payload_keeps_catalog_markdown_out_of_chat() -> None:
    from api.ewa_platform.companion.turn.chat_turn import _deterministic_final_payload

    payload = _deterministic_final_payload(
        {
            "reply": "В каталоге EwaFile 1 подходящий файл.",
            "actions": [],
            "task_run": None,
            "output_surface": {
                "mode": "file_list",
                "payload": {
                    "items": [
                        {
                            "unifiedContentId": "11111111-1111-1111-1111-111111111111",
                            "title": "alpha.md",
                        }
                    ],
                },
            },
            "data": {
                "catalog_appendix": "- alpha.md [document] uc=11111111-1111-1111-1111-111111111111",
            },
        },
        companion_revision=3,
    )

    assert payload["reply"] == "В каталоге EwaFile 1 подходящий файл."
    assert "data" not in payload
    assert "alpha.md [document]" not in payload["reply"]
    assert payload["output_surface"]["mode"] == "file_list"


def test_execute_chat_message_uses_deterministic_response_before_llm(monkeypatch) -> None:
    from api.ewa_platform.companion.turn import chat_turn

    profile = {
        "principal_id": "principal",
        "companion_revision": 7,
        "learned_preferences": {},
        "seed_persona_id": "parent",
        "baseline": {},
    }

    monkeypatch.setattr(
        chat_turn.companion_pg,
        "companion_profile_fetch",
        AsyncMock(return_value=profile),
    )
    monkeypatch.setattr(
        "api.ewa_platform.companion.turn.phases.turn_entry.companion_turn_dedup_try_fetch_response",
        AsyncMock(return_value=None),
    )
    store_mock = AsyncMock()
    monkeypatch.setattr(
        "api.ewa_platform.companion.turn.phases.turn_entry.companion_turn_dedup_store_response",
        store_mock,
    )
    monkeypatch.setattr(
        "api.ewa_platform.companion.turn.phases.turn_entry.maybe_route_deterministic_turn",
        AsyncMock(
            return_value={
                "reply": "В каталоге EwaFile 1 файл.",
                "actions": [],
                "task_run": None,
                "output_surface": {
                    "mode": "file_list",
                    "payload": {
                        "items": [
                            {
                                "unifiedContentId": "11111111-1111-1111-1111-111111111111",
                                "title": "alpha.md",
                            }
                        ],
                    },
                },
                "routing_debug": {
                    "route": "deterministic",
                    "intent": "file_list",
                    "llm_called": False,
                    "surface": "file_list",
                },
                "deterministic_route": {
                    "route": "deterministic",
                    "intent": "file_list",
                    "tool": "catalog_list",
                    "surface": "file_list",
                },
            }
        ),
    )

    async def _fail_llm(*_args, **_kwargs):
        raise AssertionError("main chat LLM must not be called for deterministic turns")

    monkeypatch.setattr(
        "api.ewa_platform.companion.turn.phases.sync_main_llm_turn.fetch_main_llm_completion_text",
        _fail_llm,
    )

    out = asyncio.run(
        chat_turn.execute_companion_chat_message(
            object(),  # type: ignore[arg-type]
            principal_id="principal",
            auth_user=None,  # type: ignore[arg-type]
            bearer_token=None,
            message="покажи список файлов",
            content_catalog_user_id="content-user",
        )
    )

    assert out["companion_revision"] == 7
    assert out["output_surface"]["mode"] == "file_list"
    assert out["deterministic_route"]["intent"] == "file_list"
    store_mock.assert_awaited_once()
