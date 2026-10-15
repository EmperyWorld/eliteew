# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# WireGuard keypair + client handoff conf for desktop-client portal peers (Wave 3b).
# Invariants:
# - Private key returned once to ops; never stored in DB.
# - AllowedIPs / MTU / DNS match PORTAL-PRIVATE-TUNNEL-EDGE canon.
# Related:
# - documentation/platform/docker-re_doc/PORTAL-PRIVATE-TUNNEL-EDGE.md
# ---

from __future__ import annotations

import base64
import re

from cryptography.hazmat.primitives.asymmetric.x25519 import X25519PrivateKey

# DB allocator pool (portalctl / manual stays in .101–.149).
PORTAL_DB_IP_FIRST = 150
PORTAL_DB_IP_LAST = 254
PORTAL_SUBNET_PREFIX = "10.88.89"
PORTAL_IFACE = "wg-portal"
PORTAL_LISTEN_PORT = 51823
PORTAL_EDGE_TUNNEL_IP = "10.88.89.1"
PORTAL_CLIENT_MTU = 1380
PORTAL_KEEPALIVE = 25

_SLUG_RE = re.compile(r"^[a-z0-9]([a-z0-9-]{0,62}[a-z0-9])?$")


def validate_slug(slug: str) -> str:
    s = (slug or "").strip().lower()
    if not _SLUG_RE.match(s):
        raise ValueError("invalid_slug")
    return s


def generate_wg_keypair() -> tuple[str, str]:
    """Return (private_key_b64, public_key_b64) WireGuard Curve25519 keys."""
    private = X25519PrivateKey.generate()
    priv_raw = private.private_bytes_raw()
    pub_raw = private.public_key().public_bytes_raw()
    return (
        base64.b64encode(priv_raw).decode("ascii"),
        base64.b64encode(pub_raw).decode("ascii"),
    )


def allocate_next_ip(used_host_octets: set[int]) -> str:
    for host in range(PORTAL_DB_IP_FIRST, PORTAL_DB_IP_LAST + 1):
        if host not in used_host_octets:
            return f"{PORTAL_SUBNET_PREFIX}.{host}/32"
    raise RuntimeError("portal_peer_ip_exhausted")


def build_client_conf(
    *,
    private_key: str,
    assigned_ip: str,
    endpoint: str,
    dns: str = PORTAL_EDGE_TUNNEL_IP,
    mtu: int = PORTAL_CLIENT_MTU,
    keepalive: int = PORTAL_KEEPALIVE,
    edge_public_key: str,
) -> str:
    """Client-side wg-quick conf (PrivateKey once). AllowedIPs = edge /32 only."""
    addr = assigned_ip if "/" in assigned_ip else f"{assigned_ip}/32"
    ep = endpoint.strip()
    return (
        "[Interface]\n"
        f"PrivateKey = {private_key.strip()}\n"
        f"Address = {addr}\n"
        f"DNS = {dns}\n"
        f"MTU = {mtu}\n"
        "\n"
        "[Peer]\n"
        f"PublicKey = {edge_public_key.strip()}\n"
        f"Endpoint = {ep}\n"
        f"AllowedIPs = {PORTAL_EDGE_TUNNEL_IP}/32\n"
        f"PersistentKeepalive = {keepalive}\n"
    )


def merge_conf_keep_foreign_peers(
    *,
    existing_conf: str,
    active_peers: list[tuple[str, str]],
    managed_public_keys: set[str],
    keepalive: int = PORTAL_KEEPALIVE,
    keep_foreign_peers: bool = True,
) -> str:
    """Rewrite managed actives into edge conf.

    Default (**additive**): keep [Interface] + non-managed [Peer] blocks.
    ``keep_foreign_peers=False`` (**full_iface**): drop every existing [Peer]; conf = Interface + DB actives only.

    active_peers: list of (public_key, assigned_ip_host_or_cidr)
    managed_public_keys: all DB-known pubkeys (active + revoked) — drop from old conf when keeping foreign.
    """
    lines = existing_conf.splitlines()
    interface: list[str] = []
    foreign_peers: list[list[str]] = []
    current_peer: list[str] | None = None
    in_interface = False

    def flush_peer(block: list[str]) -> None:
        if not keep_foreign_peers:
            return
        pubkey = ""
        for line in block:
            if line.strip().lower().startswith("publickey"):
                pubkey = line.split("=", 1)[-1].strip()
                break
        if pubkey and pubkey in managed_public_keys:
            return
        if block:
            foreign_peers.append(block)

    for line in lines:
        stripped = line.strip()
        if stripped.startswith("[") and stripped.lower() == "[interface]":
            if current_peer is not None:
                flush_peer(current_peer)
                current_peer = None
            in_interface = True
            interface = ["[Interface]"]
            continue
        if stripped.startswith("[") and stripped.lower() == "[peer]":
            if current_peer is not None:
                flush_peer(current_peer)
            elif in_interface:
                in_interface = False
            current_peer = ["[Peer]"]
            continue
        if current_peer is not None:
            current_peer.append(line)
        elif in_interface:
            interface.append(line)

    if current_peer is not None:
        flush_peer(current_peer)

    out: list[str] = []
    if interface:
        out.extend(interface)
        if out and out[-1].strip() != "":
            out.append("")
    else:
        out.extend(["[Interface]", "SaveConfig = false", ""])

    if not any(line.strip().lower().startswith("saveconfig") for line in interface):
        while out and out[-1] == "":
            out.pop()
        if interface:
            out.append("SaveConfig = false")
            out.append("")

    for block in foreign_peers:
        out.extend(block)
        if out and out[-1].strip() != "":
            out.append("")

    for pubkey, ip in active_peers:
        host = ip.split("/")[0].strip()
        out.extend(
            [
                "[Peer]",
                f"PublicKey = {pubkey}",
                f"AllowedIPs = {host}/32",
                f"PersistentKeepalive = {int(keepalive)}",
                "",
            ]
        )
    return "\n".join(out).rstrip() + "\n"
