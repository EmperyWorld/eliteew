# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Bounded Discussion worker batch: claim lease → plan/speak ≤ checkpoint → pause & exit.
# Invariants:
# - One task never waits on the user; raise-hand/goal/checkpoint ends the batch.
# - Refresh session before pause decisions so concurrent raise-hand is visible.
# - Each turn is persisted before its Redis event is published.
# - Batch end logs [METRIC] discussion_batch (speakers/produced/duration_ms); no UI.
# Related:
# - documentation/product/desktop/DESKTOP-AI-CHAT-DISCUSSION-MODE.md
# ---
"""Discussion batch engine."""

from __future__ import annotations

import logging
import time
from typing import Any
from uuid import UUID

from api.models.desktop_ai_chat import DesktopAiChat
from api.services.desktop_chat.db_session import desktop_ai_chat_session
from api.services.desktop_chat.service import fetch_config_defaults
from api.services.desktop_chat_ensemble.discussion.contracts import (
    DiscussionActorType,
    DiscussionEventType,
    DiscussionRelation,
    DiscussionStatus,
    format_participant_speaker_label,
)
from api.services.desktop_chat_ensemble.discussion.events import publish_discussion_event
from api.services.desktop_chat_ensemble.discussion.pause_policy import (
    batch_ai_turn_budget,
    evaluate_pause_after_ai_turn,
)
from api.services.desktop_chat_ensemble.discussion.planner import plan_next_ai_turn
from api.services.desktop_chat_ensemble.discussion.presets import require_preset
from api.services.desktop_chat_ensemble.discussion.repository import (
    bump_version,
    claim_session_lease,
    get_session,
    insert_turn,
    list_turns,
    release_lease,
)
from api.services.desktop_chat_ensemble.discussion.speech import generate_discussion_speech
from api.services.desktop_chat_ensemble.heroes import HERO_SHORT_LABEL

logger = logging.getLogger(__name__)


def format_discussion_batch_metric(
    *,
    speakers: int,
    produced: int,
    duration_ms: int,
    status: object,
    reason: object,
    preset_id: object = None,
) -> str:
    """Operator metric line (mirror `[METRIC] ensemble_council_budget`). No UI."""
    status_s = status if status not in (None, "") else "-"
    reason_s = reason if reason not in (None, "") else "-"
    preset_s = preset_id if preset_id not in (None, "") else "-"
    return (
        f"[METRIC] discussion_batch speakers={speakers} produced={produced} "
        f"duration_ms={duration_ms} parallel=0 status={status_s} reason={reason_s} "
        f"preset={preset_s}"
    )


def _log_discussion_batch_metric(
    *,
    started_at: float,
    speakers: int,
    produced: int,
    status: object,
    reason: object,
    preset_id: object = None,
) -> None:
    duration_ms = max(0, int((time.monotonic() - started_at) * 1000))
    logger.info(
        "%s",
        format_discussion_batch_metric(
            speakers=speakers,
            produced=produced,
            duration_ms=duration_ms,
            status=status,
            reason=reason,
            preset_id=preset_id,
        ),
    )


def _transcript_lines(turns: list[Any], *, session: Any) -> list[str]:
    user_label = format_participant_speaker_label(
        display_name=str(getattr(session, "participant_display_name", "") or ""),
        role_title=str(getattr(session, "participant_role_title", "") or ""),
    )
    lines: list[str] = []
    for turn in turns:
        actor = str(turn.actor_type or "")
        if actor == DiscussionActorType.AI.value:
            label = HERO_SHORT_LABEL.get(str(turn.hero_id or ""), str(turn.hero_id or "AI"))
        elif actor == DiscussionActorType.USER.value:
            meta = dict(getattr(turn, "turn_metadata", None) or {})
            label = str(meta.get("speaker_label") or "").strip() or user_label
        else:
            label = "Система"
        content = str(turn.content or "").strip()
        if content:
            lines.append(f"{label}: {content}")
    return lines


