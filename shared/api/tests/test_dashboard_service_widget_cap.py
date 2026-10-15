"""Unit tests: widget-per-layout cap on DashboardService paths (no HTTP router imports)."""

from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from fastapi import HTTPException

from api.core.unified_config import unified_settings
from api.services.marketing_cabinet.dashboard_service import DashboardService


def test_create_layout_from_preset_new_layout_rejects_when_template_exceeds_cap() -> None:
    """SQL create_layout_from_preset has no cap; Python must reject oversized templates (C.34)."""

    async def _run() -> None:
        user_id = str(uuid4())
        project_id = uuid4()
        widgets = [{"widget_key": "tasks", "widget_title": "T"} for _ in range(5)]
        preset_row = {
            "display_name": "Huge",
            "template_config": {"widgets": widgets},
        }

        conn = MagicMock()
        conn.execute = AsyncMock()

        class _Tx:
            async def __aenter__(self) -> None:
                return None

            async def __aexit__(self, *args: object) -> None:
                return None

        conn.transaction = MagicMock(return_value=_Tx())
        conn.fetchrow = AsyncMock(side_effect=[preset_row, None])
        conn.fetchval = AsyncMock()

        class _Acquire:
            async def __aenter__(self) -> MagicMock:
                return conn

            async def __aexit__(self, *args: object) -> None:
                return None

        pool = MagicMock()
        pool.acquire = MagicMock(return_value=_Acquire())
        svc = DashboardService(pool)

        with patch.object(unified_settings, "marketing_dashboard_max_widgets_per_layout", 3):
            with pytest.raises(HTTPException) as excinfo:
                await svc.create_layout_from_preset(
                    "huge_preset",
                    user_id,
                    project_id,
                    custom_name=None,
                    rebuild_existing=False,
                )
        assert excinfo.value.status_code == 400
        assert "limit" in excinfo.value.detail.lower()
        conn.fetchval.assert_not_called()

    asyncio.run(_run())


def test_clone_layout_rejects_when_source_widget_count_exceeds_cap() -> None:
    async def _run() -> None:
        user_id = str(uuid4())
        source_id = uuid4()

        conn = MagicMock()
        conn.execute = AsyncMock()

        class _Tx:
            async def __aenter__(self) -> None:
                return None

            async def __aexit__(self, *args: object) -> None:
                return None

        conn.transaction = MagicMock(return_value=_Tx())
        conn.fetchval = AsyncMock(return_value=50)

        class _Acquire:
            async def __aenter__(self) -> MagicMock:
                return conn

            async def __aexit__(self, *args: object) -> None:
                return None

        pool = MagicMock()
        pool.acquire = MagicMock(return_value=_Acquire())
        svc = DashboardService(pool)

        with patch.object(unified_settings, "marketing_dashboard_max_widgets_per_layout", 10):
            with pytest.raises(HTTPException) as excinfo:
                await svc.clone_layout(source_id, "copy", user_id)
        assert excinfo.value.status_code == 400
        assert conn.fetchval.call_count == 1

    asyncio.run(_run())
