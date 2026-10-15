# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# wg-portal edge sync for desktop_client_portal_peers (Wave 3b / full_iface opt-in).
# Invariants:
# - Default mode additive: upsert DB actives + remove DB revoked; keep foreign peers.
# - Mode full_iface: edge live peers and conf must equal DB actives only (parity gate first).
# - Interface hard-locked to wg-portal / 10.88.89.0/24 / UDP 51823.
# Related:
# - documentation/product/desktop/DESKTOP-TAURI-CONNECTED-CLIENT.md
# ---

from __future__ import annotations

import asyncio
import base64
import logging
import shlex
import tempfile
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from dataclasses import dataclass
from pathlib import Path

from api.core.database_manager import get_asyncpg_pool
from api.core.unified_config import unified_settings
from api.services.desktop_client.portal_wg_keys import (
    PORTAL_IFACE,
    PORTAL_LISTEN_PORT,
    merge_conf_keep_foreign_peers,
)

logger = logging.getLogger(__name__)


class DesktopPortalEdgeSyncError(RuntimeError):
    """Portal edge additive sync failed."""


@dataclass(frozen=True)
class PortalPeerRow:
    public_key: str
    assigned_ip: str
    status: str


@dataclass(frozen=True)
class DesktopPortalEdgeSyncResult:
    trigger: str
    configured: bool
    skipped: bool = False
    mode: str = "additive"
    added_or_updated: int = 0
    removed: int = 0
    active_peer_count: int = 0
    conf_persisted: bool = False
    message: str | None = None


def portal_edge_sync_mode() -> str:
    """Return normalized sync mode: additive | full_iface."""
    raw = str(unified_settings.desktop_client_portal_edge_sync_mode or "additive").strip().lower()
    if raw in {"full_iface", "full-iface", "full"}:
        return "full_iface"
    return "additive"


def assert_portal_iface(iface: str) -> str:
    name = (iface or "").strip()
    if name != PORTAL_IFACE:
        raise DesktopPortalEdgeSyncError(f"refused_iface:{name}")
    return name


def edge_sync_configured() -> bool:
    if not unified_settings.desktop_client_portal_edge_sync_enabled:
        return False
    host = str(unified_settings.desktop_client_portal_edge_ssh_host or "").strip()
    key = str(unified_settings.desktop_client_portal_edge_ssh_private_key or "").strip()
    return bool(host and key)


