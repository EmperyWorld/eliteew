# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Pydantic request/response contracts for Desktop AI Chat user API
# (/api/v1/desktop/ai-chat). Named Outs for OpenAPI / FE SSOT (Wave B2 + B5 stream).
# Invariants:
# - Chat settings are typed DesktopAiChatSettings (B9b); message metadata may stay bags.
# - POST …/stream documents ``DesktopAiChatStreamSsePayloadDoc`` (Wave B5); StreamBody typed.
# - 204 routes have no JSON Out.
# Related:
# - api/routers/desktop_ai_chat.py
# - api/routers/desktop_ai_chat_stream_routes.py
# - api/services/desktop_chat_ensemble/settings.py (sanitize keys)
# - documentation/api/BE-FE-CONTRACT-INTEGRITY-REMEDIATION.md
# - documentation/product/DESKTOP-LLAMA-CHAT.md
# ---
from __future__ import annotations

from typing import Any, Literal
from uuid import UUID

from api.services.desktop_chat.kbsew_search_settings import KbsewSearchSettings
from pydantic import BaseModel, ConfigDict, Field, RootModel  # type: ignore[import-untyped]

# --- Request bodies ---


class DesktopAiChatSettings(BaseModel):
    """Per-chat settings JSONB — product keys from sanitize_desktop_chat_settings_payload."""

    model_config = ConfigDict(extra="ignore")

    desktop_hero_id: str | None = Field(default=None, max_length=64)
    desktop_hero_prompt_version: int | None = None
    desktop_chat_mode: Literal["solo", "ensemble"] | None = None
    desktop_ensemble_all: bool | None = None
    desktop_ensemble_ids: list[str] | None = None
    desktop_ensemble_engine: Literal["blueprint", "legacy_freeform"] | None = None
    desktop_ensemble_routing_mode: Literal["auto", "semi", "chat_only", "blueprint_only"] | None = None
    kbsew_search_settings: KbsewSearchSettings | None = None
    amka_ephemeral: bool | None = None
    amka_run_id: str | None = Field(default=None, max_length=128)
    amka_step_id: str | None = Field(default=None, max_length=128)
    amka_forced_blueprint_template_id: str | None = Field(default=None, max_length=128)
    amka_suppress_research_plan_heuristic: bool | None = None


class ChatCreateBody(BaseModel):
    title: str | None = Field(default=None, max_length=500)
    company_id: UUID | None = None
    project_id: UUID | None = None
    llama_model: str | None = Field(default=None, max_length=255)
    system_prompt_override: str | None = None
    use_project_rag: bool = False
    memory_cell_id: UUID | None = None
    settings: DesktopAiChatSettings | None = None


class ChatPatchBody(BaseModel):
    title: str | None = Field(default=None, max_length=500)
    company_id: UUID | None = None
    project_id: UUID | None = None
    llama_model: str | None = Field(default=None, max_length=255)
    system_prompt_override: str | None = None
    use_project_rag: bool | None = None
    memory_cell_id: UUID | None = None
    clear_memory_cell: bool = False
    settings: DesktopAiChatSettings | None = None


class MemoryCellExtractBody(BaseModel):
    mode: Literal["create", "update"]
    title: str | None = Field(default=None, max_length=200)


class MemoryCellPatchBody(BaseModel):
    title: str | None = Field(default=None, max_length=200)
    description: str | None = Field(default=None, max_length=4000)


class StreamBody(BaseModel):
    content: str = Field(default="", max_length=120_000)
    use_tools: bool = False
    use_web_search: bool = False
    regenerate: bool = False
    ensemble_document_confirm: Literal["accept", "decline"] | None = None
    ref_user_message_id: UUID | None = None
    client_request_id: UUID | None = None


class AttachBody(BaseModel):
    content_id: UUID
    source_label: str | None = Field(default=None, max_length=500)


class SoloSlotPurchaseBody(BaseModel):
    duration_hours: Literal[1, 2, 12]
    hero_id: str | None = Field(default=None, max_length=64)


class InviteFriendBody(BaseModel):
    friend_user_id: UUID


# --- Catalog / settings ---


class DesktopAiEffectiveSettingsOut(BaseModel):
    model_config = ConfigDict(extra="ignore")

    defaults: dict[str, Any]


