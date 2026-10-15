# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Lock: missing OpenSSH client in API runtime maps to typed AirEdgeError.
# Related:
# - api/services/desktop_client/air_enroll_edge.py
# - documentation/reference/solution-readiness/2026-09-10-air-enroll-api-ssh-client.md
# ---

from __future__ import annotations

import asyncio
from uuid import uuid4

import pytest

from api.services.desktop_client import air_enroll_edge as edge
from api.services.desktop_client.air_enroll_edge import AirEdgeError
from api.services.desktop_client.air_enroll_settings import AirEnrollSettings


@pytest.mark.asyncio
async def test_open_edge_lease_maps_missing_ssh_binary(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        edge,
        "get_air_enroll_settings",
        lambda: AirEnrollSettings(
            enabled=True,
            edge_ssh_host="10.77.77.1",
            edge_ssh_user="eliteew-air-enroll",
            edge_ssh_private_key="-----BEGIN OPENSSH PRIVATE KEY-----\ntest\n-----END OPENSSH PRIVATE KEY-----",
            edge_known_hosts="10.77.77.1 ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIFakeHostKeyMaterial000000000000000=",
        ),
    )

    async def _boom(*_args: object, **_kwargs: object) -> object:
        raise FileNotFoundError(2, "No such file or directory")

    monkeypatch.setattr(asyncio, "create_subprocess_exec", _boom)

    with pytest.raises(AirEdgeError) as caught:
        await edge.open_edge_lease(
            session_id=uuid4(),
            port=62201,
            expires_at=1_800_000_000,
        )
    assert caught.value.code == "edge_ssh_missing"
