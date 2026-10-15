#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose: Tests for jobs-only mobile WG edge secret settings.
# Related: api.services.mobile_wg_edge_config
# ---

from __future__ import annotations

from api.services import mobile_wg_edge_config as wg_edge_config


def test_configured_mobile_wg_server_private_key_reads_env(monkeypatch) -> None:
    wg_edge_config.mobile_wg_edge_settings.cache_clear()
    monkeypatch.setenv("MOBILE_PRIVATE_TUNNEL_SERVER_PRIVATE_KEY", "testServerPrivKey=")
    assert wg_edge_config.configured_mobile_wg_server_private_key() == "testServerPrivKey="


def test_configured_mobile_wg_server_private_key_empty_when_unset(monkeypatch) -> None:
    wg_edge_config.mobile_wg_edge_settings.cache_clear()
    monkeypatch.delenv("MOBILE_PRIVATE_TUNNEL_SERVER_PRIVATE_KEY", raising=False)
    assert wg_edge_config.configured_mobile_wg_server_private_key() == ""
