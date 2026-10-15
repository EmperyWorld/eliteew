# Purpose: Trust label vocabulary + profile consistency (os_trust / payload_trust).
# Related: ELITEEW-TRUSTED-SUBSTRATE.md §8.2; plan W0/W1 honesty labels

"""Trust label enums and consistency with payload profile."""

from __future__ import annotations

from enum import StrEnum

from .payload_profile import PayloadProfile


class OsTrust(StrEnum):
    """How trustworthy the OS build claim is."""

    PILOT = "pilot"  # W1 carrier — not yet from-source Done
    FROM_SOURCE = "from-source"  # W4+ factory with EliteEW toolchain


class PayloadTrust(StrEnum):
    """How trustworthy the product payload / web engine claim is."""

    BOOTSTRAP_ELECTRON = "bootstrap-electron"
    TAURI_LIVING = "tauri-living"
    ENGINE_FROM_SOURCE = "engine-from-source"
    ELITEEW_RUNTIME = "eliteew-runtime"


class TrustLabelError(ValueError):
    """Invalid label or profile/label mismatch."""


_PROFILE_ALLOWED_PAYLOAD_TRUST: dict[PayloadProfile, frozenset[PayloadTrust]] = {
    PayloadProfile.ELECTRON: frozenset({PayloadTrust.BOOTSTRAP_ELECTRON}),
    PayloadProfile.TAURI: frozenset(
        {PayloadTrust.TAURI_LIVING, PayloadTrust.ENGINE_FROM_SOURCE}
    ),
    PayloadProfile.EMPIIEROS_SHELL: frozenset(
        {PayloadTrust.ELITEEW_RUNTIME, PayloadTrust.ENGINE_FROM_SOURCE}
    ),
}


def validate_trust_labels(
    *,
    os_trust: str,
    payload_trust: str,
    profile: PayloadProfile,
) -> tuple[OsTrust, PayloadTrust]:
    """Parse and validate labels; enforce profile ↔ payload_trust consistency."""
    try:
        os_v = OsTrust(os_trust)
    except ValueError as exc:
        raise TrustLabelError(f"invalid_os_trust: {os_trust!r}") from exc
    try:
        pay_v = PayloadTrust(payload_trust)
    except ValueError as exc:
        raise TrustLabelError(f"invalid_payload_trust: {payload_trust!r}") from exc

    allowed = _PROFILE_ALLOWED_PAYLOAD_TRUST[profile]
    if pay_v not in allowed:
        raise TrustLabelError(
            f"profile_label_mismatch: profile={profile.value} "
            f"payload_trust={pay_v.value} allowed={[x.value for x in sorted(allowed)]}"
        )
    return os_v, pay_v
