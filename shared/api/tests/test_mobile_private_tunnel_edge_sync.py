#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Behavioral tests for trusted-device WireGuard edge peer reconcile service.
# Invariants:
# - No real SSH, edge host, or production keys in tests.
# Related:
# - api.services.mobile_private_tunnel_edge_sync
# ---

from __future__ import annotations

import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from api.services import mobile_private_tunnel_edge_sync as edge_sync


@pytest.fixture(autouse=True)
def reset_edge_sync_settings(monkeypatch: pytest.MonkeyPatch) -> None:
    from api.services import mobile_wg_edge_config as wg_edge_config

    monkeypatch.delenv("MOBILE_PRIVATE_TUNNEL_SERVER_PRIVATE_KEY", raising=False)
    wg_edge_config.mobile_wg_edge_settings.cache_clear()
    monkeypatch.setattr(
        edge_sync.unified_settings,
        "mobile_trusted_device_wg_server_public_key",
        None,
        raising=False,
    )
    monkeypatch.setattr(
        edge_sync.unified_settings,
        "mobile_private_tunnel_edge_sync_enabled",
        False,
        raising=False,
    )
    monkeypatch.setattr(
        edge_sync.unified_settings,
        "mobile_private_tunnel_edge_ssh_host",
        None,
        raising=False,
    )
    monkeypatch.setattr(
        edge_sync.unified_settings,
        "mobile_private_tunnel_edge_ssh_private_key",
        None,
        raising=False,
    )


