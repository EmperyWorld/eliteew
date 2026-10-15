# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# OpenAPI guard for Desktop AI Chat JSON outs (Wave B2).
# Invariants:
# - Critical JSON endpoints must $ref named schemas (not bare additionalProperties).
# - SSE stream and 204 routes are excluded from JSON $ref checks.
# Related:
# - api/schemas/desktop_ai_chat.py
# - api/routers/desktop_ai_chat.py
# - documentation/api/BE-FE-CONTRACT-INTEGRITY-REMEDIATION.md
# ---
from __future__ import annotations

from typing import Any

from fastapi import FastAPI  # type: ignore[import-untyped]

from api.routers.desktop_ai_chat import router as desktop_ai_chat_router

PREFIX = "/api/v1/desktop/ai-chat"

JSON_CONTRACTS: list[tuple[str, str, str]] = [
    ("get", "/effective-settings", "DesktopAiEffectiveSettingsOut"),
    ("get", "/ensemble-blueprint-commands", "EnsembleBlueprintCommandsOut"),
    ("get", "/heroes", "DesktopAiHeroCatalogOut"),
    ("get", "/chats", "DesktopAiChatListOut"),
    ("post", "/chats", "DesktopAiChatOut"),
    ("get", "/chats/{chat_id}", "DesktopAiChatOut"),
    ("patch", "/chats/{chat_id}", "DesktopAiChatOut"),
    ("get", "/memory-cells", "DesktopAiMemoryCellListOut"),
    ("get", "/memory-cells/{cell_id}", "DesktopAiMemoryCellOut"),
    ("patch", "/memory-cells/{cell_id}", "DesktopAiMemoryCellOut"),
    ("post", "/chats/{chat_id}/memory-cells/extract", "DesktopAiMemoryCellOut"),
    ("get", "/me", "DesktopAiChatMeOut"),
    ("get", "/chats/{chat_id}/messages", "DesktopAiMessageListOut"),
    ("delete", "/chats/{chat_id}/messages/{message_id}", "DesktopAiMessagesDeleteOut"),
    ("get", "/chats/{chat_id}/stream-lock", "DesktopAiStreamLockPeekOut"),
    ("get", "/chats/{chat_id}/attachments", "DesktopAiAttachmentListOut"),
    ("post", "/chats/{chat_id}/attachments", "DesktopAiAttachmentUpsertOut"),
    ("post", "/chats/{chat_id}/verify-context", "DesktopAiVerifyContextOut"),
    ("get", "/solo-slot-tariffs", "DesktopAiSoloSlotTariffsOut"),
    ("post", "/chats/{chat_id}/solo-slot", "DesktopAiChatOut"),
    ("post", "/chats/{chat_id}/solo-slot/release", "DesktopAiChatOut"),
    ("get", "/invites/pending", "DesktopAiChatMemberListOut"),
    ("post", "/invites/{member_id}/accept", "DesktopAiChatMemberOut"),
    ("post", "/invites/{member_id}/decline", "DesktopAiChatMemberOut"),
    ("get", "/chats/{chat_id}/members", "DesktopAiChatMemberListOut"),
    ("post", "/chats/{chat_id}/members/invite", "DesktopAiChatMemberOut"),
    ("post", "/chats/{chat_id}/members/{target_user_id}/remove", "DesktopAiChatMemberOut"),
]

REQUIRED_COMPONENTS = [
    "DesktopAiChatOut",
    "DesktopAiChatListOut",
    "DesktopAiChatCapabilitiesOut",
    "DesktopAiMessageListOut",
    "DesktopAiMemoryCellOut",
    "DesktopAiChatMemberOut",
    "DesktopAiSoloSlotTariffsOut",
    "StreamBody",
    "ChatCreateBody",
]


def _openapi() -> dict[str, Any]:
    app = FastAPI()
    app.include_router(desktop_ai_chat_router, prefix="/api/v1")
    return app.openapi()


def _response_schema(path_item: dict[str, Any], method: str) -> dict[str, Any]:
    op = path_item[method]
    responses = op["responses"]
    for code in ("200", "201"):
        if code in responses and "content" in responses[code]:
            content = responses[code]["content"]
            if "application/json" in content:
                return content["application/json"]["schema"]
    raise AssertionError(f"no JSON 200/201 for {method}: {list(responses)}")


def _assert_ref(schema: dict[str, Any], expected_name: str) -> None:
    ref = schema.get("$ref")
    if ref == f"#/components/schemas/{expected_name}":
        return
    if schema.get("type") == "array":
        items = schema.get("items") or {}
        if items.get("$ref") == f"#/components/schemas/{expected_name}":
            return
    raise AssertionError(f"expected $ref {expected_name}, got {schema!r}")


def test_desktop_ai_chat_openapi_exports_named_components() -> None:
    schemas = _openapi()["components"]["schemas"]
    missing = [name for name in REQUIRED_COMPONENTS if name not in schemas]
    assert missing == [], f"missing OpenAPI components: {missing}"


def test_desktop_ai_chat_json_paths_use_named_response_models() -> None:
    doc = _openapi()
    paths = doc["paths"]
    for method, suffix, expected in JSON_CONTRACTS:
        full = f"{PREFIX}{suffix}"
        assert full in paths, f"missing path {full}"
        schema = _response_schema(paths[full], method)
        _assert_ref(schema, expected)


def test_desktop_ai_chat_stream_has_no_json_response_model() -> None:
    doc = _openapi()
    stream = doc["paths"][f"{PREFIX}/chats/{{chat_id}}/stream"]["post"]
    content = stream["responses"]["200"].get("content") or {}
    assert (
        "application/json" not in content or content.get("application/json", {}).get("schema", {}).get("$ref") is None
    )
