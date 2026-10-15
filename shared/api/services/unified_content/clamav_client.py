#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Minimal stdlib ClamAV Unix-socket client for PING and INSTREAM.
# Invariants:
# - No shell execution or temporary upload files.
# - Protocol responses are bounded and fail closed at the client boundary.
# Related:
# - services/unified_content/security_validator.py
# - documentation/platform/engineering-bar/LICENSE-POLICY.md
# ---

from __future__ import annotations

import socket
import struct
from pathlib import Path

DEFAULT_CLAMD_SOCKET = Path("/var/run/clamav/clamd.ctl")
CLAMD_CHUNK_SIZE = 64 * 1024
CLAMD_RESPONSE_MAX_BYTES = 64 * 1024
CLAMD_SOCKET_TIMEOUT_SECONDS = 15.0


class ClamAvProtocolError(RuntimeError):
    """Raised when clamd returns a malformed or explicit error response."""


def _decode_response(raw: bytes) -> str:
    if not raw:
        raise ClamAvProtocolError("clamd returned an empty response")
    try:
        return raw.rstrip(b"\0\r\n").decode("utf-8")
    except UnicodeDecodeError as exc:
        raise ClamAvProtocolError("clamd returned a non-UTF-8 response") from exc


def parse_instream_response(raw: bytes) -> dict[str, tuple[str, str | None]]:
    """Parse clamd INSTREAM into the historical client result shape."""
    response = _decode_response(raw)
    prefix = "stream: "
    if not response.startswith(prefix):
        raise ClamAvProtocolError("clamd INSTREAM response has no stream prefix")
    result = response.removeprefix(prefix)
    if result == "OK":
        return {"stream": ("OK", None)}
    if result.endswith(" FOUND"):
        threat = result.removesuffix(" FOUND").strip()
        if not threat:
            raise ClamAvProtocolError("clamd FOUND response has no threat name")
        return {"stream": ("FOUND", threat)}
    if result.endswith(" ERROR"):
        detail = result.removesuffix(" ERROR").strip() or "unknown scan error"
        raise ClamAvProtocolError(f"clamd scan failed: {detail}")
    raise ClamAvProtocolError("clamd returned an unsupported INSTREAM response")


class ClamAvUnixClient:
    """Small ClamAV client limited to the commands used by EliteEW."""

    def __init__(
        self,
        socket_path: str | Path = DEFAULT_CLAMD_SOCKET,
        *,
        timeout_seconds: float = CLAMD_SOCKET_TIMEOUT_SECONDS,
    ) -> None:
        self.socket_path = Path(socket_path)
        self.timeout_seconds = timeout_seconds

    def _connect(self) -> socket.socket:
        client = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        client.settimeout(self.timeout_seconds)
        try:
            client.connect(str(self.socket_path))
        except OSError:
            client.close()
            raise
        return client

    @staticmethod
    def _receive_response(client: socket.socket) -> bytes:
        response = bytearray()
        while len(response) <= CLAMD_RESPONSE_MAX_BYTES:
            chunk = client.recv(min(4096, CLAMD_RESPONSE_MAX_BYTES + 1 - len(response)))
            if not chunk:
                break
            response.extend(chunk)
            if b"\0" in chunk:
                return bytes(response[: response.index(0) + 1])
        if len(response) > CLAMD_RESPONSE_MAX_BYTES:
            raise ClamAvProtocolError("clamd response exceeded the size limit")
        return bytes(response)

    def ping(self) -> str:
        with self._connect() as client:
            client.sendall(b"zPING\0")
            response = _decode_response(self._receive_response(client))
        if response != "PONG":
            raise ClamAvProtocolError("clamd did not acknowledge PING")
        return response

    def instream(self, file_data: bytes) -> dict[str, tuple[str, str | None]]:
        with self._connect() as client:
            client.sendall(b"zINSTREAM\0")
            view = memoryview(file_data)
            for offset in range(0, len(view), CLAMD_CHUNK_SIZE):
                chunk = view[offset : offset + CLAMD_CHUNK_SIZE]
                client.sendall(struct.pack(">I", len(chunk)))
                client.sendall(chunk)
            client.sendall(struct.pack(">I", 0))
            response = self._receive_response(client)
        return parse_instream_response(response)
