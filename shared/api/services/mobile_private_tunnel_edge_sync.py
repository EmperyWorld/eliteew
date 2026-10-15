#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Reconcile active mobile_trusted_devices WireGuard peers onto the Yandex edge wg-mobile interface
# and persist peer sections into /etc/wireguard/<iface>.conf so reboot survives runtime wg set.
# Invariants:
# - Never logs or transmits WireGuard private keys; only public keys and assigned /32 IPs.
# - No-op when edge SSH sync is not configured (dev/fallback keeps manual render+deploy).
# - Conf rewrite keeps existing [Interface] (PrivateKey/Address/ListenPort); SaveConfig=false.
# Related:
# - api.tasks.mobile_private_tunnel_edge_sync, mobile_trusted_device_service.py
# - documentation/product/mobile/MOBILE-SECURE-CONNECTION-OPERATIONS.md
# ---

from __future__ import annotations

import asyncio
import logging
import shlex
import tempfile
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from dataclasses import dataclass
from pathlib import Path

from api.core.database_manager import get_asyncpg_pool
from api.core.unified_config import unified_settings
from api.services.mobile_wg_edge_config import configured_mobile_wg_server_private_key

logger = logging.getLogger(__name__)


class MobilePrivateTunnelEdgeSyncError(RuntimeError):
    """Edge peer reconcile failed after DB read or remote wg apply."""


@dataclass(frozen=True)
class MobileWgPeerRow:
    public_key: str
    assigned_ip: str


@dataclass(frozen=True)
class MobilePrivateTunnelEdgeSyncResult:
    trigger: str
    configured: bool
    skipped: bool = False
    added_or_updated: int = 0
    removed: int = 0
    active_peer_count: int = 0
    conf_persisted: bool = False
    message: str | None = None


def edge_sync_enqueue_ready() -> bool:
    """True when API may schedule Celery edge reconcile.

    Does **not** require the edge SSH private key: that secret stays on the jobs
    slice. Bind/revoke/rotate run in the API process and only need the automation
    flag + SSH host from shared env.
    """
    if not unified_settings.mobile_private_tunnel_edge_sync_enabled:
        return False
    host = str(unified_settings.mobile_private_tunnel_edge_ssh_host or "").strip()
    return bool(host)


def edge_sync_configured() -> bool:
    """True when a worker can SSH to edge and apply wg-mobile peers."""
    if not edge_sync_enqueue_ready():
        return False
    key = str(unified_settings.mobile_private_tunnel_edge_ssh_private_key or "").strip()
    return bool(key)


