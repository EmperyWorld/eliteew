# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Guard against asyncpg pool use-after-release in list_content_multi_version.
# Related:
# - api/services/unified_content/content_storage_list.py
# ---

from __future__ import annotations

from pathlib import Path

API_ROOT = Path(__file__).resolve().parents[1]


def test_list_content_multi_version_resolve_owner_can_edit_inside_acquire() -> None:
    source = (API_ROOT / "services/unified_content/content_storage_list.py").read_text(encoding="utf-8")
    start = source.index("async def list_content_multi_version")
    end = source.index("async def record_user_content_view", start)
    block = source[start:end]
    acquire_idx = block.index("async with self.db_pool.acquire() as conn:")
    resolve_idx = block.index("resolve_owner_can_edit(")
    return_idx = block.rindex("return content_list")
    assert acquire_idx < resolve_idx < return_idx
    # Loop and resolve_owner_can_edit must stay inside the acquire block (before dedented return).
    after_acquire = block[acquire_idx:]
    dedent_return = after_acquire.index("\n        return content_list")
    assert resolve_idx - start < acquire_idx - start + dedent_return
