#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Regression tests for Phase 2 event-loop blocking remediation.
# Invariants:
# - Document conversion CPU work is executed through the bounded blocking-work helper.
# - The async request loop remains schedulable while conversion work is running.
# Related:
# - api/services/doc_converter_service.py
# - api/utils/blocking.py
# ---
"""Event-loop offload regression tests."""

from __future__ import annotations

import asyncio
import time
from typing import Any

import pytest

from api.services.doc_converter_service import DocConverterService


@pytest.mark.unit
def test_doc_converter_conversion_work_does_not_block_event_loop() -> None:
    async def _run() -> None:
        service = DocConverterService.__new__(DocConverterService)
        setattr(service, "db_pool", None)
        setattr(service, "redis_client", None)

        async def _blocking_convert(
            _file_data: bytes,
            _source_format: str,
            _target_format: str,
            _options: dict[str, Any],
        ) -> str:
            time.sleep(0.08)
            return "converted"

        service._convert_internal = _blocking_convert  # type: ignore[method-assign]
        conversion_task = asyncio.create_task(service.convert(b"hello", "txt", "text", "hello.txt", {}))
        await asyncio.sleep(0.01)
        ticked_while_conversion_running = not conversion_task.done()
        result = await conversion_task

        assert ticked_while_conversion_running is True
        assert result["content"] == "converted"
        assert result["cached"] is False

    asyncio.run(_run())
