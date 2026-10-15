"""Pinned HTTP(S) transport for untrusted URLs.

Also shipped in KBSEW/api/services/safe_url_transport.py because KBSEW's image
contains only its own API package. Keep the copies identical (parity test).
"""

from __future__ import annotations

import asyncio
import ipaddress
import socket
from collections.abc import Callable
from dataclasses import dataclass
from urllib.parse import urljoin

import httpx


class UnsafeUrlError(ValueError):
    """The destination or response cannot be fetched safely."""


class PayloadTooLargeError(ValueError):
    def __init__(self, size: int, limit: int):
        self.size, self.limit = size, limit
        super().__init__(f"Response exceeds byte limit ({size} > {limit})")


@dataclass(frozen=True)
class FetchResult:
    body: bytes
    headers: httpx.Headers
    url: str
    status_code: int
    truncated: bool = False


_PRIVATE_NETWORKS = tuple(
    ipaddress.ip_network(n)
    for n in (
        "10.0.0.0/8",
        "172.16.0.0/12",
        "192.168.0.0/16",
        "fc00::/7",
    )
)
_TRANSITION_NETWORKS = tuple(
    ipaddress.ip_network(n)
    for n in (
        "64:ff9b::/96",
        "64:ff9b:1::/48",
        "2002::/16",
        "2001::/32",
    )
)


def ip_allowed(ip: ipaddress.IPv4Address | ipaddress.IPv6Address, *, allow_private: bool = False) -> bool:
    if isinstance(ip, ipaddress.IPv6Address):
        if ip.ipv4_mapped:
            return ip_allowed(ip.ipv4_mapped, allow_private=allow_private)
        if any(ip in network for network in _TRANSITION_NETWORKS):
            return False
    if ip.is_loopback or ip.is_link_local or ip.is_multicast or ip.is_unspecified or ip.is_reserved:
        return False
    if ip.is_global:
        return True
    return allow_private and any(ip.version == network.version and ip in network for network in _PRIVATE_NETWORKS)


async def resolve_destination(url: str, *, allow_private: bool = False) -> tuple[httpx.URL, tuple[str, ...]]:
    raw = (url or "").strip()
    if not raw or any(ord(c) < 33 or ord(c) == 127 for c in raw):
        raise UnsafeUrlError("Empty URL or control characters")
    try:
        logical = httpx.URL(raw)
        host = logical.raw_host.decode("ascii")
        if logical.scheme not in ("http", "https") or not host or logical.userinfo or "%" in host:
            raise UnsafeUrlError("URL requires HTTP(S), a hostname and no userinfo/zone ID")
        if host.rstrip(".") in {
            "localhost",
            "metadata.google.internal",
            "metadata.goog",
            "kubernetes.default",
            "kubernetes.default.svc",
        } or host.rstrip(".").endswith((".localhost", ".local")):
            raise UnsafeUrlError("Blocked hostname")
        try:
            ips = [ipaddress.ip_address(host)]
        except ValueError:
            infos = await asyncio.to_thread(
                socket.getaddrinfo,
                host,
                logical.port or (443 if logical.scheme == "https" else 80),
                type=socket.SOCK_STREAM,
            )
            ips = [ipaddress.ip_address(info[4][0]) for info in infos]
        if not ips or any(not ip_allowed(ip, allow_private=allow_private) for ip in ips):
            raise UnsafeUrlError("Destination contains a blocked IP address")
        return logical.copy_with(fragment=None), tuple(dict.fromkeys(str(ip) for ip in ips))
    except (httpx.InvalidURL, OSError, ValueError) as exc:
        if isinstance(exc, UnsafeUrlError):
            raise
        raise UnsafeUrlError("Invalid URL or DNS result") from exc


async def _request_pinned(
    logical: httpx.URL,
    ip: str,
    *,
    method: str,
    timeout_sec: float,
    max_bytes: int,
    truncate: bool,
    connect_timeout: float,
) -> FetchResult:
    headers = {
        "Host": logical.netloc.decode("ascii"),
        "Accept-Encoding": "identity",
        "User-Agent": "EliteEW-SafeFetch/1.0",
    }
    # A fresh client per attempt prevents cross-host reuse on a shared IP.
    async with (
        httpx.AsyncClient(
            verify=True,
            trust_env=False,
            follow_redirects=False,
            timeout=httpx.Timeout(timeout_sec, connect=connect_timeout),
        ) as client,
        client.stream(
            method,
            logical.copy_with(host=ip),
            headers=headers,
            extensions={"sni_hostname": logical.raw_host.decode("ascii")},
        ) as response,
    ):
        if response.status_code in (301, 302, 303, 307, 308):
            return FetchResult(b"", response.headers, str(logical), response.status_code)
        response.raise_for_status()
        if method == "HEAD":
            return FetchResult(b"", response.headers, str(logical), response.status_code)
        if response.headers.get("content-encoding", "identity").strip().lower() not in ("", "identity"):
            raise UnsafeUrlError("Compressed HTTP response refused; identity encoding required")
        try:
            declared = int(response.headers.get("content-length", "0"))
        except ValueError:
            declared = 0
        if not truncate and declared > max_bytes:
            raise PayloadTooLargeError(declared, max_bytes)
        body = bytearray()
        async for chunk in response.aiter_raw(chunk_size=16_384):
            remaining = max_bytes - len(body)
            if len(chunk) > remaining:
                if not truncate:
                    raise PayloadTooLargeError(len(body) + len(chunk), max_bytes)
                body.extend(chunk[:remaining])
                return FetchResult(bytes(body), response.headers, str(logical), response.status_code, True)
            body.extend(chunk)
        return FetchResult(bytes(body), response.headers, str(logical), response.status_code)


async def fetch_url(
    url: str,
    *,
    max_bytes: int,
    timeout_sec: float,
    max_redirects: int = 5,
    allow_private: bool = False,
    truncate: bool = False,
    method: str = "GET",
    url_allowed: Callable[[str], bool] | None = None,
) -> FetchResult:
    """Resolve once per hop; connect only to addresses in that validated snapshot.

    Request identity encoding and reject compressed HTTP representations before
    reading, rather than allocate attacker-controlled decompression output.
    """
    if max_bytes < 1 or timeout_sec <= 0 or method not in {"GET", "HEAD"}:
        raise ValueError("Invalid fetch limits/method")
    current = url
    async with asyncio.timeout(timeout_sec):
        for hop in range(max_redirects + 1):
            logical, addresses = await resolve_destination(current, allow_private=allow_private)
            if url_allowed is not None and not url_allowed(str(logical)):
                raise UnsafeUrlError("Host denied by allowlist/denylist")
            for index, ip in enumerate(addresses):
                try:
                    result = await _request_pinned(
                        logical,
                        ip,
                        method=method,
                        timeout_sec=timeout_sec,
                        max_bytes=max_bytes,
                        truncate=truncate,
                        connect_timeout=min(10.0, timeout_sec / len(addresses)),
                    )
                    break
                except (httpx.ConnectError, httpx.ConnectTimeout):  # fmt: skip
                    if index == len(addresses) - 1:
                        raise
            if result.status_code in (301, 302, 303, 307, 308):
                location = result.headers.get("location")
                if not location or hop == max_redirects:
                    raise UnsafeUrlError("Missing redirect Location or too many redirects")
                current = urljoin(str(logical), location)
                continue
            return result
    raise UnsafeUrlError("Too many redirects")