async def fetch_portal_peer_rows() -> list[PortalPeerRow]:
    pool = await get_asyncpg_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT wg_public_key, host(assigned_ip) AS assigned_ip, status
            FROM public.desktop_client_portal_peers
            WHERE wg_public_key IS NOT NULL
              AND btrim(wg_public_key) <> ''
              AND assigned_ip IS NOT NULL
            ORDER BY created_at ASC
            """
        )
    out: list[PortalPeerRow] = []
    for row in rows:
        out.append(
            PortalPeerRow(
                public_key=str(row["wg_public_key"]).strip(),
                assigned_ip=str(row["assigned_ip"]).strip(),
                status=str(row["status"]).strip(),
            )
        )
    return out


async def reconcile_portal_peers_to_edge(*, trigger: str) -> DesktopPortalEdgeSyncResult:
    if not edge_sync_configured():
        logger.info("[STEP] desktop_portal_edge_sync_skip trigger=%s reason=not_configured", trigger)
        return DesktopPortalEdgeSyncResult(
            trigger=trigger,
            configured=False,
            skipped=True,
            mode=portal_edge_sync_mode(),
            message="edge_ssh_sync_not_configured",
        )

    iface = assert_portal_iface(PORTAL_IFACE)
    mode = portal_edge_sync_mode()
    rows = await fetch_portal_peer_rows()
    active = [r for r in rows if r.status == "active"]
    revoked = [r for r in rows if r.status == "revoked"]
    managed_keys = {r.public_key for r in rows}
    desired_keys = {p.public_key for p in active}
    keepalive = int(unified_settings.desktop_client_portal_peer_keepalive_seconds)

    async with _ssh_session() as ssh:
        current = await _remote_wg_peer_keys(ssh, iface=iface)
        apply_lines: list[str] = []
        for peer in active:
            apply_lines.append(
                f"wg set {iface} peer {peer.public_key} "
                f"allowed-ips {peer.assigned_ip}/32 persistent-keepalive {keepalive}"
            )
        if mode == "full_iface":
            remove_keys = sorted(current - desired_keys)
        else:
            remove_keys = sorted({r.public_key for r in revoked} & current)
        for key in remove_keys:
            apply_lines.append(f"wg set {iface} peer {key} remove")

        if apply_lines:
            remote_script = "set -euo pipefail\n" + "\n".join(f"sudo {line}" for line in apply_lines)
            await _run_ssh(ssh, remote_script)

        existing = await _remote_read_conf(ssh, iface=iface)
        merged = merge_conf_keep_foreign_peers(
            existing_conf=existing,
            active_peers=[(p.public_key, p.assigned_ip) for p in active],
            managed_public_keys=managed_keys,
            keepalive=keepalive,
            keep_foreign_peers=(mode != "full_iface"),
        )
        await _remote_write_conf(ssh, iface=iface, conf_text=merged)

        verified = await _remote_wg_peer_keys(ssh, iface=iface)
        missing = sorted(desired_keys - verified)
        if missing:
            raise DesktopPortalEdgeSyncError(
                f"edge_peers_missing_after_apply count={len(missing)} sample={missing[0][:16]}"
            )
        leftover_revoked = sorted({r.public_key for r in revoked} & verified)
        if leftover_revoked:
            raise DesktopPortalEdgeSyncError(f"edge_revoked_still_present count={len(leftover_revoked)}")
        if mode == "full_iface":
            foreign_left = sorted(verified - desired_keys)
            if foreign_left:
                raise DesktopPortalEdgeSyncError(
                    f"edge_foreign_still_present count={len(foreign_left)} sample={foreign_left[0][:16]}"
                )

    await stamp_peers_synced(active_public_keys=[p.public_key for p in active])
    logger.info(
        "[STEP] desktop_portal_edge_sync_ok trigger=%s mode=%s active=%s removed=%s",
        trigger,
        mode,
        len(active),
        len(remove_keys),
    )
    return DesktopPortalEdgeSyncResult(
        trigger=trigger,
        configured=True,
        mode=mode,
        added_or_updated=len(active),
        removed=len(remove_keys),
        active_peer_count=len(active),
        conf_persisted=True,
        message="ok",
    )


async def stamp_peers_synced(*, active_public_keys: list[str]) -> None:
    keys = [k for k in active_public_keys if k]
    if not keys:
        return
    try:
        pool = await get_asyncpg_pool()
        async with pool.acquire() as conn:
            await conn.execute(
                """
                UPDATE public.desktop_client_portal_peers
                SET edge_sync_status = 'synced',
                    edge_synced_at = now(),
                    edge_sync_error = NULL,
                    updated_at = now()
                WHERE status = 'active'
                  AND wg_public_key = ANY($1::text[])
                """,
                keys,
            )
    except Exception:
        logger.debug(
            "[STEP] desktop_portal_edge_sync_stamp_skip keys=%s",
            len(keys),
            exc_info=True,
        )


async def stamp_peer_status(
    *,
    peer_id: str,
    status: str,
    error: str | None = None,
) -> None:
    try:
        pool = await get_asyncpg_pool()
        async with pool.acquire() as conn:
            await conn.execute(
                """
                UPDATE public.desktop_client_portal_peers
                SET edge_sync_status = $2,
                    edge_sync_error = $3,
                    edge_synced_at = CASE WHEN $2 = 'synced' THEN now() ELSE edge_synced_at END,
                    updated_at = now()
                WHERE id = $1::uuid
                """,
                peer_id,
                status,
                error,
            )
    except Exception:
        logger.debug(
            "[STEP] desktop_portal_edge_sync_peer_stamp_skip peer_id=%s",
            peer_id,
            exc_info=True,
        )


def schedule_desktop_portal_edge_reconcile(*, trigger: str) -> bool:
    if not edge_sync_configured():
        return False
    try:
        from api.tasks.desktop_client_portal_edge_sync import sync_desktop_portal_wg_edge_peers

        sync_desktop_portal_wg_edge_peers.apply_async(kwargs={"trigger": trigger})
        logger.info("[STEP] desktop_portal_edge_sync_enqueued trigger=%s", trigger)
        return True
    except Exception:
        logger.warning(
            "[STEP] desktop_portal_edge_sync_enqueue_failed trigger=%s",
            trigger,
            exc_info=True,
        )
        return False


@asynccontextmanager
async def _ssh_session() -> AsyncIterator[tuple[str, str, str, Path]]:
    host = str(unified_settings.desktop_client_portal_edge_ssh_host or "").strip()
    user = str(unified_settings.desktop_client_portal_edge_ssh_user or "eliteew-edge").strip()
    key_pem = str(unified_settings.desktop_client_portal_edge_ssh_private_key or "").strip()
    if not host or not key_pem:
        raise DesktopPortalEdgeSyncError("edge_ssh_sync_missing_host_or_key")
    with tempfile.TemporaryDirectory(prefix="eliteew-portal-wg-") as tmp_dir:
        key_path = Path(tmp_dir) / "edge_ed25519"
        key_path.write_text(key_pem if key_pem.endswith("\n") else f"{key_pem}\n", encoding="utf-8")
        key_path.chmod(0o600)
        yield host, user, f"{user}@{host}", key_path


async def _run_ssh(session: tuple[str, str, str, Path], remote_script: str) -> bytes:
    _host, _user, target, key_path = session
    timeout = unified_settings.desktop_client_portal_edge_ssh_timeout_seconds
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
        raise DesktopPortalEdgeSyncError(f"edge_ssh_failed rc={proc.returncode}: {err_text or out_text or 'unknown'}")
    return stdout


async def _remote_wg_peer_keys(session: tuple[str, str, str, Path], *, iface: str) -> set[str]:
    assert_portal_iface(iface)
    if iface != PORTAL_IFACE:
        raise DesktopPortalEdgeSyncError("refused_iface")
    _ = PORTAL_LISTEN_PORT  # documented lock
    script = f"sudo wg show {shlex.quote(iface)} peers"
    out = await _run_ssh(session, script)
    text = out.decode("utf-8", errors="replace").strip()
    if not text:
        return set()
    return {line.strip() for line in text.splitlines() if line.strip()}


async def _remote_read_conf(session: tuple[str, str, str, Path], *, iface: str) -> str:
    conf = f"/etc/wireguard/{iface}.conf"
    out = await _run_ssh(session, f"sudo cat {shlex.quote(conf)}")
    return out.decode("utf-8", errors="replace")


async def _remote_write_conf(session: tuple[str, str, str, Path], *, iface: str, conf_text: str) -> None:
    conf = f"/etc/wireguard/{iface}.conf"
    b64 = base64.b64encode(conf_text.encode("utf-8")).decode("ascii")
    script = f"""set -euo pipefail
TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT
echo {shlex.quote(b64)} | base64 -d >"$TMP"
sudo install -m 600 "$TMP" {shlex.quote(conf)}
if command -v wg >/dev/null 2>&1 && command -v wg-quick >/dev/null 2>&1; then
  sudo wg syncconf {shlex.quote(iface)} <(sudo wg-quick strip {shlex.quote(iface)}) 2>/dev/null || true
fi
"""
    await _run_ssh(session, script)
