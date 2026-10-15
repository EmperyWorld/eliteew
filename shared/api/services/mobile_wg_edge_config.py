#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Jobs-only WireGuard edge secrets for mobile private tunnel Celery reconcile.
# Invariants:
# - MOBILE_PRIVATE_TUNNEL_SERVER_PRIVATE_KEY is classified to stack0 jobs slice only.
# - API containers must not depend on this module for request-path handlers.
# Related:
# - api.services.mobile_private_tunnel_edge_sync, docker/scripts/stack0-env-materialize-roles.sh
# ---

from __future__ import annotations

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class MobileWgEdgeSettings(BaseSettings):
    """Edge interface secrets for Celery SSH reconcile (not mounted on stack0 API)."""

    model_config = SettingsConfigDict(extra="ignore")

    mobile_private_tunnel_server_private_key: str | None = Field(
        default=None,
        validation_alias="MOBILE_PRIVATE_TUNNEL_SERVER_PRIVATE_KEY",
    )


@lru_cache(maxsize=1)
def mobile_wg_edge_settings() -> MobileWgEdgeSettings:
    return MobileWgEdgeSettings()


def configured_mobile_wg_server_private_key() -> str:
    return str(mobile_wg_edge_settings().mobile_private_tunnel_server_private_key or "").strip()
