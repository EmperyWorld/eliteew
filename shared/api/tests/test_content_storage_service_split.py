# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Regression lock: content_storage_service P1 split keeps facade imports, mixin MRO, and quota ownership.
# Invariants:
# - Public import paths remain ``content_storage_service`` (no caller migration required).
# Related:
# - api/services/unified_content/content_storage_service.py
# - api/services/unified_content/content_storage_{create,list,delete,shared}.py
# ---

from __future__ import annotations

from pathlib import Path

API_ROOT = Path(__file__).resolve().parents[1]
UC_DIR = API_ROOT / "services" / "unified_content"


def test_content_storage_facade_re_exports_and_mro() -> None:
    from api.services.unified_content.content_storage_service import (
        ContentStorageService,
        ContentVersionConflictError,
        get_content_user_storage_quota_bytes,
        resolve_dedup_folder_relocation,
        resolve_upload_folder_item_id,
        upload_requests_folder_placement,
    )

    mro_names = [cls.__name__ for cls in ContentStorageService.__mro__]
    assert "ContentStorageCreateMixin" in mro_names
    assert "ContentStorageListMixin" in mro_names
    assert "ContentStorageDeleteMixin" in mro_names

    for method in (
        "create_content",
        "copy_content",
        "list_content",
        "delete_content",
        "restore_content",
        "get_content",
        "_check_quota",
    ):
        assert hasattr(ContentStorageService, method), method

    assert issubclass(ContentVersionConflictError, Exception)
    assert callable(get_content_user_storage_quota_bytes)
    assert callable(upload_requests_folder_placement)
    assert callable(resolve_upload_folder_item_id)
    assert callable(resolve_dedup_folder_relocation)


def test_content_storage_quota_helpers_stay_in_facade_module() -> None:
    facade_source = (UC_DIR / "content_storage_service.py").read_text(encoding="utf-8")
    assert "def get_content_user_storage_quota_bytes" in facade_source
    assert "async def _check_quota" in facade_source
    assert "class _ContentUserQuotaBytes" in facade_source

    create_source = (UC_DIR / "content_storage_create.py").read_text(encoding="utf-8")
    assert "_check_quota" not in create_source


def test_content_storage_split_modules_exist_with_expected_classes() -> None:
    for stem, class_name in (
        ("content_storage_shared", "ContentVersionConflictError"),
        ("content_storage_create", "ContentStorageCreateMixin"),
        ("content_storage_list", "ContentStorageListMixin"),
        ("content_storage_delete", "ContentStorageDeleteMixin"),
    ):
        path = UC_DIR / f"{stem}.py"
        assert path.is_file(), stem
        assert class_name in path.read_text(encoding="utf-8"), stem
