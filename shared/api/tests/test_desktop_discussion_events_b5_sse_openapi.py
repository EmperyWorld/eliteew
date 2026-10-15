# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Wave B5 lock for Desktop AI Chat Discussion live SSE only (narrow import surface).
# Invariants:
# - GET …/discussion/{id}/events documents text/event-stream + named $ref.
# - Does not import music_forge / unified_content (KNOWN_DESKTOP_APP_COMPONENTS).
# Related:
# - api/routers/desktop_ai_chat_discussion_routes.py
# - api/schemas/desktop_ai_chat_discussion.py
# - documentation/api/BE-FE-CONTRACT-INTEGRITY-REMEDIATION.md
# ---
from __future__ import annotations

from typing import Any

from fastapi import FastAPI  # type: ignore[import-untyped]

from api.routers.desktop_ai_chat_discussion_routes import router as discussion_router

PATH = "/api/v1/desktop/ai-chat/chats/{chat_id}/discussion/{session_id}/events"
EXPECTED = "DiscussionEventsStreamSsePayloadDoc"


def _openapi() -> dict[str, Any]:
    app = FastAPI()
    app.include_router(discussion_router, prefix="/api/v1/desktop/ai-chat")
    return app.openapi()


def test_discussion_events_sse_openapi_named_event_stream_ref() -> None:
    doc = _openapi()
    assert PATH in doc["paths"]
    content = doc["paths"][PATH]["get"]["responses"]["200"]["content"]
    assert "text/event-stream" in content
    schema = content["text/event-stream"].get("schema") or {}
    assert schema.get("$ref") == f"#/components/schemas/{EXPECTED}"
    assert EXPECTED in doc["components"]["schemas"]
    assert "DiscussionEventsSseErrorOut" in doc["components"]["schemas"]
