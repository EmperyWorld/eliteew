# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Lock Capsule v2 activation proof transcript shape.
# Related:
# - api/routers/desktop_client/activation.py
# ---

from __future__ import annotations

from api.routers.desktop_client.activation import activation_proof_message


def test_activation_proof_message_shape() -> None:
    msg = activation_proof_message(
        request_id="dr1_abc",
        token_sha256="aa" * 32,
        nonce="bb" * 8,
    )
    assert msg.startswith(b"activate_v1|dr1_abc|")
    assert b"|" + ("aa" * 32).encode() + b"|" in msg


def test_consume_update_sql_uses_returning_guard() -> None:
    """Lock concurrent-safe consume: UPDATE … RETURNING, not fire-and-forget execute."""
    from pathlib import Path

    src = Path("services/desktop_client/enrollment_service.py").read_text(encoding="utf-8")
    assert "RETURNING license_id" in src
    assert "activation_consumed_at IS NULL" in src
    assert "fetchrow" in src
    assert "activation_replay" in src


def test_enrollment_issue_uses_advisory_lock_and_mark_status_guard() -> None:
    """Lock concurrent sealed issue: advisory lock + mark_issued rejects UPDATE 0."""
    from pathlib import Path

    enrollment = Path("services/desktop_client/enrollment_service.py").read_text(encoding="utf-8")
    seat = Path("services/desktop_client/seat_package.py").read_text(encoding="utf-8")
    assert "pg_advisory_lock" in enrollment
    assert "issue_serialization_lock" in enrollment
    assert 'endswith(" 0")' in enrollment
    assert "device_request_conflict" in enrollment
    assert "issue_serialization_lock" in seat
