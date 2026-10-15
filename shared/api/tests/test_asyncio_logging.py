# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---

from __future__ import annotations

import asyncio

import pytest


class _FakeConnectionClosedOK(Exception):
    pass


@pytest.mark.asyncio
async def test_install_asyncio_exception_handler_suppresses_benign_close(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from api.utils import asyncio_logging

    monkeypatch.setattr(
        asyncio_logging,
        "_is_benign_websocket_close",
        lambda exc: isinstance(exc, _FakeConnectionClosedOK),
    )

    loop = asyncio.get_running_loop()
    calls: list[dict] = []

    def default_handler(_loop: asyncio.AbstractEventLoop, context: dict) -> None:
        calls.append(context)

    loop.set_exception_handler(default_handler)
    asyncio_logging.install_asyncio_exception_handler(loop=loop)

    handler = loop.get_exception_handler()
    assert handler is not None
    handler(
        loop,
        {
            "message": "ConnectionClosedOK exception in shielded future",
            "exception": _FakeConnectionClosedOK("closed"),
        },
    )
    assert calls == []


@pytest.mark.asyncio
async def test_install_asyncio_exception_handler_keeps_real_errors(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from api.utils import asyncio_logging

    loop = asyncio.get_running_loop()
    calls: list[dict] = []

    def default_handler(_loop: asyncio.AbstractEventLoop, context: dict) -> None:
        calls.append(context)

    loop.set_exception_handler(default_handler)
    asyncio_logging.install_asyncio_exception_handler(loop=loop)

    handler = loop.get_exception_handler()
    assert handler is not None
    handler(loop, {"message": "boom", "exception": RuntimeError("boom")})
    assert len(calls) == 1
