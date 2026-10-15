# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Typed status/relation contracts for Desktop AI Chat Discussion mode.
# Invariants:
# - Status graph: queued → running → paused_* → queued|completed|cancelled.
# - User interjections are accepted in any paused_* status and leave the session paused.
# Related:
# - documentation/product/desktop/DESKTOP-AI-CHAT-DISCUSSION-MODE.md
# ---
"""Discussion mode enums and shared constants."""

from __future__ import annotations

from enum import StrEnum

DEFAULT_CHECKPOINT_INTERVAL = 5
DEFAULT_MAX_TOTAL_AI_TURNS = 40
DEFAULT_MAX_CONSECUTIVE_SAME_HERO = 2
LEASE_TTL_SECONDS = 180
EVENT_STREAM_MAXLEN = 500
DISCUSSION_CELERY_QUEUE = "desktop_discussion"
DEFAULT_PARTICIPANT_ROLE_TITLE = "инкогнито"


def format_participant_speaker_label(*, display_name: str, role_title: str) -> str:
    """Stable speaker label for transcript / prompts: «Имя (должность)»."""
    name = (display_name or "").strip() or "Участник"
    role = (role_title or "").strip() or DEFAULT_PARTICIPANT_ROLE_TITLE
    return f"{name} ({role})"


class DiscussionStatus(StrEnum):
    QUEUED = "queued"
    RUNNING = "running"
    PAUSED_CHECKPOINT = "paused_checkpoint"
    PAUSED_USER = "paused_user"
    PAUSED_GOAL = "paused_goal"
    PAUSED_ERROR = "paused_error"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


ACTIVE_DISCUSSION_STATUSES: frozenset[str] = frozenset(
    {
        DiscussionStatus.QUEUED.value,
        DiscussionStatus.RUNNING.value,
        DiscussionStatus.PAUSED_CHECKPOINT.value,
        DiscussionStatus.PAUSED_USER.value,
        DiscussionStatus.PAUSED_GOAL.value,
        DiscussionStatus.PAUSED_ERROR.value,
    }
)

PAUSED_DISCUSSION_STATUSES: frozenset[str] = frozenset(
    {
        DiscussionStatus.PAUSED_CHECKPOINT.value,
        DiscussionStatus.PAUSED_USER.value,
        DiscussionStatus.PAUSED_GOAL.value,
        DiscussionStatus.PAUSED_ERROR.value,
    }
)

TERMINAL_DISCUSSION_STATUSES: frozenset[str] = frozenset(
    {
        DiscussionStatus.COMPLETED.value,
        DiscussionStatus.CANCELLED.value,
    }
)

RESUMABLE_DISCUSSION_STATUSES: frozenset[str] = frozenset(
    {
        DiscussionStatus.PAUSED_CHECKPOINT.value,
        DiscussionStatus.PAUSED_USER.value,
        DiscussionStatus.PAUSED_GOAL.value,
        DiscussionStatus.PAUSED_ERROR.value,
    }
)


class DiscussionPauseReason(StrEnum):
    CHECKPOINT = "checkpoint"
    RAISE_HAND = "raise_hand"
    GOAL = "goal"
    ERROR = "error"
    FINISH = "finish"
    CANCEL = "cancel"


class DiscussionActorType(StrEnum):
    AI = "ai"
    USER = "user"
    SYSTEM = "system"


class DiscussionRelation(StrEnum):
    OPENING = "opening"
    SUPPORT = "support"
    CHALLENGE = "challenge"
    REBUTTAL = "rebuttal"
    SYNTHESIS = "synthesis"
    USER_INTERJECTION = "user_interjection"
    MODERATOR = "moderator"


class DiscussionIntensity(StrEnum):
    CALM = "calm"
    PROFESSIONAL_CONFRONTATIONAL = "professional_confrontational"
    SHARP = "sharp"


class DiscussionEventType(StrEnum):
    SESSION = "discussion_session"
    TURN_PLAN = "discussion_turn_plan"
    COUNCIL_TURN = "council_turn"
    PAUSE = "discussion_pause"
    SEGMENT_DONE = "discussion_segment_done"
    DOCUMENT_READY = "discussion_document_ready"
    ERROR = "error"
