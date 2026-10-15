# Purpose: Honest network channel state for Trusted Substrate handoff (W2).
# Related: ELITEEW-TRUSTED-SUBSTRATE.md §7; plan W2

"""Evaluate offline vs tunnel state — never invent success."""

from __future__ import annotations

from enum import StrEnum


class NetworkChannelState(StrEnum):
    OFFLINE = "offline"
    PEER_MISSING = "peer_missing"
    DEGRADED = "degraded"
    TUNNEL_UP = "tunnel_up"


def evaluate_network_channel(
    *,
    peer_conf_present: bool,
    interface_up: bool,
    handshake_ok: bool,
) -> NetworkChannelState:
    """
    Precedence:
    - no peer file → peer_missing (still a form of offline for product)
    - peer present but iface down or no handshake → degraded
    - peer + iface + handshake → tunnel_up
    """
    if not peer_conf_present:
        return NetworkChannelState.PEER_MISSING
    if not interface_up or not handshake_ok:
        return NetworkChannelState.DEGRADED
    return NetworkChannelState.TUNNEL_UP


def is_fake_connected_forbidden(state: NetworkChannelState) -> bool:
    """Product must not claim connected unless tunnel_up."""
    return state is not NetworkChannelState.TUNNEL_UP
