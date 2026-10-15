"""Policy tests for desktop_fetch_url host blocking (SSRF mitigation).

Loads ``fetch_url.py`` directly so ``tools/__init__.py`` (SQLAlchemy) is not imported.
"""

from __future__ import annotations

import importlib.util
import pathlib
from unittest.mock import AsyncMock

import httpx
import pytest


def _load_fetch_url():
    here = pathlib.Path(__file__).resolve()
    path = here.parents[1] / "services" / "desktop_chat" / "tools" / "fetch_url.py"
    spec = importlib.util.spec_from_file_location("desktop_fetch_url_under_test", path)
    assert spec and spec.loader
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


_mod = _load_fetch_url()
_host_allowed = _mod._host_allowed
_hostname_is_ssrf_blocked = _mod._hostname_is_ssrf_blocked


def test_ssrf_blocks_loopback_literal() -> None:
    assert _hostname_is_ssrf_blocked("127.0.0.1") is True
    assert _hostname_is_ssrf_blocked("::1") is True


def test_ssrf_blocks_private_ipv4_literal() -> None:
    assert _hostname_is_ssrf_blocked("192.168.0.1") is True
    assert _hostname_is_ssrf_blocked("10.0.0.1") is True


def test_host_allowed_respects_allowlist() -> None:
    assert _host_allowed("https://example.com/x", ["example.com"], []) is True
    assert _host_allowed("https://evil.com/x", ["example.com"], []) is False


def test_host_allowed_deny_wins() -> None:
    assert _host_allowed("https://sub.evil.com/x", [], ["evil.com"]) is False


@pytest.mark.asyncio
async def test_run_fetch_url_salvages_oversized_html(monkeypatch: pytest.MonkeyPatch) -> None:
    """Oversize responses yield truncated text — not a hard empty error (c236bbb6)."""
    big = b"<html><body>" + (b"price 19990 rub " * 50_000) + b"</body></html>"
    assert len(big) > 50_000

    from api.services.safe_url_transport import FetchResult

    fetch = AsyncMock(return_value=FetchResult(big[:8000], httpx.Headers(), "https://example.com/long", 200, True))
    monkeypatch.setattr(_mod, "fetch_url", fetch)

    out = await _mod.run_fetch_url(
        "https://example.com/long",
        max_bytes=8_000,
        timeout_sec=5.0,
        allow_hosts=[],
        deny_hosts=[],
    )
    assert not out.startswith("Ошибка")
    assert "19990" in out
    assert "обрезан" in out
