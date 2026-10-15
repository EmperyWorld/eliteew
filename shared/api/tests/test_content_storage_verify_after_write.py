# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Post-upload storage verify uses read-probe when backend supports it.
# Related:
# - api/services/unified_content/content_storage_shared.py
# ---

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest

from api.services.unified_content.content_storage_shared import verify_storage_object_after_write


@pytest.mark.unit
@pytest.mark.asyncio
async def test_verify_storage_object_prefers_read_probe() -> None:
    content_id = uuid4()
    backend = MagicMock()
    backend.verify_object_readable = AsyncMock(return_value=True)
    backend.exists = AsyncMock(return_value=False)

    await verify_storage_object_after_write(backend, "unified-content/x/a.png", content_id)

    backend.verify_object_readable.assert_awaited_once()
    backend.exists.assert_not_awaited()


@pytest.mark.unit
@pytest.mark.asyncio
async def test_verify_storage_object_fails_when_not_readable() -> None:
    content_id = uuid4()
    backend = MagicMock()
    backend.verify_object_readable = AsyncMock(return_value=False)

    with pytest.raises(RuntimeError, match="not readable"):
        await verify_storage_object_after_write(backend, "unified-content/x/a.png", content_id)


@pytest.mark.unit
@pytest.mark.asyncio
async def test_verify_storage_object_falls_back_to_exists() -> None:
    content_id = uuid4()
    backend = MagicMock(spec=["exists"])
    backend.exists = AsyncMock(return_value=True)

    await verify_storage_object_after_write(backend, "unified-content/x/a.png", content_id)

    backend.exists.assert_awaited_once()
