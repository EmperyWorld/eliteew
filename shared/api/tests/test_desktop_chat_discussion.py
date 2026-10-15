# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Behavioral locks for Discussion pause policy, next-actor planner, and batch metric.
# Invariants:
# - Checkpoint pauses at exactly preset.checkpoint_interval AI turns in the segment.
# - `[METRIC] discussion_batch` line shape mirrors council budget (W3).
# Related:
# - api/services/desktop_chat_ensemble/discussion/
# ---
from __future__ import annotations

from api.services.desktop_chat_ensemble.discussion.contracts import (
    DiscussionPauseReason,
    DiscussionRelation,
    DiscussionStatus,
)
from api.services.desktop_chat_ensemble.discussion.pause_policy import (
    batch_ai_turn_budget,
    evaluate_pause_after_ai_turn,
)
from api.services.desktop_chat_ensemble.discussion.planner import plan_next_ai_turn
from api.services.desktop_chat_ensemble.discussion.presets import require_preset


def test_checkpoint_pause_at_exactly_five() -> None:
    preset = require_preset("brainstorm")
    assert preset.checkpoint_interval == 5
    mid = evaluate_pause_after_ai_turn(
        preset=preset,
        checkpoint_ai_turns=4,
        total_ai_turns=4,
        pause_requested=False,
        goal_reached=False,
    )
    assert mid.should_pause is False
    done = evaluate_pause_after_ai_turn(
        preset=preset,
        checkpoint_ai_turns=5,
        total_ai_turns=5,
        pause_requested=False,
        goal_reached=False,
    )
    assert done.should_pause is True
    assert done.status == DiscussionStatus.PAUSED_CHECKPOINT
    assert done.reason == DiscussionPauseReason.CHECKPOINT


def test_raise_hand_wins_over_checkpoint() -> None:
    preset = require_preset("brainstorm")
    decision = evaluate_pause_after_ai_turn(
        preset=preset,
        checkpoint_ai_turns=5,
        total_ai_turns=5,
        pause_requested=True,
        goal_reached=False,
    )
    assert decision.status == DiscussionStatus.PAUSED_USER
    assert decision.reason == DiscussionPauseReason.RAISE_HAND


def test_discussion_speech_token_budget_doubled() -> None:
    from api.services.desktop_chat_ensemble.discussion.speech import (
        DISCUSSION_SPEECH_MAX_TOKENS_CAP,
        DISCUSSION_SPEECH_MAX_TOKENS_DEFAULT,
    )

    assert DISCUSSION_SPEECH_MAX_TOKENS_DEFAULT == 2048
    assert DISCUSSION_SPEECH_MAX_TOKENS_CAP == 4096


def test_stream_field_accepts_str_and_bytes_redis_keys() -> None:
    from api.services.desktop_chat_ensemble.discussion.events import _stream_field

    assert _stream_field({"type": "council_turn", "payload": "{}"}, "type") == "council_turn"
    assert _stream_field({b"type": b"council_turn", b"payload": b"{}"}, "type") == b"council_turn"
    assert _stream_field({"payload": '{"a":1}'}, "type") is None
    assert _stream_field(None, "type") is None


def test_format_participant_speaker_label() -> None:
    from api.services.desktop_chat_ensemble.discussion.contracts import (
        DEFAULT_PARTICIPANT_ROLE_TITLE,
        format_participant_speaker_label,
    )

    assert format_participant_speaker_label(display_name="Иван", role_title="CTO") == "Иван (CTO)"
    assert (
        format_participant_speaker_label(display_name="  ", role_title="")
        == f"Участник ({DEFAULT_PARTICIPANT_ROLE_TITLE})"
    )
    assert (
        format_participant_speaker_label(display_name="Anna", role_title="  ")
        == f"Anna ({DEFAULT_PARTICIPANT_ROLE_TITLE})"
    )


