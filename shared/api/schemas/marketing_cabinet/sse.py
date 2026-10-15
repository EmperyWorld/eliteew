# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Named OpenAPI docs for Marketing Cabinet AI assist and context-chat
# ``text/event-stream`` ``data:`` JSON (Wave B5b residual).
# Invariants:
# - Documents wire envelopes only; does not change SSE framing or keep-alive comments.
# - AI ``result.run`` / chat ``result.run`` reuse ``MarketingAiRunOut``.
# Related:
# - api/ewa_platform/schemas/pydantic/sse_openapi.py
# - documentation/api/BE-FE-CONTRACT-INTEGRITY-REMEDIATION.md (B5b)
# ---
from __future__ import annotations

from typing import Any

from api.schemas.marketing_cabinet import MarketingAiRunOut
from pydantic import BaseModel, ConfigDict, RootModel  # type: ignore[import-untyped]


class MarketingAiAssistSseStartedOut(BaseModel):
    """SSE ``event: started`` after UGS accepts a marketing AI assist stream."""

    request_id: str
    status: Any = None


class MarketingAiAssistSseResultOut(BaseModel):
    """SSE ``event: result`` with generated text and recorded AI run."""

    text: str
    run: MarketingAiRunOut


class MarketingAiAssistSseErrorOut(BaseModel):
    """SSE ``event: error`` envelope for marketing AI assist streams."""

    error: Any


class MarketingAiAssistStreamSsePayloadDoc(
    RootModel[MarketingAiAssistSseStartedOut | MarketingAiAssistSseResultOut | MarketingAiAssistSseErrorOut]
):
    """OpenAPI doc for ``POST …/ai/assist/stream`` ``data:`` JSON.

    Wire may also forward other UGS event types as opaque bags; keep-alive comments
    remain outside this named union.
    """


class MarketingChatSseMessageOut(BaseModel):
    """Assistant message persisted at chat stream ``result``."""

    id: str
    role: str
    content: str


class MarketingChatSseStartedOut(BaseModel):
    """SSE ``event: started`` for context-chat stream."""

    conversation_id: str
    request_id: str
    status: str = "processing"


class MarketingChatSseProgressOut(BaseModel):
    """SSE ``event: progress`` while UGS is processing the chat turn."""

    conversation_id: str
    status: str = "processing"
    progress: Any = None


class MarketingChatSseResultOut(BaseModel):
    """SSE ``event: result`` with assistant message and AI run row."""

    conversation_id: str
    message: MarketingChatSseMessageOut
    run: MarketingAiRunOut


class MarketingChatSseErrorOut(BaseModel):
    """SSE ``event: error`` for context-chat stream."""

    conversation_id: str
    error: Any


class MarketingChatStreamSsePayloadDoc(
    RootModel[
        MarketingChatSseStartedOut | MarketingChatSseProgressOut | MarketingChatSseResultOut | MarketingChatSseErrorOut
    ]
):
    """OpenAPI doc for ``POST …/chat/message/stream`` ``data:`` JSON.

    Keep-alive comments are outside this named union.
    """


class AmkaRunProgressSnapshotOut(BaseModel):
    """Light AMKA run progress snapshot pushed on ``GET …/amka/runs/{id}/events``."""

    model_config = ConfigDict(extra="ignore")

    run_id: str
    status: str | None = None
    current_stage: str | None = None
    progress: int | None = None
    progress_message: str | None = None
    active_step_id: str | None = None
    active_step_ordinal: Any = None
    next_pending_step_id: str | None = None
    next_pending_step_ordinal: Any = None


class AmkaRunEventsSseErrorOut(BaseModel):
    """SSE ``data:`` when progress snapshot fetch fails mid-stream."""

    error: Any


class AmkaRunEventsStreamSsePayloadDoc(RootModel[AmkaRunProgressSnapshotOut | AmkaRunEventsSseErrorOut]):
    """OpenAPI doc for AMKA run progress ``text/event-stream`` ``data:`` JSON.

    Comment lines (``: ping``) keep proxies alive and are outside this union.
    """
