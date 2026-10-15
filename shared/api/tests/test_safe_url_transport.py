"""Offline transport-boundary regressions, run against both independently shipped APIs."""

from __future__ import annotations

import ast
import asyncio
import importlib.util
import ipaddress
import socket
import ssl
import sys
from pathlib import Path
from unittest.mock import AsyncMock

import httpcore
import httpx
import pytest

from api.services import safe_url_transport as shared

ROOT = Path(__file__).resolve().parents[3]
spec = importlib.util.spec_from_file_location(
    "kbsew_safe_url_transport", ROOT / "KBSEW/api/services/safe_url_transport.py"
)
kbsew = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = kbsew
spec.loader.exec_module(kbsew)


@pytest.fixture(params=[shared, kbsew], ids=["shared", "kbsew"])
def transport(request, monkeypatch):
    # DNS is stubbed in these offline tests; avoid starting resolver worker threads
    # in the repository's dual pytest-asyncio/asyncio.run test harness.
    async def direct(func, *args, **kwargs):
        return func(*args, **kwargs)

    monkeypatch.setattr(asyncio, "to_thread", direct)
    return request.param


def test_transport_copies_are_identical():
    assert Path(shared.__file__).read_bytes() == Path(kbsew.__file__).read_bytes()
    ast.parse(Path(kbsew.__file__).read_text(), feature_version=(3, 12))


@pytest.mark.parametrize(
    "address",
    [
        "127.0.0.1",
        "::1",
        "10.0.0.1",
        "169.254.169.254",
        "100.64.0.1",
        "::ffff:127.0.0.1",
        "fc00::1",
        "64:ff9b::a00:1",
        "0.0.0.0",
    ],
)
def test_nonpublic_addresses_denied(transport, address):
    assert not transport.ip_allowed(ipaddress.ip_address(address))


def test_private_opt_in_is_narrow(transport):
    assert transport.ip_allowed(ipaddress.ip_address("10.1.2.3"), allow_private=True)
    assert transport.ip_allowed(ipaddress.ip_address("fc00::1"), allow_private=True)
    assert not transport.ip_allowed(ipaddress.ip_address("::ffff:127.0.0.1"), allow_private=True)
    assert not transport.ip_allowed(ipaddress.ip_address("169.254.169.254"), allow_private=True)
    assert not transport.ip_allowed(ipaddress.ip_address("100.64.0.1"), allow_private=True)


@pytest.mark.asyncio
async def test_mixed_dns_is_rejected(transport, monkeypatch):
    monkeypatch.setattr(
        socket,
        "getaddrinfo",
        lambda *a, **k: [
            (socket.AF_INET, socket.SOCK_STREAM, 6, "", ("93.184.216.34", 443)),
            (socket.AF_INET, socket.SOCK_STREAM, 6, "", ("127.0.0.1", 443)),
        ],
    )
    with pytest.raises(transport.UnsafeUrlError):
        await transport.resolve_destination("https://example.test")


