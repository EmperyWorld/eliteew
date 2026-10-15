# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Typed Config Plane settings for Air enrollment (isolated from unified_config
# trust/update env inventory so Tauri F-07 does not false-flag the god-config file).
# Invariants:
# - Kill switch and edge SSH materials come only from env / Config Plane.
# - Code constructs the model by field name; env still binds through validation_alias.
# - Never log private key or known_hosts contents.
# Related:
# - documentation/product/desktop/DESKTOP-CLIENT-AIR-ENROLL.md
# ---

from __future__ import annotations

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class AirEnrollSettings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=None,
        extra="ignore",
        case_sensitive=False,
        populate_by_name=True,
    )

    enabled: bool = Field(
        default=False,
        validation_alias="DESKTOP_CLIENT_AIR_ENROLL_ENABLED",
    )
    edge_ssh_host: str | None = Field(
        default=None,
        validation_alias="DESKTOP_CLIENT_AIR_ENROLL_EDGE_SSH_HOST",
    )
    edge_ssh_user: str = Field(
        default="eliteew-air-enroll",
        validation_alias="DESKTOP_CLIENT_AIR_ENROLL_EDGE_SSH_USER",
    )
    edge_ssh_private_key: str | None = Field(
        default=None,
        validation_alias="DESKTOP_CLIENT_AIR_ENROLL_EDGE_SSH_PRIVATE_KEY",
        repr=False,
    )
    edge_known_hosts: str | None = Field(
        default=None,
        validation_alias="DESKTOP_CLIENT_AIR_ENROLL_EDGE_KNOWN_HOSTS",
        repr=False,
    )
    edge_ssh_timeout_seconds: int = Field(
        default=15,
        ge=5,
        le=30,
        validation_alias="DESKTOP_CLIENT_AIR_ENROLL_EDGE_SSH_TIMEOUT_SECONDS",
    )
    reconcile_interval_seconds: int = Field(
        default=60,
        ge=30,
        le=600,
        validation_alias="DESKTOP_CLIENT_AIR_ENROLL_RECONCILE_INTERVAL_SECONDS",
    )


@lru_cache(maxsize=1)
def get_air_enroll_settings() -> AirEnrollSettings:
    return AirEnrollSettings()