class EnsembleBlueprintCommandItemOut(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    title: str
    description: str = ""
    artifact_type: str = "general"
    required_context: list[str] = Field(default_factory=list)
    example_command: str = ""


class EnsembleBlueprintCommandsOut(BaseModel):
    items: list[EnsembleBlueprintCommandItemOut]


class DesktopAiHeroCatalogEntryOut(BaseModel):
    """Hero catalog row (camelCase keys as emitted by list_hero_catalog_entries)."""

    model_config = ConfigDict(extra="ignore")

    id: str
    promptVersion: int | str
    shortLabel: str
    label: str
    description: str
    avatarPublicPath: str
    defaultChatTitle: str
    sileroVoice: str
    dossierTools: str
    dossierTraits: list[str] = Field(default_factory=list)
    #: UI picker section: assistants (default) | it_dept
    cohort: str | None = None


class DesktopAiHeroCatalogOut(BaseModel):
    items: list[DesktopAiHeroCatalogEntryOut]


# --- Chat / collaboration ---


class DesktopAiChatCapabilitiesOut(BaseModel):
    model_config = ConfigDict(extra="ignore")

    can_stream: bool
    can_attach: bool
    can_regenerate: bool
    can_delete_messages: bool
    can_manage_project: bool
    can_patch_settings: bool
    can_invite: bool
    can_manage_members: bool
    can_leave: bool
    can_delete_chat: bool
    can_solo_slot: bool
    can_export: bool


class DesktopAiChatParticipantOut(BaseModel):
    model_config = ConfigDict(extra="ignore")

    user_id: str
    display_name: str
    avatar_url: str | None = None
    is_owner: bool


class DesktopAiChatOut(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    user_id: str
    company_id: str | None = None
    project_id: str | None = None
    title: str
    llama_model: str | None = None
    system_prompt_override: str | None = None
    use_project_rag: bool = False
    vault_rag_eligible: bool = False
    memory_cell_id: str | None = None
    settings: DesktopAiChatSettings = Field(default_factory=DesktopAiChatSettings)
    created_at: str | None = None
    updated_at: str | None = None
    solo_slot_ends_at: str | None = None
    solo_slot_started_at: str | None = None
    solo_slot_duration_hours: int | None = None
    solo_slot_active: bool | None = None
    viewer_role: Literal["owner", "guest"] | str | None = None
    is_shared: bool | None = None
    accepted_member_count: int | None = None
    capabilities: DesktopAiChatCapabilitiesOut | None = None
    owner_user_id: str | None = None
    participants: list[DesktopAiChatParticipantOut] | None = None


class DesktopAiChatListOut(BaseModel):
    items: list[DesktopAiChatOut]


class DesktopAiChatMeOut(BaseModel):
    user_id: str


class DesktopAiChatMemberOut(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    chat_id: str
    user_id: str
    role: str
    status: str
    invited_by: str | None = None
    created_at: str | None = None
    responded_at: str | None = None


class DesktopAiChatMemberListOut(BaseModel):
    items: list[DesktopAiChatMemberOut]


# --- Memory / messages / attachments ---


class DesktopAiMemoryCellOut(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    owner_user_id: str
    title: str
    description: str | None = None
    status: str
    source_chat_id: str | None = None
    message_count_indexed: int = 0
    chunk_count: int = 0
    char_count: int = 0
    last_built_at: str | None = None
    created_at: str | None = None
    updated_at: str | None = None


class DesktopAiMemoryCellListOut(BaseModel):
    items: list[DesktopAiMemoryCellOut]


class DesktopAiMessageOut(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    role: str
    content: str
    tool_calls: list[Any] | dict[str, Any] | None = None
    metadata: dict[str, Any] | None = None
    author_user_id: str | None = None
    created_at: str | None


class DesktopAiMessageListOut(BaseModel):
    items: list[DesktopAiMessageOut]
    total: int
    truncated: bool | None = None


class DesktopAiMessagesDeleteOut(BaseModel):
    deleted_count: int


class DesktopAiAttachmentOut(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    content_id: str | None = None
    source_label: str | None = None
    uploaded_by: str | None = None
    rag_indexed_at: str | None = None
    created_at: str | None = None


class DesktopAiAttachmentListOut(BaseModel):
    items: list[DesktopAiAttachmentOut]


class DesktopAiAttachmentUpsertOut(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    content_id: str | None = None
    source_label: str | None = None
    rag_indexed_at: str | None = None
    rag_index_ok: bool = False


class DesktopAiStreamLockPeekOut(BaseModel):
    locked: bool
    holder_user_id: str | None = None
    ttl_sec: int | None = None


class DesktopAiVerifyContextOut(BaseModel):
    model_config = ConfigDict(extra="ignore")

    ok: bool
    detail: Any | None = None


class DesktopAiSoloSlotTariffsOut(BaseModel):
    model_config = ConfigDict(extra="ignore")

    min_energy_per_hour: int
    discount_12h_percent: int
    hero_competence_multiplier: dict[str, float | int]
    by_hero: dict[str, dict[str, int]]


# --- SSE POST …/stream (Wave B5) ---


class DesktopAiChatStreamSseTokenOut(BaseModel):
    """SSE ``data:`` for ``event: token`` (token deltas)."""

    model_config = ConfigDict(extra="ignore")

    event: Literal["token"] = "token"
    delta: str


class DesktopAiChatStreamSseErrorOut(BaseModel):
    """SSE ``data:`` for ``event: error`` (terminal)."""

    model_config = ConfigDict(extra="ignore")

    event: Literal["error"] = "error"
    message: str | None = None
    detail: Any = None


class DesktopAiChatStreamSseDoneOut(BaseModel):
    """SSE ``data:`` for ``event: done`` (turn complete)."""

    model_config = ConfigDict(extra="allow")

    event: Literal["done"] = "done"
    context: dict[str, Any] | None = None
    duration_ms: int | None = None
    prompt: dict[str, Any] | None = None
    web_search_sources: list[dict[str, Any]] | None = None


class DesktopAiChatStreamSseSpeakerStartOut(BaseModel):
    """SSE ``data:`` for ``event: speaker_start`` (ensemble / Team)."""

    model_config = ConfigDict(extra="allow")

    event: Literal["speaker_start"] = "speaker_start"
    desktop_hero_id: str | None = None
    index: int | None = None
    delivery_mode: Literal["joint", "separate"] | None = None
    blueprint_step_id: str | None = None


class DesktopAiChatStreamSseCouncilTurnOut(BaseModel):
    """SSE ``data:`` for ``event: council_turn`` (Process tab transcript)."""

    model_config = ConfigDict(extra="allow")

    event: Literal["council_turn"] = "council_turn"
    turn: dict[str, Any] | None = None
    transcript_version: int | None = None
    mode: str | None = None
    turns_count: int | None = None
    roster: list[str] | None = None
    closing: dict[str, Any] | None = None


class DesktopAiChatStreamSseEnsemblePlanOut(BaseModel):
    """SSE ``data:`` for ``event: ensemble_plan`` (blueprint / legacy plan UI)."""

    model_config = ConfigDict(extra="allow")

    event: Literal["ensemble_plan"] = "ensemble_plan"
    blueprint: bool | None = None
    plan_template_id: str | None = None
    plan_template_title: str | None = None
    artifact_type: str | None = None
    delivery_mode: Literal["joint", "separate"] | None = None
    speakers: list[str] | None = None
    quality_status: dict[str, Any] | None = None
    document_outline: list[dict[str, Any]] | None = None
    steps_preview: list[dict[str, Any]] | None = None
    deferred_plan_templates: list[dict[str, Any]] | None = None


class DesktopAiChatStreamSseToolsOut(BaseModel):
    """SSE ``data:`` for ``event: tools`` (tool router / loop trace)."""

    model_config = ConfigDict(extra="allow")

    event: Literal["tools"] = "tools"
    trace: list[dict[str, Any]] | None = None


class DesktopAiChatStreamSseDocumentReplaceOut(BaseModel):
    """SSE ``data:`` for ``event: assistant_document_replace`` (final joint markdown)."""

    model_config = ConfigDict(extra="allow")

    event: Literal["assistant_document_replace"] = "assistant_document_replace"
    content: str | None = None
    message_id: str | None = None
    metadata: dict[str, Any] | None = None


class DesktopAiChatStreamSseNamedOut(BaseModel):
    """Catch-all for other named ``data.event`` values on the same stream.

    Includes ``planning``, ``tools_progress``, ``joint_section_start``,
    ``ensemble_document_confirm``, ``ensemble_action_*``, ``ensemble_joint_*``,
    ``ensemble_chair_done``, and polish start/done frames. FE dispatches by name.
    """

    model_config = ConfigDict(extra="allow")

    event: str


class DesktopAiChatStreamSsePayloadDoc(
    RootModel[
        DesktopAiChatStreamSseTokenOut
        | DesktopAiChatStreamSseDoneOut
        | DesktopAiChatStreamSseErrorOut
        | DesktopAiChatStreamSseSpeakerStartOut
        | DesktopAiChatStreamSseCouncilTurnOut
        | DesktopAiChatStreamSseEnsemblePlanOut
        | DesktopAiChatStreamSseToolsOut
        | DesktopAiChatStreamSseDocumentReplaceOut
        | DesktopAiChatStreamSseNamedOut
    ]
):
    """OpenAPI doc for Desktop AI Chat ``POST …/chats/{id}/stream`` ``data:`` JSON.

    Wire frames are ``data: {JSON}\\n\\n`` with ``event`` inside the JSON (not SSE
    ``event:`` lines). Named values include ``token``, ``done``, ``error``,
    ``speaker_start``, ``council_turn``, ``ensemble_plan``, ``tools``,
    ``assistant_document_replace``, plus planning/action/polish frames via
    ``DesktopAiChatStreamSseNamedOut``. Keep-alive comments are outside this union.
    """
