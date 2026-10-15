# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Regression lock for shared_tools path resolution (host monorepo + /app/shared_tools).
# Related:
# - api/shared_tools_path.py
# ---

from __future__ import annotations

from api.shared_tools_path import resolve_shared_tools_dir


def test_resolve_shared_tools_dir_finds_monorepo_package() -> None:
    shared = resolve_shared_tools_dir()
    assert shared is not None
    assert (shared / "i18n_rewriter" / "stack2_service.py").is_file()
    assert shared.name in {"tools", "shared_tools"}
