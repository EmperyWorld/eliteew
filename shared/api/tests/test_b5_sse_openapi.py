# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# OpenAPI guard: companion/MF/desktop/PW/Marketing SSE routes document named
# text/event-stream $ref (Wave B5a + B5b PW + Marketing AI/chat/AMKA).
# Invariants:
# - Opaque ``text/event-stream: {}`` is forbidden on listed B5 paths.
# Related:
# - documentation/api/BE-FE-CONTRACT-INTEGRITY-REMEDIATION.md
# - api/ewa_platform/schemas/pydantic/sse_openapi.py
# ---
from __future__ import annotations

from typing import Any

from fastapi import FastAPI  # type: ignore[import-untyped]

from api.ewa_platform.gateways.routers.companion_chat import router as companion_chat_router
from api.ewa_platform.gateways.routers.desktop import router as desktop_router
from api.routers.marketing_cabinet import ai_router, amka_router, chat_router
from api.routers.music_forge import router as music_forge_router
from api.routers.professional_worlds import router as professional_worlds_router

SSE_CONTRACTS: list[tuple[str, str, str]] = [
    # method, path, expected schema name
    ("post", "/api/v1/ewa/companion-chat/stream", "CompanionChatStreamPayloadDoc"),
    ("get", "/api/v1/ewa/companion-chat/task-events/stream", "CompanionTaskLifecycleSsePayloadDoc"),
    (
        "get",
        "/api/v1/ewa/companion-chat/task-runs/{run_id}/events",
        "CompanionTaskLifecycleSsePayloadDoc",
    ),
    (
        "get",
        "/api/v1/ewa/desktop-orchestration/sessions/{session_id}/events",
        "EwaDesktopOrchestrationSseEventOut",
    ),
    (
        "get",
        "/api/v1/music-forge/runs/{run_id}/events",
        "MusicForgeRunEventsSsePayloadDoc",
    ),
    # Wave B5b — PW realtor/coach text AI streams
    (
        "post",
        "/api/v1/professional-worlds/realtor/properties/{property_id}/generate-description/stream",
        "ProfessionalWorldsAiTextStreamSsePayloadDoc",
    ),
    (
        "post",
        "/api/v1/professional-worlds/realtor/properties/{property_id}/generate-content-pack/stream",
        "ProfessionalWorldsAiTextStreamSsePayloadDoc",
    ),
    (
        "post",
        "/api/v1/professional-worlds/coach/simulate/stream",
        "ProfessionalWorldsAiTextStreamSsePayloadDoc",
    ),
    # Wave B5b — PW intake / media / playbook streams
    (
        "post",
        "/api/v1/professional-worlds/realtor/properties/intake/parse/stream",
        "ProfessionalWorldsIntakeStreamSsePayloadDoc",
    ),
    (
        "post",
        "/api/v1/professional-worlds/realtor/properties/{property_id}/media/enhance/stream",
        "ProfessionalWorldsMediaEnhanceStreamSsePayloadDoc",
    ),
    (
        "post",
        "/api/v1/professional-worlds/realtor/properties/{property_id}/media/upload-enhance/stream",
        "ProfessionalWorldsMediaEnhanceStreamSsePayloadDoc",
    ),
    (
        "post",
        "/api/v1/professional-worlds/realtor/properties/{property_id}/media/enhance/batches/{batch_id}/run/stream",
        "ProfessionalWorldsMediaBatchStreamSsePayloadDoc",
    ),
    (
        "post",
        "/api/v1/professional-worlds/playbooks/{vertical_slug}/{playbook_key}/stream",
        "ProfessionalWorldsPlaybookStreamSsePayloadDoc",
    ),
    (
        "post",
        "/api/v1/professional-worlds/playbook-runs/{run_id}/resume/stream",
        "ProfessionalWorldsPlaybookStreamSsePayloadDoc",
    ),
    # Wave B5b residual — Marketing AI / chat / AMKA SSE
    (
        "post",
        "/api/v1/marketing-cabinet/ai/assist/stream",
        "MarketingAiAssistStreamSsePayloadDoc",
    ),
    (
        "post",
        "/api/v1/marketing-cabinet/chat/message/stream",
        "MarketingChatStreamSsePayloadDoc",
    ),
    (
        "get",
        "/api/v1/marketing-cabinet/amka/runs/{run_id}/events",
        "AmkaRunEventsStreamSsePayloadDoc",
    ),
]

