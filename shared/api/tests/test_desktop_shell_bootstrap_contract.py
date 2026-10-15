# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Contract lock for GET /desktop/shell-bootstrap route mount and response envelope.
# Invariants:
# - Route path `/shell-bootstrap` mounted under desktop shell aggregator.
# - Response model requires critical cold-path slices; optional badges nullable.
# Related:
# - api/routers/desktop_shell_bootstrap.py
# - api/routers/desktop_shell.py
# ---
"""Desktop shell-bootstrap API contract tests."""

from __future__ import annotations

from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4

import pytest

from api.schemas.desktop_shell_bootstrap import (
    DesktopShellBootstrapResponse,
    InstalledAppsSlice,
)


def test_installed_slice_is_shared_schema_not_private_model() -> None:
    """Regression: private pydantic twin caused 500 model_type on installed."""
    slice_ = InstalledAppsSlice(app_ids=["app-store"])
    payload = DesktopShellBootstrapResponse.model_validate(
        {
            "schema_version": 2,
            "fetched_at": datetime.now(UTC),
            "maintenance": {"active": False, "window": None},
            "profile": {
                "id": str(uuid4()),
                "email": "bootstrap@example.com",
                "username": "bootstrap",
                "full_name": "Bootstrap User",
                "role": "user",
                "is_active": True,
                "is_verified": False,
                "created_at": datetime.now(UTC),
            },
            "preferences": {},
            "notification_center": {"items": [], "updated_at": None},
            "desktop_config": {
                "id": uuid4(),
                "user_id": uuid4(),
                "wallpaper": "default",
                "icon_size": "MEDIUM",
                "show_widget": False,
                "widget_position": {"x": 20, "y": 20},
                "theme": "DARK",
                "created_at": datetime.now(UTC),
                "updated_at": datetime.now(UTC),
            },
            "installed": slice_,
            "shell_state": {},
            "shell_state_etag": 'W/"bootstrap-shell"',
            "shell_state_field_etags": {},
            "items": {"items": []},
            "recent_files": [],
            "recent_content_feed": {
                "opened": [],
                "added": [],
                "generated": [],
                "uploaded": [],
                "projects": [],
            },
            "gaf_me": {"user_id": "u1"},
        }
    )
    assert payload.installed.app_ids == ["app-store"]
    assert payload.schema_version == 2
    assert payload.items.items == []
    assert payload.shell_state_etag.startswith("W/")


def test_shell_bootstrap_route_mounted_from_desktop_parent() -> None:
    desktop = Path(__file__).resolve().parents[1] / "routers" / "desktop.py"
    bootstrap = Path(__file__).resolve().parents[1] / "routers" / "desktop_shell_bootstrap.py"
    desktop_text = desktop.read_text(encoding="utf-8")
    boot_text = bootstrap.read_text(encoding="utf-8")
    assert "desktop_shell_bootstrap" in desktop_text
    assert "include_router(_desktop_shell_bootstrap.router)" in desktop_text
    assert '"/shell-bootstrap"' in boot_text
    assert "build_desktop_shell_bootstrap" in boot_text


def test_shell_bootstrap_response_rejects_incomplete_payload() -> None:
    with pytest.raises(Exception):
        DesktopShellBootstrapResponse.model_validate(
            {
                "schema_version": 2,
                "fetched_at": datetime.now(UTC),
                "maintenance": {"active": False, "window": None},
            }
        )


def test_shell_bootstrap_response_accepts_nullable_badge_slices() -> None:
    user_id = uuid4()
    now = datetime.now(UTC)
    payload = DesktopShellBootstrapResponse.model_validate(
        {
            "schema_version": 2,
            "fetched_at": now,
            "maintenance": {"active": False, "window": None},
            "profile": {
                "id": str(user_id),
                "email": "bootstrap@example.com",
                "username": "bootstrap",
                "full_name": "Bootstrap User",
                "role": "user",
                "is_active": True,
                "is_verified": False,
                "created_at": now,
            },
            "preferences": {},
            "notification_center": {"items": [], "updated_at": None},
            "desktop_config": {
                "id": user_id,
                "user_id": user_id,
                "wallpaper": "default",
                "icon_size": "MEDIUM",
                "show_widget": False,
                "widget_position": {"x": 20, "y": 20},
                "theme": "DARK",
                "created_at": now,
                "updated_at": now,
            },
            "installed": {"app_ids": ["app-store"]},
            "shell_state": {"recent_app_ids": []},
            "shell_state_etag": 'W/"x"',
            "shell_state_field_etags": {"recent_app_ids": '"abc"'},
            "items": {"items": []},
            "recent_files": [],
            "recent_content_feed": {
                "opened": [],
                "added": [],
                "generated": [],
                "uploaded": [],
                "projects": [],
            },
            "gaf_me": {"user_id": str(user_id)},
            "gaf_chats": None,
            "friends_overview": None,
            "ewdesk_news_counts": None,
            "ewdesk_news_my_state": None,
            "ugs_tray_summary": None,
        }
    )
    assert payload.schema_version == 2
    assert payload.gaf_me.user_id == str(user_id)
    assert payload.friends_overview is None
    assert payload.installed.app_ids == ["app-store"]
    assert payload.shell_state.recent_app_ids == []
    assert payload.items.items == []


def test_shell_bootstrap_service_includes_shell_state_and_items_helpers() -> None:
    """Lock cause-layer: aggregator loads shell-state + shared items helper."""
    service = Path(__file__).resolve().parents[1] / "services" / "desktop_shell_bootstrap_service.py"
    items = Path(__file__).resolve().parents[1] / "routers" / "desktop_items.py"
    service_text = service.read_text(encoding="utf-8")
    items_text = items.read_text(encoding="utf-8")
    assert "load_desktop_items_response" in service_text
    assert "_load_shell_state_slice" in service_text
    assert '"schema_version": 2' in service_text
    assert "async def load_desktop_items_response" in items_text
    assert "skip_legacy_cleanup" in items_text
