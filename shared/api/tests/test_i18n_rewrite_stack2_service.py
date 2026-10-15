# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Behavioral tests for i18n rewrite stack2 service (flatten, preview, meta).
# Invariants:
# - No live stack2 calls in unit tests.
# Related:
# - api/services/i18n_rewrite_stack2_service.py
# ---

from __future__ import annotations

from pathlib import Path

import pytest

from api.services.i18n_rewrite_stack2_service import (
    admin_meta,
    build_preview,
    flatten_string_leaves,
    placeholders_preserved,
    resolve_repo_root,
)


def test_flatten_string_leaves_respects_exclude_and_prefix() -> None:
    tree = {
        "sidebar": {"title": "A", "nested": {"x": "B"}},
        "ewaGuide": {"skip": "C"},
        "other": "D",
    }
    flat = flatten_string_leaves(
        tree,
        exclude_roots={"ewaGuide"},
        only_prefix="sidebar",
    )
    assert flat == {"sidebar.title": "A", "sidebar.nested.x": "B"}


def test_placeholders_preserved() -> None:
    old = "Hello {{name}}"
    assert placeholders_preserved(old, "Hi {{name}}")
    assert not placeholders_preserved(old, "Hi there")


@pytest.mark.skipif(resolve_repo_root() is None, reason="monorepo root not found")
def test_build_preview_marketing_sidebar_prefix() -> None:
    preview = build_preview(
        spec_id="marketing-hall-ru",
        target_id="marketing-ru",
        only_prefix="sidebar",
        batch_size=32,
    )
    assert preview["pending_keys"] > 0
    assert preview["batch_count"] >= 1
    assert "cli_command" in preview
    assert "bash docker/scripts/i18n-rewrite-stack2.sh" in preview["cli_command"]


def test_admin_meta_shape() -> None:
    meta = admin_meta()
    assert "enabled" in meta
    assert "specs" in meta
    assert "targets" in meta
    assert "stack2" in meta
    if meta["enabled"]:
        assert isinstance(meta["repo_root"], str)
        assert Path(meta["repo_root"]).is_dir()