REQUIRED_COMPONENTS = [
    "CompanionChatStreamDelta",
    "CompanionChatStreamFinal",
    "CompanionChatStreamActions",
    "CompanionChatStreamError",
    "CompanionChatStreamDone",
    "CompanionChatStreamPayloadDoc",
    "CompanionSurfaceBlockOut",
    "CompanionTaskLifecycleSsePayloadDoc",
    "MusicForgeRunEventsSsePayloadDoc",
    "EwaDesktopOrchestrationSseEventOut",
    "ProfessionalWorldsAiTextStreamSsePayloadDoc",
    "ProfessionalWorldsAiSseStartedOut",
    "ProfessionalWorldsAiSseResultOut",
    "ProfessionalWorldsAiSseErrorOut",
    "ProfessionalArtifactOut",
    "ProfessionalWorldsIntakeStreamSsePayloadDoc",
    "ProfessionalWorldsIntakeSseStartedOut",
    "ProfessionalWorldsIntakeSseResultOut",
    "ProfessionalWorldsMediaEnhanceStreamSsePayloadDoc",
    "ProfessionalWorldsMediaSseStartedOut",
    "ProfessionalWorldsMediaSseResultOut",
    "ProfessionalWorldsMediaSseErrorOut",
    "ProfessionalWorldsMediaBatchStreamSsePayloadDoc",
    "ProfessionalWorldsMediaBatchSseStartedOut",
    "ProfessionalWorldsMediaBatchSseFinishedOut",
    "ProfessionalWorldsPlaybookStreamSsePayloadDoc",
    "ProfessionalWorldsPlaybookSseRunStartedOut",
    "ProfessionalWorldsPlaybookSseDoneOut",
    "MarketingAiAssistStreamSsePayloadDoc",
    "MarketingAiAssistSseStartedOut",
    "MarketingAiAssistSseResultOut",
    "MarketingAiAssistSseErrorOut",
    "MarketingAiRunOut",
    "MarketingChatStreamSsePayloadDoc",
    "MarketingChatSseStartedOut",
    "MarketingChatSseProgressOut",
    "MarketingChatSseResultOut",
    "MarketingChatSseErrorOut",
    "AmkaRunEventsStreamSsePayloadDoc",
    "AmkaRunProgressSnapshotOut",
    "AmkaRunEventsSseErrorOut",
]


def _openapi() -> dict[str, Any]:
    app = FastAPI()
    app.include_router(companion_chat_router, prefix="/api/v1/ewa")
    app.include_router(desktop_router, prefix="/api/v1/ewa")
    app.include_router(music_forge_router, prefix="/api/v1")
    app.include_router(professional_worlds_router, prefix="/api/v1")
    app.include_router(ai_router, prefix="/api/v1/marketing-cabinet")
    app.include_router(chat_router, prefix="/api/v1/marketing-cabinet")
    app.include_router(amka_router, prefix="/api/v1/marketing-cabinet")
    return app.openapi()


def _event_stream_schema(path_item: dict[str, Any], method: str) -> dict[str, Any]:
    op = path_item[method]
    content = op["responses"]["200"]["content"]
    assert "text/event-stream" in content, f"missing text/event-stream: {list(content)}"
    schema = content["text/event-stream"].get("schema") or {}
    assert schema, f"opaque/empty text/event-stream schema: {content['text/event-stream']!r}"
    return schema


def test_b5_sse_openapi_exports_named_components() -> None:
    schemas = _openapi()["components"]["schemas"]
    missing = [name for name in REQUIRED_COMPONENTS if name not in schemas]
    assert missing == [], f"missing OpenAPI components: {missing}"


def test_b5_sse_paths_use_named_event_stream_refs() -> None:
    doc = _openapi()
    paths = doc["paths"]
    for method, full, expected in SSE_CONTRACTS:
        assert full in paths, f"missing path {full}"
        schema = _event_stream_schema(paths[full], method)
        ref = schema.get("$ref")
        assert ref == f"#/components/schemas/{expected}", f"{method} {full}: {schema!r}"
