# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Unit/contract tests for Wave 3b portal peers (keys, IP pool, additive conf, celery name).
# Related:
# - api/services/desktop_client/portal_wg_keys.py
# - api/services/desktop_client/portal_edge_sync.py
# ---

from __future__ import annotations

import pytest

from api.services.desktop_client.portal_edge_sync import assert_portal_iface
from api.services.desktop_client.portal_wg_keys import (
    PORTAL_DB_IP_FIRST,
    PORTAL_DB_IP_LAST,
    allocate_next_ip,
    build_client_conf,
    generate_wg_keypair,
    merge_conf_keep_foreign_peers,
    validate_slug,
)


def test_validate_slug_ok() -> None:
    assert validate_slug("desktop-client-pilot-2") == "desktop-client-pilot-2"


def test_validate_slug_bad() -> None:
    with pytest.raises(ValueError):
        validate_slug("Bad_Slug")


def test_allocate_ip_pool_bounds() -> None:
    used = set(range(PORTAL_DB_IP_FIRST, PORTAL_DB_IP_LAST))
    ip = allocate_next_ip(used)
    assert ip == f"10.88.89.{PORTAL_DB_IP_LAST}/32"
    with pytest.raises(RuntimeError, match="exhausted"):
        allocate_next_ip(set(range(PORTAL_DB_IP_FIRST, PORTAL_DB_IP_LAST + 1)))


def test_allocate_skips_manual_range() -> None:
    # .101–.149 never allocated by DB helper even if empty used set starts at 150
    ip = allocate_next_ip(set())
    assert ip == "10.88.89.150/32"
    assert int(ip.split(".")[-1].split("/")[0]) >= PORTAL_DB_IP_FIRST


def test_generate_wg_keypair_lengths() -> None:
    priv, pub = generate_wg_keypair()
    import base64

    assert len(base64.b64decode(priv)) == 32
    assert len(base64.b64decode(pub)) == 32


def test_build_client_conf_invariants() -> None:
    conf = build_client_conf(
        private_key="PRIV",
        assigned_ip="10.88.89.150/32",
        endpoint="93.77.165.185:51823",
        edge_public_key="EDGEPUB",
    )
    assert "AllowedIPs = 10.88.89.1/32" in conf
    assert "MTU = 1380" in conf
    assert "DNS = 10.88.89.1" in conf
    assert "Endpoint = 93.77.165.185:51823" in conf


def test_merge_conf_keeps_foreign_removes_managed() -> None:
    existing = """[Interface]
PrivateKey = SERVER
Address = 10.88.89.1/24
ListenPort = 51823

[Peer]
PublicKey = FOREIGNKEY111111111111111111111111111111111=
AllowedIPs = 10.88.89.103/32

[Peer]
PublicKey = DBKEYAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=
AllowedIPs = 10.88.89.150/32
"""
    merged = merge_conf_keep_foreign_peers(
        existing_conf=existing,
        active_peers=[("DBKEYBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB=", "10.88.89.151")],
        managed_public_keys={
            "DBKEYAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
            "DBKEYBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB=",
        },
    )
    assert "FOREIGNKEY111111111111111111111111111111111=" in merged
    assert "DBKEYAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=" not in merged
    assert "DBKEYBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB=" in merged
    assert "10.88.89.151/32" in merged


def test_merge_conf_full_iface_drops_foreign() -> None:
    existing = """[Interface]
PrivateKey = SERVER
Address = 10.88.89.1/24
ListenPort = 51823

[Peer]
PublicKey = FOREIGNKEY111111111111111111111111111111111=
AllowedIPs = 10.88.89.103/32

[Peer]
PublicKey = DBKEYAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=
AllowedIPs = 10.88.89.150/32
"""
    merged = merge_conf_keep_foreign_peers(
        existing_conf=existing,
        active_peers=[("DBKEYBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB=", "10.88.89.151")],
        managed_public_keys={
            "DBKEYAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
            "DBKEYBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB=",
        },
        keep_foreign_peers=False,
    )
    assert "FOREIGNKEY111111111111111111111111111111111=" not in merged
    assert "DBKEYAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=" not in merged
    assert "DBKEYBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB=" in merged
    assert "10.88.89.151/32" in merged


def test_portal_edge_sync_mode_normalizes(monkeypatch: pytest.MonkeyPatch) -> None:
    from api.core import unified_config as uc
    from api.services.desktop_client import portal_edge_sync as sync

    monkeypatch.setattr(uc.unified_settings, "desktop_client_portal_edge_sync_mode", "full_iface")
    assert sync.portal_edge_sync_mode() == "full_iface"
    monkeypatch.setattr(uc.unified_settings, "desktop_client_portal_edge_sync_mode", "ADDITIVE")
    assert sync.portal_edge_sync_mode() == "additive"


def test_assert_portal_iface_refuses_mobile() -> None:
    from api.services.desktop_client.portal_edge_sync import DesktopPortalEdgeSyncError

    with pytest.raises(DesktopPortalEdgeSyncError, match="refused_iface"):
        assert_portal_iface("wg-mobile")
    assert assert_portal_iface("wg-portal") == "wg-portal"


def test_celery_task_registered() -> None:
    import api.tasks.tasks as _tasks_registry  # noqa: F401
    from api.tasks.celery_app import celery_app

    assert _tasks_registry is not None
    assert "api.tasks.desktop_client_portal_edge_sync.sync_desktop_portal_wg_edge_peers" in celery_app.tasks


def test_load_manifest_peers_requires_array(tmp_path) -> None:
    from api.services.desktop_client.license_service import DesktopClientError
    from api.services.desktop_client.portal_manifest_import import load_manifest_peers

    bad = tmp_path / "bad.json"
    bad.write_text('{"peers": null}', encoding="utf-8")
    with pytest.raises(DesktopClientError, match="peers"):
        load_manifest_peers(bad)


def test_load_manifest_peers_ok(tmp_path) -> None:
    from api.services.desktop_client.portal_manifest_import import load_manifest_peers

    path = tmp_path / "peers.manifest.json"
    path.write_text(
        '{"peers":[{"slug":"fedora-operator-1","assigned_ip":"10.88.89.101","public_key":"ABC=","status":"active"}]}',
        encoding="utf-8",
    )
    peers = load_manifest_peers(path)
    assert len(peers) == 1
    assert peers[0]["slug"] == "fedora-operator-1"


def test_portal_beat_wiring_in_celery_app_source() -> None:
    from pathlib import Path

    from api.core.unified_config import unified_settings

    assert unified_settings.desktop_client_portal_edge_reconcile_interval_minutes >= 5
    celery_src = Path(__file__).resolve().parents[1] / "tasks" / "celery_app.py"
    text = celery_src.read_text(encoding="utf-8")
    assert "desktop-portal-wg-edge-peer-reconcile" in text
    assert "desktop_client_portal_edge_sync_enabled" in text
    assert "sync_desktop_portal_wg_edge_peers" in text
