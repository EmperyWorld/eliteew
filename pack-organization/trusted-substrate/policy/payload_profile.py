# Purpose: Exactly one active payload profile (electron | tauri).
# Related: ELITEEW-TRUSTED-SUBSTRATE.md §7 dual-flag; plan W0

"""Payload profile exclusivity lock."""

from __future__ import annotations

from enum import StrEnum


class PayloadProfile(StrEnum):
    ELECTRON = "electron"
    TAURI = "tauri"
    EMPIIEROS_SHELL = "empiieros-shell"


class PayloadProfileError(ValueError):
    """Raised when zero or more than one payload profile is active."""


def resolve_payload_profile(
    *,
    electron: bool = False,
    tauri: bool = False,
    empiieros_shell: bool = False,
) -> PayloadProfile:
    """Return the single active profile or raise PayloadProfileError."""
    active = [
        name
        for name, val in [
            ("electron", electron),
            ("tauri", tauri),
            ("empiieros-shell", empiieros_shell),
        ]
        if val
    ]
    if len(active) > 1:
        raise PayloadProfileError(
            f"dual_payload_profile: {' and '.join(active)} cannot both be active"
        )
    if empiieros_shell:
        return PayloadProfile.EMPIIEROS_SHELL
    if electron:
        return PayloadProfile.ELECTRON
    if tauri:
        return PayloadProfile.TAURI
    raise PayloadProfileError(
        "missing_payload_profile: set electron, tauri, or empiieros_shell"
    )
