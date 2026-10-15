# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Explicit Desktop AI Chat Discussion mode (presets, bounded batches, pause policies).
# Invariants:
# - Never auto-started from Council/blueprint/stream; only dedicated Discussion endpoints.
# - Document generation is opt-in and never emitted as assistant_document_replace automatically.
# Related:
# - documentation/product/desktop/DESKTOP-AI-CHAT-DISCUSSION-MODE.md
# ---
"""Desktop AI Chat Discussion mode package."""

from api.services.desktop_chat_ensemble.discussion.contracts import (
    ACTIVE_DISCUSSION_STATUSES,
    DiscussionActorType,
    DiscussionIntensity,
    DiscussionPauseReason,
    DiscussionRelation,
    DiscussionStatus,
)

__all__ = [
    "ACTIVE_DISCUSSION_STATUSES",
    "DiscussionActorType",
    "DiscussionIntensity",
    "DiscussionPauseReason",
    "DiscussionRelation",
    "DiscussionStatus",
]