async def fetch_active_wg_peers() -> list[MobileWgPeerRow]:
    pool = await get_asyncpg_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT wg_public_key, host(wg_assigned_ip) AS assigned_ip
            FROM public.mobile_trusted_devices
            WHERE status = 'active'
              AND wg_public_key IS NOT NULL
              AND btrim(wg_public_key) <> ''
              AND wg_assigned_ip IS NOT NULL
            ORDER BY created_at ASC
            """
        )
    peers: list[MobileWgPeerRow] = []
    for row in rows:
        public_key = str(row["wg_public_key"] or "").strip()
        assigned_ip = str(row["assigned_ip"] or "").strip()
        if not public_key or not assigned_ip:
            continue
        peers.append(MobileWgPeerRow(public_key=public_key, assigned_ip=assigned_ip))
    return peers


async def reconcile_active_peers_to_edge(*, trigger: str) -> MobilePrivateTunnelEdgeSyncResult:
    if not edge_sync_configured():
        logger.info("[STEP] mobile_wg_edge_sync_skip trigger=%s reason=not_configured", trigger)
        return MobilePrivateTunnelEdgeSyncResult(
            trigger=trigger,
            configured=False,
            skipped=True,
            message="edge_ssh_sync_not_configured",
        )

    desired = await fetch_active_wg_peers()
    iface = unified_settings.mobile_private_tunnel_interface.strip() or "wg-mobile"
    keepalive = unified_settings.mobile_private_tunnel_peer_keepalive_seconds

    async with _ssh_session() as ssh:
        await _reconcile_interface_private_key_if_configured(ssh, iface=iface)
        current = await _remote_wg_peer_keys(ssh, iface=iface)
        desired_keys = {peer.public_key for peer in desired}
        stale_keys = sorted(current - desired_keys)

        apply_lines: list[str] = []
        for peer in desired:
            apply_lines.append(
                f"wg set {iface} peer {peer.public_key} "
                f"allowed-ips {peer.assigned_ip}/32 persistent-keepalive {keepalive}"
            )
        for stale_key in stale_keys:
            apply_lines.append(f"wg set {iface} peer {stale_key} remove")

        if apply_lines:
            remote_script = "set -euo pipefail\n" + "\n".join(f"sudo {line}" for line in apply_lines)
            await _run_ssh(ssh, remote_script)
        else:
            logger.info(
                "[STEP] mobile_wg_edge_sync_noop trigger=%s active_peers=0 stale_on_edge=0",
                trigger,
            )

        await _run_ssh(ssh, build_persist_conf_remote_script(iface=iface, peers=desired, keepalive=keepalive))

        # Verify runtime peers before DB stamp — avoids false synced when a concurrent
        # bind lands after fetch, or wg set silently misses a peer.
        verified = await _remote_wg_peer_keys(ssh, iface=iface)
        missing = sorted(desired_keys - verified)
        if missing:
            raise MobilePrivateTunnelEdgeSyncError(
                f"edge_peers_missing_after_apply count={len(missing)} sample={missing[0][:16]}"
            )

    added_or_updated = len(desired)
    removed = len(stale_keys)
    await mark_active_devices_edge_synced(
        status="synced",
        public_keys=[peer.public_key for peer in desired],
    )
    logger.info(
        "[STEP] mobile_wg_edge_sync_ok trigger=%s active=%s updated=%s removed=%s conf_persisted=1",
        trigger,
        added_or_updated,
        added_or_updated,
        removed,
    )
    return MobilePrivateTunnelEdgeSyncResult(
        trigger=trigger,
        configured=True,
        added_or_updated=added_or_updated,
        removed=removed,
        active_peer_count=added_or_updated,
        conf_persisted=True,
        message="ok",
    )


def build_persist_conf_remote_script(
    *,
    iface: str,
    peers: list[MobileWgPeerRow],
    keepalive: int,
) -> str:
    """Build remote bash that rewrites Peer sections while keeping Interface PrivateKey."""
    conf_path = f"/etc/wireguard/{iface}.conf"
    peer_blocks: list[str] = []
    for peer in peers:
        peer_blocks.append(
            "\n".join(
                [
                    "[Peer]",
                    f"PublicKey = {peer.public_key}",
                    f"AllowedIPs = {peer.assigned_ip}/32",
                    f"PersistentKeepalive = {int(keepalive)}",
                    "",
                ]
            )
        )
    peers_blob = "".join(peer_blocks)
    # Embed peer text via base64-free quoted heredoc; keys are base64url-ish WireGuard pubkeys.
    return f"""set -euo pipefail
CONF={shlex.quote(conf_path)}
IFACE={shlex.quote(iface)}
if ! sudo test -f "$CONF"; then
  echo "missing_wg_conf:$CONF" >&2
  exit 2
fi
TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT
# Keep Interface block only (stop at first [Peer]).
sudo awk 'BEGIN{{p=1}} /^\\[Peer\\]/{{p=0}} p {{print}}' "$CONF" >"$TMP"
# Ensure SaveConfig = false remains intentional for controlled rewrites.
if ! grep -q '^SaveConfig' "$TMP"; then
  printf '\\nSaveConfig = false\\n' >>"$TMP"
fi
cat >>"$TMP" <<'ELITEEW_PEERS_EOF'
{peers_blob}ELITEEW_PEERS_EOF
sudo install -m 600 "$TMP" "$CONF"
# Best-effort syncconf so disk conf matches runtime without full wg-quick restart.
if command -v wg >/dev/null 2>&1 && command -v wg-quick >/dev/null 2>&1; then
  sudo wg syncconf "$IFACE" <(sudo wg-quick strip "$IFACE") 2>/dev/null || true