def test_discussion_batch_metric_line_mirrors_council_budget() -> None:
    from api.services.desktop_chat_ensemble.discussion.engine import (
        format_discussion_batch_metric,
    )

    line = format_discussion_batch_metric(
        speakers=3,
        produced=5,
        duration_ms=12000,
        status="paused_checkpoint",
        reason="checkpoint",
        preset_id="brainstorm",
    )
    assert line.startswith("[METRIC] discussion_batch ")
    assert "speakers=3" in line
    assert "produced=5" in line
    assert "duration_ms=12000" in line
    assert "parallel=0" in line
    assert "status=paused_checkpoint" in line
    assert "reason=checkpoint" in line
    assert "preset=brainstorm" in line
    empty = format_discussion_batch_metric(
        speakers=0,
        produced=0,
        duration_ms=1,
        status=None,
        reason="",
        preset_id=None,
    )
    assert "status=-" in empty
    assert "reason=-" in empty
    assert "preset=-" in empty


def test_batch_budget_remaining() -> None:
    preset = require_preset("product_review")
    assert batch_ai_turn_budget(preset=preset, checkpoint_ai_turns=0) == 5
    assert batch_ai_turn_budget(preset=preset, checkpoint_ai_turns=3) == 2
    assert batch_ai_turn_budget(preset=preset, checkpoint_ai_turns=5) == 0


def test_planner_respects_roster_and_monopoly_cap() -> None:
    preset = require_preset("brainstorm")
    roster = ["likiy_sorrento", "arlyqueen", "viktor_engineer"]
    first = plan_next_ai_turn(
        preset=preset,
        roster=roster,
        prior_ai_hero_ids=[],
        topic="Запуск B2B оффера",
        goal="Выбрать сегмент",
        last_user_text=None,
    )
    assert first is not None
    assert first.hero_id in roster
    assert first.relation == DiscussionRelation.OPENING

    mono = plan_next_ai_turn(
        preset=preset,
        roster=roster,
        prior_ai_hero_ids=["likiy_sorrento", "likiy_sorrento"],
        topic="Запуск",
        goal="Сегмент",
        last_user_text="Не согласен с сегментом SMB",
        last_relation=DiscussionRelation.CHALLENGE,
    )
    assert mono is not None
    assert mono.hero_id != "likiy_sorrento"
    assert mono.relation == DiscussionRelation.REBUTTAL


def test_preset_registry_complete() -> None:
    from api.services.desktop_chat_ensemble.discussion.presets import list_presets

    ids = [p.id for p in list_presets()]
    assert ids == [
        "brainstorm",
        "product_review",
        "marketing_strategy",
        "responsibility_assignment",
        "interview",
        "decision",
        "negotiation",
    ]
    for preset_id in ids:
        assert require_preset(preset_id).id == preset_id


def test_interview_after_user_asks_followup_not_rebuttal() -> None:
    preset = require_preset("interview")
    assert DiscussionRelation.REBUTTAL not in preset.allowed_relations
    plan = plan_next_ai_turn(
        preset=preset,
        roster=["likiy_sorrento", "max_safin"],
        prior_ai_hero_ids=["likiy_sorrento"],
        topic="Найм руководителя продукта",
        goal="Понять опыт запусков",
        last_user_text="Я запускал два продукта в B2B.",
        last_relation=DiscussionRelation.OPENING,
    )
    assert plan is not None
    assert plan.relation == DiscussionRelation.CHALLENGE


def test_brainstorm_after_user_still_rebuts() -> None:
    preset = require_preset("brainstorm")
    plan = plan_next_ai_turn(
        preset=preset,
        roster=["likiy_sorrento", "max_safin"],
        prior_ai_hero_ids=["likiy_sorrento"],
        topic="Идеи канала",
        goal="",
        last_user_text="Давайте только Telegram.",
        last_relation=DiscussionRelation.OPENING,
    )
    assert plan is not None
    assert plan.relation == DiscussionRelation.REBUTTAL


def test_interview_speech_hint_asks_the_participant() -> None:
    from api.services.desktop_chat_ensemble.discussion.speech import relation_speech_hint

    preset = require_preset("interview")
    hint = relation_speech_hint(
        DiscussionRelation.OPENING.value,
        overlay=dict(preset.relation_hints),
    )
    assert "вопрос" in hint.lower()
    default_hint = relation_speech_hint(DiscussionRelation.OPENING.value)
    assert "тезис" in default_hint.lower()