@pytest.mark.asyncio
@pytest.mark.parametrize("fail_first", [False, True])
async def test_actual_connection_is_pinned_with_original_tls_and_host(transport, monkeypatch, fail_first):
    calls, tls, writes = [], [], []
    dns_calls = []

    def dns(*args, **kwargs):
        dns_calls.append(args)
        # A second resolution of this hostname would now be internal.
        ip = "93.184.216.34" if len(dns_calls) == 1 else "127.0.0.1"
        ips = [ip, "8.8.8.8"] if fail_first else [ip]
        return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", (address, 443)) for address in ips]

    monkeypatch.setattr(socket, "getaddrinfo", dns)

    class Stream:
        sent = False

        async def read(self, max_bytes, timeout=None):
            if self.sent:
                return b""
            self.sent = True
            return b"HTTP/1.1 200 OK\r\nContent-Length: 5\r\n\r\nhello"

        async def write(self, buffer, timeout=None):
            writes.append(buffer)

        async def aclose(self):
            pass

        async def start_tls(self, ssl_context, server_hostname=None, timeout=None):
            tls.append((server_hostname, ssl_context.verify_mode, ssl_context.check_hostname))
            return self

        def get_extra_info(self, info):
            return None

    class Backend:
        async def connect_tcp(self, host, port, **kwargs):
            calls.append((host, port))
            if fail_first and host == "93.184.216.34":
                raise httpcore.ConnectError("first address unavailable")
            return Stream()

    real_client = httpx.AsyncClient

    def client(**kwargs):
        assert kwargs["trust_env"] is False and kwargs["verify"] is True
        low = httpx.AsyncHTTPTransport()
        low._pool._network_backend = Backend()
        return real_client(transport=low, **kwargs)

    monkeypatch.setenv("HTTPS_PROXY", "http://127.0.0.1:9999")
    monkeypatch.setattr(httpx, "AsyncClient", client)
    result = await transport.fetch_url("https://example.test:8443/a", max_bytes=100, timeout_sec=2)
    assert result.body == b"hello"
    assert result.url == "https://example.test:8443/a"
    assert calls == ([("93.184.216.34", 8443), ("8.8.8.8", 8443)] if fail_first else [("93.184.216.34", 8443)])
    assert len(dns_calls) == 1
    assert tls == [("example.test", ssl.CERT_REQUIRED, True)]
    assert b"Host: example.test:8443" in b"".join(writes)


class Body(httpx.AsyncByteStream):
    def __init__(self, chunks, delay=0):
        self.chunks, self.delay, self.read_count, self.closed = chunks, delay, 0, False

    async def __aiter__(self):
        for chunk in self.chunks:
            if self.delay:
                await asyncio.sleep(self.delay)
            self.read_count += 1
            yield chunk

    async def aclose(self):
        self.closed = True


def use_responses(monkeypatch, handler):
    real_client = httpx.AsyncClient
    monkeypatch.setattr(httpx, "AsyncClient", lambda **kw: real_client(transport=httpx.MockTransport(handler), **kw))


@pytest.mark.asyncio
@pytest.mark.parametrize("truncate", [False, True])
async def test_stream_stops_at_cap(transport, monkeypatch, truncate):
    body = Body([b"a" * 16384] * 100)
    use_responses(monkeypatch, lambda req: httpx.Response(200, stream=body))
    if truncate:
        result = await transport.fetch_url("https://93.184.216.34", max_bytes=17000, timeout_sec=2, truncate=True)
        assert len(result.body) == 17000 and result.truncated
    else:
        with pytest.raises(transport.PayloadTooLargeError):
            await transport.fetch_url("https://93.184.216.34", max_bytes=17000, timeout_sec=2)
    assert body.read_count == 2
    assert body.closed


@pytest.mark.asyncio
async def test_compressed_response_rejected_without_reading(transport, monkeypatch):
    body = Body([b"compressed bomb"])
    use_responses(monkeypatch, lambda req: httpx.Response(200, headers={"Content-Encoding": "gzip"}, stream=body))
    with pytest.raises(transport.UnsafeUrlError):
        await transport.fetch_url("https://93.184.216.34", max_bytes=1000, timeout_sec=2)
    assert body.read_count == 0 and body.closed


@pytest.mark.asyncio
async def test_drip_feed_has_total_deadline(transport, monkeypatch):
    body = Body([b"x"] * 100, delay=0.02)
    use_responses(monkeypatch, lambda req: httpx.Response(200, stream=body))
    with pytest.raises(TimeoutError):
        await transport.fetch_url("https://93.184.216.34", max_bytes=1000, timeout_sec=0.06)
    assert body.read_count < 10 and body.closed


@pytest.mark.asyncio
async def test_redirect_revalidated_before_connection(transport, monkeypatch):
    seen = []

    def response(req):
        seen.append(req)
        return httpx.Response(302, headers={"location": "http://127.0.0.1/secret"}, stream=Body([]))

    use_responses(monkeypatch, response)
    with pytest.raises(transport.UnsafeUrlError):
        await transport.fetch_url("https://93.184.216.34", max_bytes=10, timeout_sec=2)
    assert len(seen) == 1


