# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Contract tests for desktop-client seat package builder (#014).
# Invariants:
# - Offline pack has no wg_conf; cloud pack includes peer conf when provided.
# Related:
# - api/services/desktop_client/seat_package.py
# ---

from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

import pytest

from api.middleware.oauth2_protection import build_public_path_strings
from api.services.desktop_client import DesktopClientError
from api.services.desktop_client.license_service import IssuedLicenseView
from api.services.desktop_client.portal_peer_service import (
    PortalPeerCreateResult,
    PortalPeerView,
)
from api.services.desktop_client.seat_package import (
    SEAT_KIND,
    build_seat_package,
    parse_seat_package_dict,
)


def _issued(*, edition: str = "client", profile_id: str | None = "client-offline-ai") -> IssuedLicenseView:
    return IssuedLicenseView(
        license_id=uuid4(),
        license_key="EE-TEST-AAAA-BBBB-CCCC",
        edition=edition,
        profile_id=profile_id,
        label="pilot",
        created_at=datetime.now(UTC),
    )


def test_build_offline_seat_package() -> None:
    pkg = build_seat_package(
        mode="offline",
        issued=_issued(),
        entitlement={"v": 1, "payload": {}, "sig": "x"},
        peer_result=None,
    )
    assert pkg["kind"] == SEAT_KIND
    assert pkg["mode"] == "offline"
    assert pkg["mode_label_ru"] == "Офлайн-режим"
    assert "туннел" not in (pkg.get("notes_ru") or "").lower()
    assert pkg["license_key"].startswith("EE-")
    assert pkg["entitlement"] is not None
    assert pkg["wg_conf"] is None
    assert pkg["peer"] is None
    assert "NotificationsApp" in pkg["apps"]


def test_build_cloud_seat_package_with_peer() -> None:
    peer = PortalPeerView(
        id=uuid4(),
        slug="seat-pilot",
        wg_public_key="pub",
        assigned_ip="10.88.89.150/32",
        status="active",
        label="pilot",
        license_id=uuid4(),
        edge_sync_status="pending",
        edge_synced_at=None,
        edge_sync_error=None,
        created_at=datetime.now(UTC),
    )
    result = PortalPeerCreateResult(
        peer=peer,
        private_key="PRIV",
        client_conf="[Interface]\nPrivateKey = PRIV\n",
        edge_sync_enqueued=True,
    )
    pkg = build_seat_package(
        mode="cloud",
        issued=_issued(edition="connected", profile_id=None),
        entitlement=None,
        peer_result=result,
    )
    assert pkg["mode"] == "cloud"
    assert pkg["mode_label_ru"] == "Облачный режим"
    assert pkg["wg_conf"] and "Interface" in pkg["wg_conf"]
    assert pkg["peer"]["slug"] == "seat-pilot"
    assert pkg["apps"] == []


def test_build_both_seat_package() -> None:
    peer = PortalPeerView(
        id=uuid4(),
        slug="seat-both",
        wg_public_key="pub",
        assigned_ip="10.88.89.151/32",
        status="active",
        label="both",
        license_id=uuid4(),
        edge_sync_status="pending",
        edge_synced_at=None,
        edge_sync_error=None,
        created_at=datetime.now(UTC),
    )
    result = PortalPeerCreateResult(
        peer=peer,
        private_key="PRIV",
        client_conf="[Interface]\nPrivateKey = PRIV\n",
        edge_sync_enqueued=True,
    )
    pkg = build_seat_package(
        mode="both",
        issued=_issued(),
        entitlement={"v": 1, "payload": {}, "sig": "x"},
        peer_result=result,
    )
    assert pkg["mode"] == "both"
    assert pkg["mode_label_ru"] == "Офлайн и облако"
    assert pkg["allow_offline"] is True
    assert pkg["allow_online"] is True
    assert pkg["entitlement"] is not None
    assert pkg["wg_conf"]
    assert "NotificationsApp" in pkg["apps"]


def test_parse_seat_package_rejects_bad_kind() -> None:
    with pytest.raises(DesktopClientError):
        parse_seat_package_dict({"v": 1, "kind": "nope", "mode": "offline"})


def test_parse_seat_package_ok() -> None:
    raw = build_seat_package(
        mode="offline",
        issued=_issued(),
        entitlement={"v": 1, "payload": {}, "sig": "x"},
        peer_result=None,
    )
    out = parse_seat_package_dict(raw)
    assert out["license_id"] == raw["license_id"]


def test_seats_issue_is_ops_jwt_skip() -> None:
    import re

    patterns = [re.compile(p) for p in build_public_path_strings()]
    assert any(p.match("/api/v1/desktop-client/seats/issue") for p in patterns)
    assert not any(p.match("/api/v1/desktop/admin/platform-ops/seats/issue") for p in patterns)


def test_seat_package_mints_entitlement_with_license_expires_at() -> None:
    """Cause lock: DB expires_at must flow into signed entitlement (not hard-coded None)."""
    from pathlib import Path

    src = Path(__file__).resolve().parents[1] / "services/desktop_client/seat_package.py"
    text = src.read_text(encoding="utf-8")
    assert "expires_at=issued.expires_at" in text
    assert "expires_at=expires_at," in text
    # Hard fail if mint regresses to perpetual local entitlement.
    assert "device_id=None,\n            expires_at=None," not in text
