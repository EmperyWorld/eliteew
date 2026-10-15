# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Unit tests for workflow OAuth Redis cache (declarative multi-step advance).
# ---

from __future__ import annotations

from unittest.mock import MagicMock, patch

from api.ewa_platform.companion.workflows.user.workflow_auth_cache import (
    load_workflow_auth_snapshot_sync,
    store_workflow_auth_snapshot_sync,
)


def test_workflow_auth_cache_roundtrip() -> None:
    stored: dict[str, str] = {}

    mock_cli = MagicMock()

    def _setex(key: str, ttl: int, value: str) -> None:
        stored[key] = value

    mock_cli.setex.side_effect = _setex
    mock_cli.get.side_effect = lambda key: stored.get(key)
    mock_cli.connection_pool.disconnect.return_value = None

    with patch(
        "api.ewa_platform.companion.workflows.user.workflow_auth_cache._redis_client",
        return_value=mock_cli,
    ):
        store_workflow_auth_snapshot_sync(
            "run-auth-1",
            bearer_token="token-abc",
            oauth_user_id="user-uuid",
            profile={"locale": "ru"},
        )
        snap = load_workflow_auth_snapshot_sync("run-auth-1")

    assert snap is not None
    assert snap.bearer_token == "token-abc"
    assert snap.oauth_user_id == "user-uuid"
    assert snap.profile == {"locale": "ru"}