fi
"""


async def mark_active_devices_edge_synced(
    *,
    status: str,
    public_keys: list[str] | None = None,
) -> None:
    """Stamp devices whose peers were applied in this reconcile (not all active rows).

    Stamping every active row races with binds that land after fetch_active_wg_peers:
    a new device can get synced without ever being wg-set onto the edge.
    """
    keys = [k.strip() for k in (public_keys or []) if str(k).strip()]
    if not keys:
        return
    try:
        pool = await get_asyncpg_pool()
        async with pool.acquire() as conn:
            await conn.execute(
                """
                UPDATE public.mobile_trusted_devices
                SET wg_edge_sync_status = $1,
                    wg_edge_synced_at = CASE WHEN $1 = 'synced' THEN now() ELSE wg_edge_synced_at END,
                    updated_at = now()
                WHERE status = 'active'
                  AND wg_public_key = ANY($2::text[])
                  AND wg_assigned_ip IS NOT NULL
                """,
                status,
                keys,
            )
    except Exception:
        logger.debug(
            "[STEP] mobile_wg_edge_sync_db_stamp_skip status=%s keys=%s",
            status,
            len(keys),
            exc_info=True,
        )


async def mark_device_edge_sync_pending(*, device_id: str | None) -> None:
    if not device_id:
        return
    try:
        pool = await get_asyncpg_pool()
        async with pool.acquire() as conn:
            await conn.execute(
                """
                UPDATE public.mobile_trusted_devices
                SET wg_edge_sync_status = 'pending',
                    updated_at = now()
                WHERE id = $1::uuid AND status = 'active'
                """,
                device_id,
            )
    except Exception:
        logger.debug(
            "[STEP] mobile_wg_edge_sync_pending_stamp_skip device_id=%s",
            device_id,
            exc_info=True,
        )


@asynccontextmanager
async def _ssh_session() -> AsyncIterator[tuple[str, str, str, Path]]:
    host = str(unified_settings.mobile_private_tunnel_edge_ssh_host or "").strip()
    user = str(unified_settings.mobile_private_tunnel_edge_ssh_user or "eliteew-edge").strip()
    key_pem = str(unified_settings.mobile_private_tunnel_edge_ssh_private_key or "").strip()
    if not host or not key_pem:
        raise MobilePrivateTunnelEdgeSyncError("edge_ssh_sync_missing_host_or_key")

    with tempfile.TemporaryDirectory(prefix="eliteew-wg-edge-") as tmp_dir:
        key_path = Path(tmp_dir) / "edge_ed25519"
        key_path.write_text(key_pem if key_pem.endswith("\n") else f"{key_pem}\n", encoding="utf-8")
        key_path.chmod(0o600)
        target = f"{user}@{host}"
        yield host, user, target, key_path


async def _run_ssh(_session: tuple[str, str, str, Path], remote_script: str) -> None:
    _host, _user, target, key_path = _session
    timeout = unified_settings.mobile_private_tunnel_edge_ssh_timeout_seconds
    proc = await asyncio.create_subprocess_exec(
        "ssh",
        "-o",
        "BatchMode=yes",
        "-o",
        "StrictHostKeyChecking=accept-new",
        "-o",
        f"ConnectTimeout={timeout}",
        "-i",
        str(key_path),
        target,
        "bash",
        "-s",
        stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, stderr = await asyncio.wait_for(
        proc.communicate(remote_script.encode("utf-8")),
        timeout=timeout + 5,
    )
    if proc.returncode != 0:
        err_text = stderr.decode("utf-8", errors="replace").strip()
        out_text = stdout.decode("utf-8", errors="replace").strip()
        logger.warning(
            "[STEP] mobile_wg_edge_sync_ssh_failed rc=%s stderr=%s stdout=%s",
            proc.returncode,
            err_text[:500],
            out_text[:500],
        )
        raise MobilePrivateTunnelEdgeSyncError(
            f"edge_ssh_failed rc={proc.returncode}: {err_text or out_text or 'unknown'}"
        )


async def _remote_wg_server_public_key(session: tuple[str, str, str, Path], *, iface: str) -> str | None:
    _host, _user, target, key_path = session
    timeout = unified_settings.mobile_private_tunnel_edge_ssh_timeout_seconds
    proc = await asyncio.create_subprocess_exec(
        "ssh",
        "-o",
        "BatchMode=yes",
        "-o",
        "StrictHostKeyChecking=accept-new",
        "-o",
        f"ConnectTimeout={timeout}",
        "-i",
        str(key_path),
        target,
        f"sudo wg show {iface} public-key",
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=timeout + 5)
    if proc.returncode != 0:
        err_text = stderr.decode("utf-8", errors="replace").strip()
        logger.warning(
            "[STEP] mobile_wg_edge_sync_server_pubkey_read_failed iface=%s err=%s",
            iface,
            err_text[:200],
        )
        return None
    text = stdout.decode("utf-8", errors="replace").strip()
    return text or None


def _configured_mobile_wg_server_private_key() -> str:
    return configured_mobile_wg_server_private_key()


def build_restore_interface_private_key_remote_script(*, iface: str, private_key: str) -> str:
    conf_path = f"/etc/wireguard/{iface}.conf"
    return f"""set -euo pipefail
