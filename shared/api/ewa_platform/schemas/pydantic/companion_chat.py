# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Request/response schemas for **`POST /api/v1/ewa/companion-chat/message`** — desktop «friend» chat against HTTP LLM.
# Invariants:
# - Message bodies are plain UTF-8 text; optional image attachment is multimodal for the LLM or backend image-edit source (marker in transcript).
# - Persistence merges into ``learned_preferences.desktop_friend_chat_v1``.
# - ``shell_context.windows`` may include ``surface_excerpt``, ``surface_selection`` (Doc Editor), and ``surface_listing``
#   (bounded plaintext inventories); all sanitized server-side.
# Related:
# - api/ewa_platform/gateways/routers/companion_chat.py
# - api/ewa_platform/companion/turn/chat_turn.py
# ---
"""EWA companion chat HTTP schemas."""

from __future__ import annotations

from typing import Annotated, Any, Literal

from pydantic import BaseModel, Field, RootModel, field_validator, model_validator

from api.ewa_platform.schemas.pydantic.companion_execution_report import (
    CompanionExecutionReportV1,
    CompanionOrchestrationOutcome,
    ProactiveSuggestionV1,
)


class CompanionShellWindowIn(BaseModel):
    """Single window row from the desktop SPA.

    ``surface_excerpt`` = optional bounded body preview (Doc Editor). ``surface_selection`` = optional bounded plain
    selection in Doc Editor. ``surface_listing`` = optional bounded plaintext listing (folder filenames,
    Presentations history/picker headings, …).
    """

    window_id: Annotated[str, Field(min_length=1, max_length=128)]
    app_component: Annotated[str, Field(default="", max_length=96)] = ""
    title: Annotated[str, Field(default="", max_length=256)] = ""
    z_index: Annotated[int, Field(default=0, ge=0, le=2_000_000)] = 0
    minimized: bool = False
    desktop_id: Annotated[str | None, Field(default=None, max_length=128)] = None
    surface_excerpt: Annotated[str, Field(default="", max_length=4000)] = ""
    surface_selection: Annotated[str, Field(default="", max_length=4000)] = ""
    surface_listing: Annotated[str, Field(default="", max_length=4000)] = ""


class CompanionShellContextIn(BaseModel):
    """Optional companion-chat desktop snapshot (`schema_version=1`). Sanitized further server-side."""

    schema_version: int = 1
    client_surface: Annotated[
        Literal["desktop", "mobile", "embedded"] | None,
        Field(default=None, max_length=32),
    ] = None
    active_desktop_id: Annotated[str | None, Field(default=None, max_length=128)] = None
    active_window_id: Annotated[str | None, Field(default=None, max_length=128)] = None
    windows: Annotated[list[CompanionShellWindowIn], Field(default_factory=list, max_length=40)] = Field(
        default_factory=list
    )

    @field_validator("windows")
    @classmethod
    def _cap_windows(cls, v: list[CompanionShellWindowIn]) -> list[CompanionShellWindowIn]:
        return v[:40]


class CompanionChatImageAttachmentIn(BaseModel):
    """Optional image for one companion turn (JPEG/PNG/WebP/GIF, base64 without data-URL prefix)."""

    mime_type: Annotated[str, Field(min_length=1, max_length=64)]
    data_base64: Annotated[str, Field(min_length=1, max_length=6_000_000)]


class CompanionChatMessageIn(BaseModel):
    """Inbound user line for one companion chat turn."""

    message: Annotated[str, Field(default="", max_length=12000)]
    image_attachment: CompanionChatImageAttachmentIn | None = None
    shell_context: CompanionShellContextIn | None = None
    use_web_search: bool = False
    client_turn_id: Annotated[str | None, Field(default=None, max_length=128)] = None

    @model_validator(mode="after")
    def _message_or_image_required(self) -> CompanionChatMessageIn:
        if not (self.message or "").strip() and self.image_attachment is None:
            msg = "message_or_image_required"
            raise ValueError(msg)
        return self

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "message": "Привет, помоги с темой стола.",
                    "shell_context": {
                        "schema_version": 1,
                        "active_desktop_id": "d1",
                        "active_window_id": "w1",
                        "windows": [
                            {
                                "window_id": "w1",
                                "app_component": "DocEditor",
                                "title": "Notes",
                                "z_index": 10,
                                "minimized": False,
                                "surface_excerpt": "First paragraph plain text…",
                            }
                        ],
                    },
                },
            ]
        }
    }