@pytest.mark.asyncio
async def test_relative_redirect_and_head(transport, monkeypatch):
    seen = []
    body = Body([b"never read HEAD body"])

    def response(req):
        seen.append(req)
        return (
            httpx.Response(302, headers={"location": "/final"}, stream=Body([]))
            if len(seen) == 1
            else httpx.Response(200, stream=body)
        )

    use_responses(monkeypatch, response)
    result = await transport.fetch_url("https://93.184.216.34/start", max_bytes=10, timeout_sec=2, method="HEAD")
    assert result.url == "https://93.184.216.34/final"
    assert all(req.method == "HEAD" for req in seen)
    assert body.read_count == 0


@pytest.mark.asyncio
async def test_allowlist_reapplied_to_redirect(transport, monkeypatch):
    use_responses(
        monkeypatch, lambda req: httpx.Response(302, headers={"location": "https://8.8.8.8/"}, stream=Body([]))
    )
    with pytest.raises(transport.UnsafeUrlError):
        await transport.fetch_url(
            "https://93.184.216.34",
            max_bytes=10,
            timeout_sec=2,
            url_allowed=lambda u: httpx.URL(u).host == "93.184.216.34",
        )


@pytest.mark.asyncio
async def test_tls_error_has_no_insecure_retry(transport, monkeypatch):
    calls = []

    def response(req):
        calls.append(req)
        raise httpx.ConnectError("certificate verify failed")

    use_responses(monkeypatch, response)
    with pytest.raises(httpx.ConnectError):
        await transport.fetch_url("https://93.184.216.34", max_bytes=10, timeout_sec=2)
    assert len(calls) == 1


@pytest.mark.asyncio
async def test_bi_url_cannot_reach_internal_tika_session(monkeypatch):
    from api.services.business_intelligence.tika_service import TikaService

    service = TikaService()
    extract = AsyncMock()
    monkeypatch.setattr(service, "extract_text_from_bytes", extract)
    result = await service.extract_text_from_url("http://169.254.169.254/latest/meta-data")
    assert result["success"] is False
    extract.assert_not_awaited()
    assert service.session is None


@pytest.mark.asyncio
async def test_bi_public_document_preserves_extraction_contract(monkeypatch):
    from api.services.business_intelligence.tika_service import TikaService

    service = TikaService()
    body = Body([b"%PDF-document"])
    use_responses(monkeypatch, lambda req: httpx.Response(200, stream=body))
    extract = AsyncMock(return_value={"success": True, "text": "document"})
    monkeypatch.setattr(service, "extract_text_from_bytes", extract)
    result = await service.extract_text_from_url("https://93.184.216.34/report.pdf?token=abc", extract_metadata=False)
    assert result["success"] is True
    extract.assert_awaited_once_with(b"%PDF-document", filename="report.pdf", extract_metadata=False)


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "url",
    [
        "file:///etc/passwd",
        "http://user:password@example.test/",
        "http://[fe80::1%25eth0]/",
        "http://127.1/",
        "http://2130706433/",
    ],
)
async def test_url_parser_aliases_cannot_bypass_address_checks(transport, monkeypatch, url):
    monkeypatch.setattr(
        socket, "getaddrinfo", lambda *a, **k: [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("127.0.0.1", 80))]
    )
    with pytest.raises(transport.UnsafeUrlError):
        await transport.fetch_url(url, max_bytes=100, timeout_sec=1)


@pytest.mark.asyncio
async def test_dns_is_inside_total_deadline(transport, monkeypatch):
    async def slow_resolve(*args, **kwargs):
        await asyncio.sleep(1)

    monkeypatch.setattr(asyncio, "to_thread", slow_resolve)
    with pytest.raises(TimeoutError):
        await transport.fetch_url("https://slow.test", max_bytes=10, timeout_sec=0.02)


@pytest.mark.asyncio
async def test_redirect_limit(transport, monkeypatch):
    count = []

    def response(req):
        count.append(req)
        return httpx.Response(302, headers={"location": "/again"}, stream=Body([]))

    use_responses(monkeypatch, response)
    with pytest.raises(transport.UnsafeUrlError):
        await transport.fetch_url("https://93.184.216.34", max_bytes=10, timeout_sec=2, max_redirects=2)
    assert len(count) == 3
