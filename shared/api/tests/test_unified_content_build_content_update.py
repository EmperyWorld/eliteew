# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Guard build_content_update partial semantics — unset fields must not patch DB columns.
# Invariants:
# - friend_visibility is omitted unless caller passes it (Image Studio re-tag after UGS dedup).
# Related:
# - api/schemas/unified_content.py
# - api/services/unified_content/content_storage_service.py
# ---

from api.schemas.unified_content import build_content_update


def test_build_content_update_omits_friend_visibility_by_default() -> None:
    update = build_content_update(name="PW output", source_service="image_studio")
    assert "friend_visibility" not in update.model_fields_set


def test_build_content_update_can_set_friend_visibility_false() -> None:
    update = build_content_update(friend_visibility=False)
    assert update.friend_visibility is False
    assert "friend_visibility" in update.model_fields_set


def test_build_content_update_preserves_explicit_folder_clear() -> None:
    update = build_content_update(folder_item_id=None)
    assert "folder_item_id" in update.model_fields_set
    assert update.folder_item_id is None