def _goal_heuristic(*, goal: str, turns: list[Any], preset_completion: str) -> bool:
    """Lightweight completion signal: enough AI turns + user/synthesis presence."""
    _ = preset_completion
    ai_count = sum(1 for t in turns if str(t.actor_type) == DiscussionActorType.AI.value)
    if ai_count < 6:
        return False
    has_synthesis = any(str(t.relation) == DiscussionRelation.SYNTHESIS.value for t in turns)
    goal_words = [w for w in str(goal or "").lower().split() if len(w) > 3][:6]
    if not goal_words:
        return has_synthesis and ai_count >= 8
    joined = " ".join(str(t.content or "").lower() for t in turns[-8:])
    hits = sum(1 for w in goal_words if w in joined)
    return has_synthesis and hits >= max(1, len(goal_words) // 2)


async def run_discussion_batch(
    *,
    session_id: UUID,
    expected_version: int,
    lease_owner: str,
) -> dict[str, Any]:
    """Execute one idempotent Discussion segment batch."""
    async with desktop_ai_chat_session() as db:
        claimed = await claim_session_lease(
            db,
            session_id=session_id,
            expected_version=expected_version,
            lease_owner=lease_owner,
        )
        if claimed is None:
            current = await get_session(db, session_id)
            logger.info(
                "[STEP] discussion_batch_claim_miss session_id=%s expected_version=%s status=%s version=%s",
                session_id,
                expected_version,
                getattr(current, "status", None),
                getattr(current, "version", None),
            )
            return {
                "ok": False,
                "reason": "claim_miss",
                "session_id": str(session_id),
                "status": getattr(current, "status", None),
                "version": getattr(current, "version", None),
            }

        session = claimed
        batch_t0 = time.monotonic()
        roster_for_metric = [str(h) for h in (session.roster or []) if str(h).strip()]
        try:
            preset = require_preset(session.preset_id)
        except KeyError:
            session.status = DiscussionStatus.PAUSED_ERROR.value
            session.pause_reason = "error"
            await release_lease(session)
            bump_version(session)
            await db.commit()
            _log_discussion_batch_metric(
                started_at=batch_t0,
                speakers=len(roster_for_metric),
                produced=0,
                status=session.status,
                reason="unknown_preset",
                preset_id=session.preset_id,
            )
            return {"ok": False, "reason": "unknown_preset", "session_id": str(session_id)}

        chat = await db.get(DesktopAiChat, session.chat_id)
        defaults = await fetch_config_defaults(db)
        model = (chat.llama_model if chat else None) or str(defaults.get("default_model") or "llama")
        roster = [str(h) for h in (session.roster or []) if str(h).strip()]

        await publish_discussion_event(
            session_id=session.id,
            event_type=DiscussionEventType.SESSION,
            payload={
                "session_id": str(session.id),
                "status": session.status,
                "version": session.version,
                "segment_index": session.segment_index,
            },
        )

        produced = 0
        budget = batch_ai_turn_budget(preset=preset, checkpoint_ai_turns=int(session.checkpoint_ai_turns or 0))
        final_status = session.status
        final_reason = session.pause_reason

        while produced < budget:
            await db.refresh(session)
            if session.pause_requested:
                session.status = DiscussionStatus.PAUSED_USER.value
                session.pause_reason = "raise_hand"
                break

            turns = await list_turns(db, session.id)
            prior_ai = [
                str(t.hero_id) for t in turns if str(t.actor_type) == DiscussionActorType.AI.value and t.hero_id
            ]
            last_user = next(
                (str(t.content) for t in reversed(turns) if str(t.actor_type) == DiscussionActorType.USER.value),
                None,
            )
            last_rel_raw = next(
                (str(t.relation) for t in reversed(turns) if str(t.actor_type) == DiscussionActorType.AI.value),
                None,
            )
            last_rel = None
            if last_rel_raw:
                try:
                    last_rel = DiscussionRelation(last_rel_raw)
                except ValueError:
                    last_rel = None

            plan = plan_next_ai_turn(
                preset=preset,
                roster=roster,
                prior_ai_hero_ids=prior_ai,
                topic=session.topic,
                goal=session.goal,
                last_user_text=last_user,
                last_relation=last_rel,
            )
            if plan is None:
                session.status = DiscussionStatus.PAUSED_ERROR.value
                session.pause_reason = "error"
                break

            await publish_discussion_event(
                session_id=session.id,
                event_type=DiscussionEventType.TURN_PLAN,
                payload={
                    "hero_id": plan.hero_id,
                    "relation": plan.relation.value,
                    "rationale": plan.rationale,
                    "segment_index": session.segment_index,
                },
            )

            speech = await generate_discussion_speech(
                hero_id=plan.hero_id,
                topic=session.topic,
                goal=session.goal,
                preset_title=preset.title_ru,
                relation=plan.relation.value,
                intensity=session.intensity,
                roster=roster,
                transcript_lines=_transcript_lines(turns, session=session),
                model=model,
                preset_goal_rubric=preset.goal_rubric,
                relation_hints=dict(preset.relation_hints),
                panel_guide=str(((session.settings or {}).get("interview_handoff") or {}).get("panel_guide") or ""),
                panel_role=str(
                    (((session.settings or {}).get("interview_handoff") or {}).get("panel_roles") or {}).get(
                        plan.hero_id
                    )
                    or ""
                ),
            )
            if not speech:
                session.status = DiscussionStatus.PAUSED_ERROR.value
                session.pause_reason = "error"
                break

            reply_to_id = None
            if plan.reply_to_ordinal:
                for t in turns:
                    if int(t.ordinal) == int(plan.reply_to_ordinal):
                        reply_to_id = t.id
                        break

            turn = await insert_turn(
                db,
                session=session,
                actor_type=DiscussionActorType.AI,
                content=speech,
                relation=plan.relation.value,
                hero_id=plan.hero_id,
                reply_to_turn_id=reply_to_id,
                tone=session.intensity,
                metadata={"rationale": plan.rationale, "segment_index": session.segment_index},
            )
            session.total_ai_turns = int(session.total_ai_turns or 0) + 1
            session.checkpoint_ai_turns = int(session.checkpoint_ai_turns or 0) + 1
            session.last_actor_hero_id = plan.hero_id
            if session.document_markdown:
                session.document_stale = True
            bump_version(session)
            await db.commit()

            await publish_discussion_event(
                session_id=session.id,
                event_type=DiscussionEventType.COUNCIL_TURN,
                payload={
                    "turn_id": str(turn.id),
                    "ordinal": turn.ordinal,
                    "hero_id": plan.hero_id,
                    "relation": plan.relation.value,
                    "content": speech,
                    "actor_type": DiscussionActorType.AI.value,
                },
            )
            produced += 1

            turns_after = await list_turns(db, session.id)
            goal_reached = _goal_heuristic(
                goal=session.goal,
                turns=turns_after,
                preset_completion=preset.completion_rubric,
            )
            # Raise-hand may be committed by another request while this turn was generating.
            await db.refresh(session)
            decision = evaluate_pause_after_ai_turn(
                preset=preset,
                checkpoint_ai_turns=int(session.checkpoint_ai_turns or 0),
                total_ai_turns=int(session.total_ai_turns or 0),
                pause_requested=bool(session.pause_requested),
                goal_reached=goal_reached,
            )
            if decision.should_pause and decision.status is not None:
                session.status = decision.status.value
                session.pause_reason = decision.reason.value if decision.reason else None
                break

        await db.refresh(session)
        if session.pause_requested and session.status == DiscussionStatus.RUNNING.value:
            session.status = DiscussionStatus.PAUSED_USER.value
            session.pause_reason = "raise_hand"
        elif session.status == DiscussionStatus.RUNNING.value:
            # Batch budget exhausted without explicit pause → checkpoint.
            session.status = DiscussionStatus.PAUSED_CHECKPOINT.value
            session.pause_reason = "checkpoint"

        if session.status == DiscussionStatus.PAUSED_CHECKPOINT.value:
            session.checkpoint_ai_turns = 0
            session.segment_index = int(session.segment_index or 0) + 1

        session.pause_requested = False
        await release_lease(session)
        bump_version(session)
        final_status = session.status
        final_reason = session.pause_reason
        await db.commit()

        await publish_discussion_event(
            session_id=session.id,
            event_type=DiscussionEventType.PAUSE,
            payload={
                "session_id": str(session.id),
                "status": final_status,
                "pause_reason": final_reason,
                "version": session.version,
                "total_ai_turns": session.total_ai_turns,
                "segment_index": session.segment_index,
            },
        )
        await publish_discussion_event(
            session_id=session.id,
            event_type=DiscussionEventType.SEGMENT_DONE,
            payload={
                "session_id": str(session.id),
                "produced_ai_turns": produced,
                "status": final_status,
                "version": session.version,
            },
        )
        logger.info(
            "[STEP] discussion_batch_done session_id=%s produced=%s status=%s reason=%s",
            session_id,
            produced,
            final_status,
            final_reason,
        )
        _log_discussion_batch_metric(
            started_at=batch_t0,
            speakers=len(roster),
            produced=produced,
            status=final_status,
            reason=final_reason,
            preset_id=preset.id,
        )
        return {
            "ok": True,
            "session_id": str(session_id),
            "produced_ai_turns": produced,
            "status": final_status,
            "pause_reason": final_reason,
            "version": session.version,
        }
