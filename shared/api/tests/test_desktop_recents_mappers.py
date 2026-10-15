# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Unit tests for desktop recent-files row mappers and re-export import chain.
# Invariants:
# - Mapper output matches DesktopRecentFileRow wire shape (camelCase openedAt).
# Related:
# - api/routers/desktop_recents.py
# ---

from datetime import UTC, datetime

from api.routers.desktop import DesktopRecentFileRow
from api.routers.desktop_recents import (
    _map_project_recent_rows,
    _map_unified_recent_rows,
)


class _FakeResult:
    def __init__(self, rows: list[dict]) -> None:
        self._rows = rows

    def mappings(self):
        return iter(self._rows)


def test_map_unified_recent_rows_content_type_and_path() -> None:
    ts = datetime(2026, 7, 4, 12, 0, tzinfo=UTC)
    mapped = _map_unified_recent_rows(
        _FakeResult(
            [
                {
                    "id": "abc-123",
                    "name": "  Report  ",
                    "content_type": "image",
                    "opened_at": ts,
                }
            ]
        )
    )
    assert len(mapped) == 1
    row = mapped[0]
    assert row["id"] == "abc-123"
    assert row["name"] == "Report"
    assert row["type"] == "image"
    assert row["path"] == "#/content/abc-123"
    assert row["openedAt"] == ts.isoformat()
    DesktopRecentFileRow.model_validate(row)


def test_map_unified_recent_rows_default_name_and_type() -> None:
    mapped = _map_unified_recent_rows(_FakeResult([{"id": "x", "name": "", "content_type": None, "opened_at": None}]))
    assert mapped[0]["name"] == "Без названия"
    assert mapped[0]["type"] == "document"
    assert mapped[0]["openedAt"] == ""


def test_map_project_recent_rows_project_type() -> None:
    mapped = _map_project_recent_rows(
        _FakeResult([{"id": "proj-1", "name": "Alpha", "opened_at": "2026-07-04T10:00:00"}])
    )
    assert mapped[0]["type"] == "project"
    assert mapped[0]["path"] == ""
    assert mapped[0]["name"] == "Alpha"
