"""Pydantic contracts for internal video calls."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class VideoCallJoinResponse(BaseModel):
    """Join payload for a user authorized to enter a call."""

    model_config = ConfigDict(extra="ignore")

    call_id: str = Field(..., description="Internal EliteEW video call id.")
    chat_id: str | None = Field(None, description="Linked GAF Chat id for 1:1 calls.")
    room_name: str = Field(..., description="Opaque meeting room name; not derived from chat id.")
    status: str = Field(..., description="Current call status.")
    call_kind: str = Field(default="direct", description="direct or group.")
    provider: str = Field(default="jitsi", description="Meeting backend provider.")
    meet_base_url: str | None = Field(None, description="Browser-facing meeting origin when JWT issued.")
    jwt: str | None = Field(None, description="Short-lived meeting JWT when authorized to enter.")
    join_url: str | None = Field(None, description="Browser URL with JWT when authorized to enter.")
    expires_at: datetime | None = Field(None, description="JWT expiration timestamp.")
    awaiting_accept: bool = Field(
        default=False,
        description="True for 1:1 caller while callee has not accepted (no join_url yet).",
    )


class VideoCallCreateResponse(VideoCallJoinResponse):
    """Response returned to the caller after starting a GAF call."""

    callee_user_id: str | None = Field(None, description="Primary recipient for 1:1 calls.")
    invited_user_ids: list[str] = Field(
        default_factory=list,
        description="Invitees notified for group calls (excluding the host).",
    )
    reused_existing: bool = Field(
        default=False,
        description="True when an open ringing/active call for this chat was reused instead of creating a new room.",
    )


class VideoCallPendingIncomingItem(BaseModel):
    """Ringing 1:1 call where the current user is the callee (incoming recovery)."""

    model_config = ConfigDict(extra="ignore")

    call_id: str
    chat_id: str | None = None
    caller_user_id: str
    created_at: datetime
    call_target: str = Field(default="both")


class GroupGafVideoCallCreateRequest(BaseModel):
    """Additional friends to invite when starting a group call from a GAF chat."""

    model_config = ConfigDict(extra="forbid")

    additional_participant_ids: list[str] = Field(
        ...,
        min_length=1,
        description="At least one friend beyond the chat partner.",
    )


class VideoCallInviteRequest(BaseModel):
    """Invite more friends into an active group call."""

    model_config = ConfigDict(extra="forbid")

    participant_user_ids: list[str] = Field(
        ...,
        min_length=1,
        description="Friend DB user ids to invite.",
    )


class VideoCallInviteResponse(BaseModel):
    """Result of inviting users into an existing call."""

    call_id: str
    invited_user_ids: list[str] = Field(default_factory=list)


class VideoCallEndResponse(BaseModel):
    """Lightweight status response for ending a call."""

    status: str = "ok"
    call_id: str
    call_status: str | None = Field(
        default=None,
        description="Final video_calls.status after end (ended, missed, ...).",
    )
    missed_reason: str | None = Field(
        default=None,
        description="When call_status=missed: declined, caller_cancelled, no_answer, callee_unreachable.",
    )
    already_ended: bool = Field(
        default=False,
        description="True when the call was already ended/missed before this request.",
    )
