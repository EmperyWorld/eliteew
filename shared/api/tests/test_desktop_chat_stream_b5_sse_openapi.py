# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Wave B5 lock for Desktop AI Chat POST …/stream SSE (narrow import surface).
# Invariants:
# - POST …/chats/{id}/stream documents text/event-stream + named $ref.
# - Does not import music_forge / unified_content (KNOWN_DESKTOP_APP_COMPONENTS).
# Related:
# - api/routers/desktop_ai_chat_stream_routes.py
# - api/schemas/desktop_ai_chat.py
# - documentation/api/BE-FE-CONTRACT-INTEGRITY-REMEDIATION.md
# ---
from __future__ import annotations

from typing import Any

from fastapi import FastAPI  # type: ignore[import-untyped]

from api.routers.desktop_ai_chat_stream_routes import router as stream_router

PATH = "/api/v1/desktop/ai-chat/chats/{chat_id}/stream"
EXPECTED = "DesktopAiChatStreamSsePayloadDoc"


def _openapi() -> dict[str, Any]:
    app = FastAPI()
    app.include_router(stream_router, prefix="/api/v1/desktop/ai-chat")
    return app.openapi()


def test_desktop_chat_stream_sse_openapi_named_event_stream_ref() -> None:
    doc = _openapi()
    assert PATH in doc["paths"]
    content = doc["paths"][PATH]["post"]["responses"]["200"]["content"]
    assert "text/event-stream" in content
    schema = content["text/event-stream"].get("schema") or {}
    assert schema.get("$ref") == f"#/components/schemas/{EXPECTED}"
    assert EXPECTED in doc["components"]["schemas"]
    assert "DesktopAiChatStreamSseTokenOut" in doc["components"]["schemas"]
    assert "DesktopAiChatStreamSseErrorOut" in doc["components"]["schemas"]
    assert "DesktopAiChatStreamSseDoneOut" in doc["components"]["schemas"]