class CompanionOcrTurnIn(BaseModel):
    """Persist companion transcript after client-side image OCR (no LLM)."""

    filename: Annotated[str, Field(min_length=1, max_length=256)]
    ocr_text: Annotated[str, Field(default="", max_length=48000)]
    confidence: float | None = Field(default=None, ge=0.0, le=100.0)
    source: Literal["local", "content_manager"] = "local"
    unified_content_id: Annotated[str | None, Field(default=None, max_length=128)] = None
    client_turn_id: Annotated[str | None, Field(default=None, max_length=128)] = None


class CompanionSurfaceBlockActionOut(BaseModel):
    """One declarative UI action on a universal surface block."""

    type: str
    label_ru: str = ""
    label_en: str = ""
    payload: dict[str, Any] = Field(default_factory=dict)


class CompanionSurfaceBlockOut(BaseModel):
    """Universal Output Surface V2 block: result, workflow timeline, confirm, choice or builder card."""

    id: str
    kind: Literal["text", "result", "workflow_timeline", "confirm", "choice", "builder", "history_ref"]
    title: str = ""
    subtitle: str = ""
    status: str = ""
    run_id: str | None = None
    payload: dict[str, Any] = Field(default_factory=dict)
    actions: list[CompanionSurfaceBlockActionOut] = Field(default_factory=list)
    created_at: str | None = None


class CompanionChatMessageOut(BaseModel):
    """Assistant reply plus bumped revision after persistence."""

    reply: str
    companion_revision: int = Field(ge=1)
    # Allowlisted, model-suggested or server-augmented desktop actions open_app / filters, etc.
    # the LLM did not emit a `<<ACTIONS>>...<<END>>` tail or the tail had nothing the allowlist accepted.
    actions: list[dict[str, Any]] = Field(default_factory=list)
    task_run: dict[str, Any] | None = Field(default=None)
    transformed_this_turn: bool = Field(
        default=False,
        description="True when this turn triggered a persona **transform** event (forward Arlika or restore EWA); "
        "SSE may emit ``transform``.",
    )
    transform_event_kind: str | None = Field(
        default=None,
        description='When set with ``transformed_this_turn``: ``"arlika"`` (v1 forward), ``"ewa_restore"`` (v1 revert), '
        '``"ewa_to_arly"`` (enter / switch to ``arlika_v2``), ``"arly_to_ewa"`` (v2 → soft EWA) — clip selection for SSE.',
    )
    desktop_config_patch_applied: bool = Field(
        default=False,
        description="True when companion ``patch_desktop_config`` was executed server-side (PATCH user's desktop/config).",
    )
    turn_plan_hint: str | None = Field(
        default=None,
        description="Optional UI hint when the orchestrator queued the next step in ``companion_turn_plan_v1``.",
    )
    turn_plan_next_tool: str | None = Field(
        default=None,
        description="Optional next queued tool id (e.g. ``music_generation`` / ``file_open``).",
    )
    turn_plan_source: str | None = Field(
        default=None,
        description="Optional queue source tag (e.g. compound or file_study enqueue path).",
    )
    output_surface: dict[str, Any] | None = Field(
        default=None,
        description="Optional companion output surface mode (chat, workflow_dag_builder, workflow_edit, file_list, document_editor, roadmap, script).",
    )
    surface_blocks: list[CompanionSurfaceBlockOut] = Field(
        default_factory=list,
        description="Universal interactive/result blocks for Output Surface V2.",
    )
    execution_reports: list[CompanionExecutionReportV1] = Field(
        default_factory=list,
        description="Structured per-turn execution reports (tool/step/branch outcomes).",
    )
    orchestration_outcome: CompanionOrchestrationOutcome | None = Field(
        default=None,
        description="Turn-level orchestrator disposition: handled, deferred_llm, fell_through, partial.",
    )
    proactive_suggestion: ProactiveSuggestionV1 | None = Field(
        default=None,
        description="Optional deterministic proactive question (no LLM sidecar).",
    )


class CompanionImageOperationResultPayload(BaseModel):
    """Durable task-run result payload for backend-first companion image operations."""

    image_tool_mode: Literal["generate", "edit"]
    operation_mode: Literal["generate", "edit"]
    prompt_preview: str = ""
    content_id: str | None = None
    unified_content_id: str | None = None
    source_content_id: str | None = None
    source_unified_content_id: str | None = None
    image_url: str | None = None
    mime_type: str | None = None
    aspect_ratio: str | None = None
    type_key: str | None = None
    workflow_template: str | None = None


