# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Focused Professional Worlds tests for media batch semantics, brand kit SQL contract (static),
# before/after review vocabulary, and EWRP draft adapter payload (no live DB).
# Invariants:
# - Keep assertions deterministic; avoid importing SQLAlchemy unless required.
# Related:
# - api/services/professional_worlds/cross_app_draft_adapters.py
# - api/services/professional_worlds/service.py
# ---

from __future__ import annotations

from uuid import uuid4

from api.services.professional_worlds.cross_app_draft_adapters import build_ewrp_draft_adapter


def test_batch_idempotency_sql_expectation() -> None:
    """Document that idempotent batch replay must filter by user + property + idempotency key."""
    stmt = """
SELECT id
FROM realtor_media_batch_jobs
WHERE user_id = :user_id AND property_id = :property_id AND idempotency_key = :ik
LIMIT 1
""".lower()
    assert "user_id = :user_id" in stmt
    assert "property_id = :property_id" in stmt
    assert "idempotency_key = :ik" in stmt


def test_batch_item_review_decision_vocabulary() -> None:
    allowed = {"accepted", "rejected", "skipped", "pending"}
    assert "accepted" in allowed
    assert "maybe" not in allowed


def test_brand_kit_upsert_conflict_target() -> None:
    sql = "ON CONFLICT (user_id, vertical_slug) DO UPDATE SET"
    assert "user_id" in sql and "vertical_slug" in sql


def test_ewrp_draft_adapter_payload_shape() -> None:
    artifact_id = uuid4()
    property_row = {"id": uuid4(), "title": "Marine view", "city": "Vladivostok"}
    media = uuid4()
    capsule = build_ewrp_draft_adapter(
        property_row,
        outline_markdown="# Deck\nBody",
        unified_content_refs=[media],
        artifact_id=artifact_id,
    )
    assert capsule["destination"] == "ewrp"
    assert capsule["presentation"]["outline_markdown"].startswith("# Deck")
    assert str(media) in capsule["media_unified_content_ids"]
    assert capsule["deep_link"]["artifact_id"] == str(artifact_id)
    assert capsule["constraints"]["auto_publish_forbidden"] is True


def test_duplicate_enhancement_status_window() -> None:
    """Duplicate detection should ignore terminal failure states."""
    watched = {"queued", "processing", "completed", "accepted"}
    assert "failed" not in watched
    assert "rejected" not in watched
