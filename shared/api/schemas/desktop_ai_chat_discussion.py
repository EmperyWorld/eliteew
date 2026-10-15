# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Pydantic request/response contracts for Desktop AI Chat Discussion mode.
# Invariants:
# - Discussion never shares StreamBody.
# - Manual document remains POST generate-document; interview handoff may auto-document on finish.
# Related:
# - api/routers/desktop_ai_chat_discussion_routes.py
# - documentation/product/desktop/DESKTOP-AI-CHAT-DISCUSSION-MODE.md
# ---
from __future__ import annotations

from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, RootModel  # type: ignore[import-untyped]


class DiscussionStartBody(BaseModel):
    preset_id: str = Field(min_length=1, max_length=64)
    topic: str = Field(default="", max_length=4000)
    goal: str = Field(default="", max_length=4000)
    roster: list[str] = Field(default_factory=list, max_length=8)
    intensity: Literal["calm", "professional_confrontational", "sharp"] | None = None
    role_title: str | None = Field(default=None, max_length=120)
    client_request_id: UUID | None = None
    source_message_id: UUID | None = None


class DiscussionParticipantProfileOut(BaseModel):
    model_config = ConfigDict(extra="ignore")

    display_name: str
    role_title: str
    default_role_title: str


class DiscussionVersionedBody(BaseModel):
    expected_version: int | None = Field(default=None, ge=1)
    client_request_id: UUID | None = None


class DiscussionInterjectionBody(BaseModel):
    content: str = Field(min_length=1, max_length=20_000)
    expected_version: int | None = Field(default=None, ge=1)
    client_request_id: UUID | None = None


class DiscussionDocumentBody(BaseModel):
    expected_version: int | None = Field(default=None, ge=1)
    force: bool = False


class DiscussionTurnOut(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    session_id: str
    ordinal: int
    actor_type: str
    hero_id: str | None = None
    author_user_id: str | None = None
    relation: str
    reply_to_turn_id: str | None = None
    tone: str | None = None
    content: str = ""
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: str | None = None


class DiscussionSessionOut(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    chat_id: str
    owner_user_id: str
    anchor_message_id: str | None = None
    preset_id: str
    topic: str = ""
    goal: str = ""
    roster: list[str] = Field(default_factory=list)
    intensity: str
    status: str
    pause_reason: str | None = None
    pause_requested: bool = False
    total_ai_turns: int = 0
    checkpoint_ai_turns: int = 0
    segment_index: int = 0
    version: int = 1
    last_actor_hero_id: str | None = None
    document_markdown: str | None = None
    document_transcript_version: int | None = None
    document_stale: bool = False
    participant_display_name: str = ""
    participant_role_title: str = "инкогнито"
    created_at: str | None = None
    updated_at: str | None = None
    turns: list[DiscussionTurnOut] | None = None


class DiscussionInterjectionOut(BaseModel):
    session: DiscussionSessionOut
    turn: DiscussionTurnOut


class DiscussionPresetOut(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    title_ru: str
    title_en: str
    description_ru: str
    description_en: str
    default_intensity: str
    checkpoint_interval: int
    min_roster: int
    max_roster: int


class DiscussionPresetListOut(BaseModel):
    items: list[DiscussionPresetOut]


class DiscussionEventsSseErrorOut(BaseModel):
    """SSE ``data:`` for ``event: error`` on Discussion live stream."""

    model_config = ConfigDict(extra="ignore")

    message: str | None = None
    detail: Any = None


class DiscussionEventsStreamSsePayloadDoc(
    RootModel[DiscussionSessionOut | DiscussionTurnOut | DiscussionEventsSseErrorOut]
):
    """OpenAPI doc for Discussion ``GET …/events`` ``text/event-stream`` ``data:`` JSON.

    Named SSE ``event:`` values include ``discussion_session``, ``discussion_turn_plan``,
    ``council_turn``, ``discussion_pause``, ``discussion_segment_done``,
    ``discussion_document_ready``, and ``error``. Keep-alive comments are outside this union.
    FE refreshes PG SoT by event name; payload shapes may carry session and/or turn fields.
    """
