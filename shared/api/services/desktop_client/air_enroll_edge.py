# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Bounded SSH client for the dedicated forced-command Air edge controller.
# ---

from __future__ import annotations

import asyncio
import json
import logging
import re
import tempfile
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from uuid import UUID

from api.services.desktop_client.air_enroll_settings import get_air_enroll_settings

logger = logging.getLogger(__name__)

_HOST_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.:-]{0,254}$")
_USER_RE = re.compile(r"^[a-z_][a-z0-9_-]{0,31}$")
_MAX_RESPONSE_BYTES = 16 * 1024


class AirEdgeError(RuntimeError):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


@dataclass(frozen=True)
class AirEdgeReady:
    session_id: UUID
    port: int
    expires_at: int
    rule_id: str


@dataclass(frozen=True)
class _SshSession:
    target: str
    key_path: Path
    known_hosts_path: Path
    timeout_seconds: int


def edge_configured() -> bool:
    settings = get_air_enroll_settings()
    return bool(
        settings.enabled
        and (settings.edge_ssh_host or "").strip()
        and (settings.edge_ssh_private_key or "").strip()
        and (settings.edge_known_hosts or "").strip()
    )


@asynccontextmanager
async def _ssh_session(*, allow_when_disabled: bool) -> AsyncIterator[_SshSession]:
    settings = get_air_enroll_settings()
    if not allow_when_disabled and not settings.enabled:
        raise AirEdgeError("air_disabled", "Air enrollment is disabled")
    host = (settings.edge_ssh_host or "").strip()
    user = (settings.edge_ssh_user or "eliteew-air-enroll").strip()
    private_key = (settings.edge_ssh_private_key or "").strip()
    known_hosts = (settings.edge_known_hosts or "").strip()
    timeout = settings.edge_ssh_timeout_seconds
    if not _HOST_RE.fullmatch(host) or not _USER_RE.fullmatch(user):
        raise AirEdgeError("edge_config_invalid", "Air edge SSH target is invalid")
    if not private_key or not known_hosts:
        raise AirEdgeError(
            "edge_config_missing",
            "Air edge SSH key or pinned known_hosts is missing",
        )
    with tempfile.TemporaryDirectory(prefix="eliteew-air-edge-") as temp_dir:
        directory = Path(temp_dir)
        key_path = directory / "edge-control"
        known_hosts_path = directory / "known_hosts"
        key_path.write_text(
            private_key if private_key.endswith("\n") else f"{private_key}\n",
            encoding="utf-8",
        )
        known_hosts_path.write_text(
            known_hosts if known_hosts.endswith("\n") else f"{known_hosts}\n",
            encoding="utf-8",
        )
        key_path.chmod(0o600)
        known_hosts_path.chmod(0o600)
        yield _SshSession(
            target=f"{user}@{host}",
            key_path=key_path,
            known_hosts_path=known_hosts_path,
            timeout_seconds=timeout,
        )


async def _run(
    command: list[str],
    *,
    allow_when_disabled: bool = False,
) -> dict[str, Any]:
    async with _ssh_session(allow_when_disabled=allow_when_disabled) as session:
        try:
            process = await asyncio.create_subprocess_exec(
                "ssh",
                "-o",
                "BatchMode=yes",
                "-o",
                "ClearAllForwardings=yes",
                "-o",
                "IdentitiesOnly=yes",
                "-o",
                "PermitLocalCommand=no",
                "-o",
                "StrictHostKeyChecking=yes",
                "-o",
                f"UserKnownHostsFile={session.known_hosts_path}",
                "-o",
                f"ConnectTimeout={session.timeout_seconds}",
                "-i",
                str(session.key_path),
                "--",
                session.target,
                *command,
                stdin=asyncio.subprocess.DEVNULL,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
        except FileNotFoundError as exc:
            logger.error("[STEP] air_edge_ssh_binary_missing")
            raise AirEdgeError(
                "edge_ssh_missing",
                "Air edge SSH client is not installed in the API runtime",
            ) from exc
        try:
            stdout, _stderr = await asyncio.wait_for(
                process.communicate(),
                timeout=session.timeout_seconds + 95,
            )
        except TimeoutError as exc:
            process.kill()
            await process.wait()
            raise AirEdgeError(
                "edge_timeout",
                "Air edge controller timed out",
            ) from exc
    if len(stdout) > _MAX_RESPONSE_BYTES:
        raise AirEdgeError(
            "edge_response_invalid",
            "Air edge controller response is too large",
        )
    try:
        payload = json.loads(stdout)
    except (json.JSONDecodeError, UnicodeDecodeError) as exc:
        raise AirEdgeError(
            "edge_response_invalid",
            "Air edge controller returned invalid JSON",
        ) from exc
    if not isinstance(payload, dict):
        raise AirEdgeError(
            "edge_response_invalid",
            "Air edge controller response must be an object",
        )
    if process.returncode != 0 or payload.get("status") == "error":
        code = payload.get("code")
        message = payload.get("message")
        safe_code = code if isinstance(code, str) else "edge_failed"
        safe_message = message if isinstance(message, str) else "Air edge controller rejected the operation"
        logger.warning("[STEP] air_edge_command_failed code=%s", safe_code)
        raise AirEdgeError(safe_code, safe_message[:300])
    return payload


async def preflight_edge() -> dict[str, Any]:
    return await _run(["preflight"])


async def open_edge_lease(
    *,
    session_id: UUID,
    port: int,
    expires_at: int,
) -> AirEdgeReady:
    payload = await _run(["open", str(session_id), str(port), str(expires_at)])
    if (
        payload.get("status") != "ready"
        or payload.get("session_id") != str(session_id)
        or payload.get("port") != port
        or payload.get("expires_at") != expires_at
        or not isinstance(payload.get("rule_id"), str)
    ):
        raise AirEdgeError(
            "edge_response_invalid",
            "Air edge open response failed exact read-back validation",
        )
    return AirEdgeReady(
        session_id=session_id,
        port=port,
        expires_at=expires_at,
        rule_id=payload["rule_id"],
    )


async def close_edge_lease(*, session_id: UUID) -> None:
    payload = await _run(
        ["close", str(session_id)],
        allow_when_disabled=True,
    )
    if payload.get("status") != "closed":
        raise AirEdgeError(
            "edge_response_invalid",
            "Air edge close response failed validation",
        )


async def reconcile_edge() -> dict[str, Any]:
    return await _run(["reconcile"], allow_when_disabled=True)