IFACE={shlex.quote(iface)}
CONF={shlex.quote(conf_path)}
PRIV_FILE="$(mktemp)"
trap 'rm -f "$PRIV_FILE"' EXIT
cat >"$PRIV_FILE" <<'ELITEEW_WG_PRIV_EOF'
{private_key}
ELITEEW_WG_PRIV_EOF
chmod 600 "$PRIV_FILE"
sudo wg set "$IFACE" private-key "$PRIV_FILE"
TMP="$(mktemp)"
trap 'rm -f "$TMP" "$PRIV_FILE"' EXIT
PRIV_LINE="$(tr -d '\\n' <"$PRIV_FILE")"
sudo awk -v priv="$PRIV_LINE" '/^PrivateKey = / {{ print "PrivateKey = " priv; next }} {{ print }}' "$CONF" >"$TMP"
sudo install -m 600 "$TMP" "$CONF"
"""


async def _reconcile_interface_private_key_if_configured(
    session: tuple[str, str, str, Path],
    *,
    iface: str,
) -> bool:
    server_priv = _configured_mobile_wg_server_private_key()
    expected_pub = str(unified_settings.mobile_trusted_device_wg_server_public_key or "").strip()
    if not server_priv:
        return False
    current_pub = await _remote_wg_server_public_key(session, iface=iface)
    if expected_pub and current_pub == expected_pub:
        return False
    logger.warning(
        "[STEP] mobile_wg_edge_sync_interface_restore iface=%s current_pub=%s expected_pub=%s",
        iface,
        (current_pub or "-")[:16],
        expected_pub[:16] if expected_pub else "-",
    )
    remote_script = build_restore_interface_private_key_remote_script(
        iface=iface,
        private_key=server_priv,
    )
    await _run_ssh(session, remote_script)
    verified_pub = await _remote_wg_server_public_key(session, iface=iface)
    if expected_pub and verified_pub != expected_pub:
        raise MobilePrivateTunnelEdgeSyncError(
            f"edge_interface_pubkey_mismatch_after_restore got={(verified_pub or '-')[:16]}"
        )
    return True


async def _remote_wg_peer_keys(session: tuple[str, str, str, Path], *, iface: str) -> set[str]:
    _host, _user, target, key_path = session
    timeout = unified_settings.mobile_private_tunnel_edge_ssh_timeout_seconds
    proc = await asyncio.create_subprocess_exec(
        "ssh",
        "-o",
        "BatchMode=yes",
        "-o",
        "StrictHostKeyChecking=accept-new",
        "-o",
        f"ConnectTimeout={timeout}",
        "-i",
        str(key_path),
        target,
        f"sudo wg show {iface} peers",
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=timeout + 5)
    if proc.returncode != 0:
        err_text = stderr.decode("utf-8", errors="replace").strip()
        if "does not exist" in err_text.lower() or "unable to access" in err_text.lower():
            logger.warning("[STEP] mobile_wg_edge_sync_iface_missing iface=%s", iface)
            return set()
        raise MobilePrivateTunnelEdgeSyncError(f"wg_show_failed: {err_text or proc.returncode}")
    text = stdout.decode("utf-8", errors="replace").strip()
    if not text:
        return set()
    return {line.strip() for line in text.splitlines() if line.strip()}


def schedule_mobile_wg_edge_reconcile(*, trigger: str, device_id: str | None = None) -> bool:
    """Enqueue Celery reconcile; returns False when sync is disabled or broker enqueue fails."""
    if not edge_sync_enqueue_ready():
        return False
    try:
        from api.tasks.mobile_private_tunnel_edge_sync import sync_mobile_wg_edge_peers

        sync_mobile_wg_edge_peers.apply_async(kwargs={"trigger": trigger, "device_id": device_id})
        logger.info(
            "[STEP] mobile_wg_edge_sync_enqueued trigger=%s device_id=%s",
            trigger,
            device_id or "-",
        )
        return True
    except Exception:
        logger.warning(
            "[STEP] mobile_wg_edge_sync_enqueue_failed trigger=%s device_id=%s",
            trigger,
            device_id or "-",
            exc_info=True,
        )
        return False


def edge_sync_audit_details(
    *,
    trigger: str,
    device_id: str | None = None,
    removal: bool = False,
    enqueue: bool = False,
) -> dict[str, object]:
    """Build audit fields for edge peer sync.

    Default ``enqueue=False``: only describe intent. Callers that run inside an open
    DB transaction MUST leave enqueue off, then call
    [finalize_edge_sync_after_commit] after commit. Enqueuing before commit races
    Celery past an unfinished bind/revoke — the new peer is invisible to
    ``fetch_active_wg_peers`` and the phone cannot handshake.
    """
    manual_action = (
        "docker/scripts/mobile-private-tunnel/render-db-peers.sh && docker/scripts/mobile-private-tunnel/deploy-edge.sh"
    )
    if not edge_sync_enqueue_ready():
        key = "edge_peer_removal_required" if removal else "edge_peer_deploy_required"
        return {
            key: True,
            "edge_peer_sync_mode": "manual_operator",
            "operator_action": manual_action,
        }
    if not enqueue:
        return {
            "edge_peer_sync_deferred": True,
            "edge_peer_sync_mode": "celery_ssh",
            "edge_peer_sync_trigger": trigger,
            "edge_peer_sync_device_id": device_id,
        }
    if schedule_mobile_wg_edge_reconcile(trigger=trigger, device_id=device_id):
        return {
            "edge_peer_sync_scheduled": True,
            "edge_peer_sync_mode": "celery_ssh",
        }
    key = "edge_peer_removal_required" if removal else "edge_peer_deploy_required"
    return {
        key: True,
        "edge_peer_sync_enqueue_failed": True,
        "edge_peer_sync_mode": "celery_ssh",
        "operator_action": manual_action,
    }


def finalize_edge_sync_after_commit(
    *,
    trigger: str,
    device_id: str | None = None,
    removal: bool = False,
    prior_details: dict[str, object] | None = None,
) -> dict[str, object]:
    """Enqueue Celery reconcile after the binding/revoke/rotate transaction commits.

    Merges into ``prior_details`` (from [edge_sync_audit_details]) so callers can
    update device ``wg_edge_sync_status`` honestly.
    """
    details: dict[str, object] = dict(prior_details or {})
    if not details.get("edge_peer_sync_deferred"):
        return details
    details.pop("edge_peer_sync_deferred", None)
    if schedule_mobile_wg_edge_reconcile(trigger=trigger, device_id=device_id):
        details["edge_peer_sync_scheduled"] = True
        details["edge_peer_sync_mode"] = "celery_ssh"
        return details
    key = "edge_peer_removal_required" if removal else "edge_peer_deploy_required"
    details[key] = True
    details["edge_peer_sync_enqueue_failed"] = True
    details["edge_peer_sync_mode"] = "celery_ssh"
    details["operator_action"] = (
        "docker/scripts/mobile-private-tunnel/render-db-peers.sh && docker/scripts/mobile-private-tunnel/deploy-edge.sh"
    )
    return details
