# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Guard that ShareService no longer writes legacy shared_with_user_ids after content_shares SSOT cutover.
# Related:
# - api/services/unified_content/share_service.py
# ---
from __future__ import annotations

import inspect

from api.services.unified_content import share_service


def test_share_service_does_not_define_legacy_array_sync_helper() -> None:
    assert not hasattr(share_service.ShareService, "_sync_shared_with_user_ids")


def test_share_service_source_has_no_legacy_array_writes() -> None:
    source = inspect.getsource(share_service.ShareService)
    assert "SET shared_with_user_ids" not in source
    assert "array_remove" not in source
    assert "_sync_shared_with_user_ids" not in source
