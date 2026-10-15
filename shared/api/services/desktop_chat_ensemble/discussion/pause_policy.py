# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Pause policy for Discussion batches (checkpoint / raise-hand / goal / max turns).
# Invariants:
# - Checkpoint fires after exactly N AI turns in the current segment (default 5).
# - Raise-hand wins after the current complete AI reply; no next AI turn starts.
# Related:
# - documentation/product/desktop/DESKTOP-AI-CHAT-DISCUSSION-MODE.md
# ---
"""Discussion pause decision helpers."""

from __future__ import annotations

from dataclasses import dataclass

from api.services.desktop_chat_ensemble.discussion.contracts import (
    DiscussionPauseReason,
    DiscussionStatus,
)
from api.services.desktop_chat_ensemble.discussion.presets.base import DiscussionPreset


@dataclass(frozen=True, slots=True)
class PauseDecision:
    should_pause: bool
    status: DiscussionStatus | None = None
    reason: DiscussionPauseReason | None = None


def evaluate_pause_after_ai_turn(
    *,
    preset: DiscussionPreset,
    checkpoint_ai_turns: int,
    total_ai_turns: int,
    pause_requested: bool,
    goal_reached: bool,
) -> PauseDecision:
    """Decide pause after one complete AI turn (never mid-token)."""
    if pause_requested:
        return PauseDecision(
            should_pause=True,
            status=DiscussionStatus.PAUSED_USER,
            reason=DiscussionPauseReason.RAISE_HAND,
        )
    if goal_reached:
        return PauseDecision(
            should_pause=True,
            status=DiscussionStatus.PAUSED_GOAL,
            reason=DiscussionPauseReason.GOAL,
        )
    if total_ai_turns >= max(1, int(preset.max_total_ai_turns)):
        return PauseDecision(
            should_pause=True,
            status=DiscussionStatus.PAUSED_GOAL,
            reason=DiscussionPauseReason.GOAL,
        )
    interval = max(1, int(preset.checkpoint_interval))
    if checkpoint_ai_turns >= interval:
        return PauseDecision(
            should_pause=True,
            status=DiscussionStatus.PAUSED_CHECKPOINT,
            reason=DiscussionPauseReason.CHECKPOINT,
        )
    return PauseDecision(should_pause=False)


def batch_ai_turn_budget(*, preset: DiscussionPreset, checkpoint_ai_turns: int) -> int:
    """How many AI turns remain in this worker batch before checkpoint."""
    interval = max(1, int(preset.checkpoint_interval))
    remaining = interval - max(0, int(checkpoint_ai_turns))
    return max(0, remaining)
