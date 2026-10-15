# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Regression lock for desktop items module import chain and item Pydantic schemas.
# Invariants:
# - ``desktop.py`` re-exports item schemas via ``desktop_workspace`` → ``desktop_items``.
# Related:
# - api/routers/desktop_items.py
# ---

from api.models.desktop import ItemType
from api.routers.desktop import (
    DesktopItemCreate,
    DesktopItemResponse,
    DesktopItemsBulkUpdate,
    DesktopItemsResponse,
)
from api.routers.desktop_items import DesktopItemUpsert


def test_desktop_items_schema_import_chain() -> None:
    row = DesktopItemCreate(
        item_id="folder-test",
        item_type=ItemType.FOLDER,
        name="Test",
    )
    assert row.item_id == "folder-test"
    assert DesktopItemsResponse.model_fields["items"].annotation is not None
    assert DesktopItemUpsert.model_fields["item_type"].default is None


def test_desktop_items_bulk_update_wraps_create_schema() -> None:
    bulk = DesktopItemsBulkUpdate(
        items=[
            DesktopItemCreate(
                item_id="app-x",
                item_type=ItemType.APP,
                name="X",
                app_component="AppStore",
            )
        ]
    )
    assert len(bulk.items) == 1
    assert isinstance(bulk.items[0], DesktopItemCreate)


def test_desktop_item_response_from_attributes_config() -> None:
    assert DesktopItemResponse.model_config.get("from_attributes") is True
