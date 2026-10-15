# Purpose: Trusted Substrate policy package — pure contract locks (W0).
# Related: documentation/product/desktop/ELITEEW-TRUSTED-SUBSTRATE.md

"""Pure policy locks for EliteEW Trusted Substrate (no I/O side effects except scanners)."""

from .image_forbidden_globs import (
    FORBIDDEN_REL_GLOBS,
    scan_forbidden_paths,
)
from .network_handoff import (
    NetworkChannelState,
    evaluate_network_channel,
    is_fake_connected_forbidden,
)
from .payload_profile import (
    PayloadProfile,
    PayloadProfileError,
    resolve_payload_profile,
)
from .trust_labels import (
    TrustLabelError,
    validate_trust_labels,
)
from .update_channels import (
    UpdateChannel,
    update_channel_precedence,
)

__all__ = [
    "FORBIDDEN_REL_GLOBS",
    "NetworkChannelState",
    "PayloadProfile",
    "PayloadProfileError",
    "TrustLabelError",
    "UpdateChannel",
    "evaluate_network_channel",
    "is_fake_connected_forbidden",
    "resolve_payload_profile",
    "scan_forbidden_paths",
    "update_channel_precedence",
    "validate_trust_labels",
]
