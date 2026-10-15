"""GAF admin desktop app link helpers (visibility + metadata builder)."""

from uuid import UUID

import pytest

from api.core.auth import User as AuthUser
from api.gaf_chat.admin_desktop_app_link import (
    DESKTOP_APP_LINK_KIND,
    build_desktop_app_link_body,
    build_desktop_app_link_metadata,
    is_gaf_admin_auth_user,
    partner_can_see_catalog_row,
    resolve_partner_desktop_app_for_link,
)
from api.routers.desktop import DEFAULT_ACCESS_GROUP_ID


def test_is_gaf_admin_auth_user() -> None:
    assert is_gaf_admin_auth_user(AuthUser(id="1", email="a@b.c", username="a", role="admin"))
    assert is_gaf_admin_auth_user(AuthUser(id="1", email="a@b.c", username="a", role="emperyworld_admin"))
    assert not is_gaf_admin_auth_user(AuthUser(id="1", email="a@b.c", username="a", role="emperyworld_member"))


def test_partner_can_see_catalog_row_system_only_for_admin() -> None:
    group = DEFAULT_ACCESS_GROUP_ID
    assert partner_can_see_catalog_row(
        is_system=True,
        partner_role="admin",
        partner_group_id=group,
        access_group_ids=[],
    )
    assert not partner_can_see_catalog_row(
        is_system=True,
        partner_role="emperyworld_member",
        partner_group_id=group,
        access_group_ids=[],
    )


def test_partner_can_see_catalog_row_access_group_gate() -> None:
    allowed = UUID("b0000000-0000-4000-8000-000000000002")
    denied = UUID("c0000000-0000-4000-8000-000000000003")
    assert partner_can_see_catalog_row(
        is_system=False,
        partner_role="emperyworld_member",
        partner_group_id=allowed,
        access_group_ids=[allowed],
    )
    assert not partner_can_see_catalog_row(
        is_system=False,
        partner_role="emperyworld_member",
        partner_group_id=denied,
        access_group_ids=[allowed],
    )
    assert partner_can_see_catalog_row(
        is_system=False,
        partner_role="emperyworld_member",
        partner_group_id=denied,
        access_group_ids=[],
    )


def test_build_desktop_app_link_metadata_rejects_unknown_component() -> None:
    with pytest.raises(ValueError, match="Invalid open_app_component"):
        build_desktop_app_link_metadata(
            app_id="x",
            app_name="X",
            app_component="NotARealApp",
        )


def test_build_desktop_app_link_metadata_ok() -> None:
    meta = build_desktop_app_link_metadata(
        app_id="app-gaf-chat",
        app_name="GAF Chat",
        app_component="GAFChatApp",
    )
    assert meta["kind"] == DESKTOP_APP_LINK_KIND
    assert meta["open_app_component"] == "GAFChatApp"
    assert meta["button_label"] == "GAF Chat"


def test_build_desktop_app_link_body() -> None:
    assert build_desktop_app_link_body(app_name="Music") == "Приложение: Music"
    body = build_desktop_app_link_body(app_name="Music", note="Попробуй")
    assert "Приложение: Music" in body
    assert "Попробуй" in body


def test_resolve_partner_app_rejects_unknown_app_id(monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_list(*_args, **_kwargs):
        return [{"app_id": "app-a", "name": "A", "app_component": "GAFChatApp", "category": ""}]

    monkeypatch.setattr(
        "api.gaf_chat.admin_desktop_app_link.list_partner_desktop_apps_for_admin_link",
        fake_list,
    )

    async def run() -> None:
        with pytest.raises(ValueError, match="not available"):
            await resolve_partner_desktop_app_for_link(
                pool=object(),  # type: ignore[arg-type]
                partner_user_id="00000000-0000-4000-8000-000000000099",
                app_id="missing",
            )

    import anyio

    anyio.run(run)


def test_build_desktop_app_link_metadata_accepts_ewa_app() -> None:
    """Newer catalog components (EwaApp) must not be blocked by stale GAF allowlist."""
    meta = build_desktop_app_link_metadata(
        app_id="app-ewa",
        app_name="EWA",
        app_component="EwaApp",
    )
    assert meta["open_app_component"] == "EwaApp"