def test_edge_sync_configured_requires_enabled_host_and_key(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(edge_sync.unified_settings, "mobile_private_tunnel_edge_sync_enabled", True)
    monkeypatch.setattr(edge_sync.unified_settings, "mobile_private_tunnel_edge_ssh_host", "93.77.165.185")
    assert edge_sync.edge_sync_enqueue_ready() is True
    assert edge_sync.edge_sync_configured() is False
    monkeypatch.setattr(edge_sync.unified_settings, "mobile_private_tunnel_edge_ssh_private_key", "-----BEGIN KEY-----")
    assert edge_sync.edge_sync_configured() is True


def test_schedule_enqueue_ready_without_ssh_private_key(monkeypatch: pytest.MonkeyPatch) -> None:
    """API bind path: shared env has ENABLED+host; SSH PEM stays on jobs slice."""
    monkeypatch.setattr(edge_sync.unified_settings, "mobile_private_tunnel_edge_sync_enabled", True)
    monkeypatch.setattr(edge_sync.unified_settings, "mobile_private_tunnel_edge_ssh_host", "93.77.165.185")
    # private key intentionally unset (API container)

    class _FakeTask:
        def apply_async(self, *, kwargs: dict[str, object]) -> SimpleNamespace:
            assert kwargs["trigger"] == "device_bound"
            return SimpleNamespace(id="task-1")

    import api.tasks.mobile_private_tunnel_edge_sync as edge_task_module

    monkeypatch.setattr(edge_task_module, "sync_mobile_wg_edge_peers", _FakeTask())

    details = edge_sync.edge_sync_audit_details(trigger="device_bound", device_id="dev-1")
    assert details["edge_peer_sync_deferred"] is True
    assert details["edge_peer_sync_mode"] == "celery_ssh"
    assert edge_sync.schedule_mobile_wg_edge_reconcile(trigger="device_bound", device_id="dev-1") is True


@pytest.mark.anyio
async def test_reconcile_skips_when_not_configured() -> None:
    result = await edge_sync.reconcile_active_peers_to_edge(trigger="test_skip")
    assert result.skipped is True
    assert result.configured is False
    assert result.message == "edge_ssh_sync_not_configured"


@pytest.mark.anyio
async def test_reconcile_applies_desired_peers_and_removes_stale(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(edge_sync.unified_settings, "mobile_private_tunnel_edge_sync_enabled", True)
    monkeypatch.setattr(edge_sync.unified_settings, "mobile_private_tunnel_edge_ssh_host", "93.77.165.185")
    monkeypatch.setattr(
        edge_sync.unified_settings,
        "mobile_private_tunnel_edge_ssh_private_key",
        "invalid-test-private-key",
    )
    monkeypatch.setattr(edge_sync.unified_settings, "mobile_private_tunnel_edge_ssh_user", "eliteew-edge")
    monkeypatch.setattr(edge_sync.unified_settings, "mobile_private_tunnel_interface", "wg-mobile")
    monkeypatch.setattr(edge_sync.unified_settings, "mobile_private_tunnel_peer_keepalive_seconds", 25)

    async def _fake_fetch() -> list[edge_sync.MobileWgPeerRow]:
        return [
            edge_sync.MobileWgPeerRow(public_key="activePeerKeyBase64=", assigned_ip="10.88.88.109"),
        ]

    monkeypatch.setattr(edge_sync, "fetch_active_wg_peers", _fake_fetch)

    ssh_calls: list[tuple[str, ...]] = []

    async def _fake_create_subprocess_exec(*args: str, **kwargs: object) -> asyncio.subprocess.Process:
        ssh_calls.append(tuple(args))
        joined = " ".join(args)
        # First wg show = current peers; post-apply verify must include desired key.
        if "wg show" in joined:
            peer_out = (
                b"stalePeerKeyBase64=\n"
                if sum(1 for c in ssh_calls if "wg show" in " ".join(c)) == 1
                else b"activePeerKeyBase64=\n"
            )
            proc = AsyncMock()
            proc.returncode = 0
            proc.communicate = AsyncMock(return_value=(peer_out, b""))
            return proc
        proc = AsyncMock()
        proc.returncode = 0
        proc.communicate = AsyncMock(return_value=(b"", b""))
        return proc

    monkeypatch.setattr(asyncio, "create_subprocess_exec", _fake_create_subprocess_exec)
    stamped: list[list[str]] = []

    async def _fake_stamp(*, status: str, public_keys: list[str] | None = None) -> None:
        assert status == "synced"
        stamped.append(list(public_keys or []))

    monkeypatch.setattr(edge_sync, "mark_active_devices_edge_synced", _fake_stamp)

    result = await edge_sync.reconcile_active_peers_to_edge(trigger="test_apply")

    assert result.configured is True
    assert result.added_or_updated == 1
    assert result.removed == 1
    assert result.conf_persisted is True
    assert result.message == "ok"
    assert len(ssh_calls) == 4
    assert any("wg show" in " ".join(call) for call in ssh_calls)
    assert stamped == [["activePeerKeyBase64="]]


@pytest.mark.anyio
async def test_reconcile_raises_when_peer_missing_after_apply(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(edge_sync.unified_settings, "mobile_private_tunnel_edge_sync_enabled", True)
    monkeypatch.setattr(edge_sync.unified_settings, "mobile_private_tunnel_edge_ssh_host", "93.77.165.185")
    monkeypatch.setattr(
        edge_sync.unified_settings,
        "mobile_private_tunnel_edge_ssh_private_key",
        "invalid-test-private-key",
    )
    monkeypatch.setattr(edge_sync.unified_settings, "mobile_private_tunnel_edge_ssh_user", "eliteew-edge")
    monkeypatch.setattr(edge_sync.unified_settings, "mobile_private_tunnel_interface", "wg-mobile")
    monkeypatch.setattr(edge_sync.unified_settings, "mobile_private_tunnel_peer_keepalive_seconds", 25)

    async def _fake_fetch() -> list[edge_sync.MobileWgPeerRow]:
        return [edge_sync.MobileWgPeerRow(public_key="activePeerKeyBase64=", assigned_ip="10.88.88.109")]

    monkeypatch.setattr(edge_sync, "fetch_active_wg_peers", _fake_fetch)

    async def _fake_create_subprocess_exec(*args: str, **kwargs: object) -> asyncio.subprocess.Process:
        proc = AsyncMock()
        proc.returncode = 0
        # Both wg show calls return empty → post-apply verify fails.
        proc.communicate = AsyncMock(return_value=(b"", b""))
        return proc

    monkeypatch.setattr(asyncio, "create_subprocess_exec", _fake_create_subprocess_exec)
    stamp = AsyncMock()
    monkeypatch.setattr(edge_sync, "mark_active_devices_edge_synced", stamp)

    with pytest.raises(edge_sync.MobilePrivateTunnelEdgeSyncError, match="edge_peers_missing_after_apply"):
        await edge_sync.reconcile_active_peers_to_edge(trigger="test_verify_fail")
    stamp.assert_not_awaited()


def test_build_persist_conf_remote_script_keeps_interface_and_peers() -> None:
    script = edge_sync.build_persist_conf_remote_script(
        iface="wg-mobile",
        peers=[edge_sync.MobileWgPeerRow(public_key="peerPubKey=", assigned_ip="10.88.88.109")],
        keepalive=25,
    )
    assert "sudo test -f" in script
    assert "/etc/wireguard/wg-mobile.conf" in script
    assert "peerPubKey=" in script
    assert "AllowedIPs = 10.88.88.109/32" in script
    assert "PersistentKeepalive = 25" in script
    assert "wg syncconf" in script
    assert "[[ ! -f" not in script


def test_build_restore_interface_private_key_remote_script() -> None:
    script = edge_sync.build_restore_interface_private_key_remote_script(
        iface="wg-mobile",
        private_key="serverPrivKey=",
    )
    assert 'wg set "$IFACE" private-key' in script
    assert "serverPrivKey=" in script
    assert "PrivateKey =" in script
    assert "/etc/wireguard/wg-mobile.conf" in script


def test_edge_sync_audit_details_manual_when_not_configured() -> None:
    details = edge_sync.edge_sync_audit_details(trigger="device_bound", device_id="dev-1")
    assert details["edge_peer_deploy_required"] is True
    assert details["edge_peer_sync_mode"] == "manual_operator"


def test_edge_sync_audit_details_defers_enqueue_by_default(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(edge_sync.unified_settings, "mobile_private_tunnel_edge_sync_enabled", True)
    monkeypatch.setattr(edge_sync.unified_settings, "mobile_private_tunnel_edge_ssh_host", "93.77.165.185")
    # No SSH private key — API enqueue path must not require jobs-slice secrets.
    called: list[str] = []
    monkeypatch.setattr(
        edge_sync,
        "schedule_mobile_wg_edge_reconcile",
        lambda **_kwargs: called.append("scheduled") or True,
    )
    details = edge_sync.edge_sync_audit_details(trigger="device_bound", device_id="dev-1")
    assert details["edge_peer_sync_deferred"] is True
    assert called == []


def test_finalize_edge_sync_after_commit_enqueues(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(edge_sync.unified_settings, "mobile_private_tunnel_edge_sync_enabled", True)
    monkeypatch.setattr(edge_sync.unified_settings, "mobile_private_tunnel_edge_ssh_host", "93.77.165.185")
    monkeypatch.setattr(edge_sync, "schedule_mobile_wg_edge_reconcile", lambda **_kwargs: True)
    prior = edge_sync.edge_sync_audit_details(trigger="device_bound", device_id="dev-1")
    details = edge_sync.finalize_edge_sync_after_commit(
        trigger="device_bound",
        device_id="dev-1",
        prior_details=prior,
    )
    assert details["edge_peer_sync_scheduled"] is True
    assert "edge_peer_sync_deferred" not in details


def test_edge_sync_audit_details_enqueue_failed(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(edge_sync.unified_settings, "mobile_private_tunnel_edge_sync_enabled", True)
    monkeypatch.setattr(edge_sync.unified_settings, "mobile_private_tunnel_edge_ssh_host", "93.77.165.185")
    monkeypatch.setattr(edge_sync, "schedule_mobile_wg_edge_reconcile", lambda **_kwargs: False)
    details = edge_sync.edge_sync_audit_details(
        trigger="device_bound",
        device_id="dev-1",
        enqueue=True,
    )
    assert details["edge_peer_sync_enqueue_failed"] is True
    assert details["edge_peer_deploy_required"] is True


def test_schedule_enqueue_returns_false_when_not_configured() -> None:
    assert edge_sync.schedule_mobile_wg_edge_reconcile(trigger="device_bound", device_id="dev-1") is False


def test_schedule_enqueue_returns_true_when_configured(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(edge_sync.unified_settings, "mobile_private_tunnel_edge_sync_enabled", True)
    monkeypatch.setattr(edge_sync.unified_settings, "mobile_private_tunnel_edge_ssh_host", "93.77.165.185")

    class _FakeTask:
        def apply_async(self, *, kwargs: dict[str, object]) -> SimpleNamespace:
            assert kwargs["trigger"] == "device_bound"
            assert kwargs["device_id"] == "dev-1"
            return SimpleNamespace(id="task-1")

    import api.tasks.mobile_private_tunnel_edge_sync as edge_task_module

    monkeypatch.setattr(edge_task_module, "sync_mobile_wg_edge_peers", _FakeTask())

    assert edge_sync.schedule_mobile_wg_edge_reconcile(trigger="device_bound", device_id="dev-1") is True


def test_celery_worker_registers_mobile_wg_edge_sync_task() -> None:
    import api.tasks.tasks as _tasks_registry  # noqa: F401 — side-effect import registry
    from api.tasks.celery_app import celery_app

    assert _tasks_registry is not None
    assert "api.tasks.mobile_private_tunnel_edge_sync.sync_mobile_wg_edge_peers" in celery_app.tasks


def test_celery_worker_registers_video_call_watchdog_tasks() -> None:
    import api.tasks.tasks as _tasks_registry  # noqa: F401 — side-effect import registry
    from api.tasks.celery_app import celery_app

    assert _tasks_registry is not None
    assert "api.tasks.video_call_ringing_watchdog.video_call_delivery_watchdog" in celery_app.tasks
    assert "api.tasks.video_call_ringing_watchdog.video_call_answer_timeout" in celery_app.tasks
    assert "api.tasks.video_call_ringing_reconcile.reconcile_stale_ringing_video_calls" in celery_app.tasks