class CompanionTaskStepOut(BaseModel):
    """One durable step row for a companion task run."""

    id: str
    run_id: str
    step_index: int
    step_kind: str
    status: str
    title: str
    input_payload: dict[str, Any] = Field(default_factory=dict)
    output_payload: dict[str, Any] = Field(default_factory=dict)
    error_payload: dict[str, Any] = Field(default_factory=dict)
    created_at: str | None = None
    updated_at: str | None = None
    completed_at: str | None = None


class CompanionTaskRunOut(BaseModel):
    """Durable companion task-run row exposed to the desktop UI operations panel."""

    id: str
    principal_id: str
    status: str
    intent_kind: str
    user_message: str
    plan_payload: dict[str, Any] = Field(default_factory=dict)
    confirmation_state: dict[str, Any] = Field(default_factory=dict)
    result_payload: dict[str, Any] = Field(default_factory=dict)
    error_payload: dict[str, Any] = Field(default_factory=dict)
    execution_mode: str = "sync"
    run_revision: int = 1
    parent_run_id: str | None = None
    created_at: str | None = None
    updated_at: str | None = None
    completed_at: str | None = None
    steps: list[CompanionTaskStepOut] = Field(default_factory=list)
    surface_blocks: list[CompanionSurfaceBlockOut] = Field(default_factory=list)


class CompanionTaskRunsOut(BaseModel):
    """List wrapper for companion task runs (stable shape for SPA polling)."""

    runs: list[CompanionTaskRunOut] = Field(default_factory=list)


class CompanionTaskRunConfirmIn(BaseModel):
    """Explicit confirm/cancel for a task run awaiting confirmation."""

    decision: Annotated[str, Field(min_length=1, max_length=16)]
    expect_run_revision: Annotated[int | None, Field(ge=1)] = Field(
        default=None,
        description="When set and mismatch → 409 Conflict (stale task run).",
    )

    @field_validator("decision")
    @classmethod
    def _normalize_decision(cls, v: str) -> str:
        d = str(v or "").strip().lower()
        if d not in {"confirm", "cancel"}:
            raise ValueError("decision_must_be_confirm_or_cancel")
        return d


class CompanionTaskRunConfirmOut(BaseModel):
    """Outcome of HTTP confirm — reply/actions for SPA dispatch plus updated run row."""

    ok: bool = True
    reply: str = ""
    actions: list[dict[str, Any]] = Field(default_factory=list)
    task_run: CompanionTaskRunOut


class CompanionTaskRunCancelOut(BaseModel):
    """Cancel an in-flight async music companion task run (+ best-effort UGS cancel)."""

    ok: bool = True
    reply: str = ""
    task_run: CompanionTaskRunOut
    ugs_requests_cancelled: int = 0


# --- SSE JSON payloads (event name is SSE ``event:`` framing; OpenAPI documents ``data:`` JSON) ---


class CompanionChatAction(BaseModel):
    """Allowlisted desktop action from companion orchestration (open_app, notice, …)."""

    type: str
    outcome: str | None = None
    rationale: str | None = None

    model_config = {"extra": "allow"}


class CompanionChatStreamDelta(BaseModel):
    """SSE event ``delta``: incremental visible reply text."""

    chunk: str


class CompanionChatStreamFinal(CompanionChatMessageOut):
    """SSE event ``final``: same wire fields as sync ``CompanionChatMessageOut``."""


class CompanionChatStreamActions(BaseModel):
    """SSE event ``actions``: allowlisted desktop actions before ``final``."""

    actions: list[CompanionChatAction]


class CompanionChatStreamError(BaseModel):
    """SSE event ``error``: terminal failure (stream ends)."""

    code: str
    message: str | None = None

    model_config = {"extra": "allow"}


class CompanionChatStreamDone(BaseModel):
    """SSE event ``done``: successful terminal marker."""

    ok: bool = True


class CompanionChatStreamPayloadDoc(
    RootModel[
        CompanionChatStreamDelta
        | CompanionChatStreamFinal
        | CompanionChatStreamActions
        | CompanionChatStreamError
        | CompanionChatStreamDone
    ]
):
    """Documented union of companion-chat SSE ``data:`` JSON payloads (not SSE framing)."""


class CompanionTaskRunSnapshotSseOut(BaseModel):
    """SSE ``run_snapshot`` data payload on task-events streams."""

    run: CompanionTaskRunOut


class CompanionTaskLifecycleSsePayloadDoc(RootModel[CompanionTaskRunSnapshotSseOut | dict[str, Any]]):
    """Task lifecycle SSE JSON (``run_snapshot`` typed; other events honest bags)."""
