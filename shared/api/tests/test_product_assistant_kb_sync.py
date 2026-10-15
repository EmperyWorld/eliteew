# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Поведенческие тесты resolve_handbook_kb_articles_dir (контракт пути kb-*.md).
# Invariants:
# - Явный env ASSISTANT_HANDBOOK_KB_ARTICLES_DIR имеет приоритет.
# Related:
# - api/services/product_assistant_kb_sync.py
# ---

from __future__ import annotations

import asyncio
from pathlib import Path

import pytest

from api.services.product_assistant_kb_sync import resolve_handbook_kb_articles_dir


def test_resolve_handbook_dir_from_env(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    kb_dir = tmp_path / "handbook-kb-articles"
    kb_dir.mkdir()
    (kb_dir / "kb-test.md").write_text("# Test\n\nbody", encoding="utf-8")
    monkeypatch.setenv("ASSISTANT_HANDBOOK_KB_ARTICLES_DIR", str(kb_dir))
    assert resolve_handbook_kb_articles_dir() == kb_dir.resolve()


def test_resolve_handbook_dir_env_missing_raises(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    missing = tmp_path / "nope"
    monkeypatch.setenv("ASSISTANT_HANDBOOK_KB_ARTICLES_DIR", str(missing))
    with pytest.raises(FileNotFoundError, match="not a directory"):
        resolve_handbook_kb_articles_dir()


def test_resolve_handbook_dir_finds_repo_catalog(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("ASSISTANT_HANDBOOK_KB_ARTICLES_DIR", raising=False)
    resolved = resolve_handbook_kb_articles_dir()
    assert resolved.is_dir()
    assert list(resolved.glob("kb-*.md"))


def test_sync_handbook_dry_run_returns_handbook_dir(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from api.services.product_assistant_kb_sync import sync_handbook_kb_articles

    kb_dir = tmp_path / "handbook-kb-articles"
    kb_dir.mkdir()
    (kb_dir / "kb-alpha.md").write_text("# Alpha\n\nbody", encoding="utf-8")
    (kb_dir / "kb-beta.md").write_text("# Beta\n\nbody", encoding="utf-8")
    monkeypatch.setenv("ASSISTANT_HANDBOOK_KB_ARTICLES_DIR", str(kb_dir))

    result = asyncio.run(sync_handbook_kb_articles(dry_run=True, limit=1))

    assert result.dry_run is True
    assert result.files == 1
    assert result.ok == 1
    assert result.handbook_dir == str(kb_dir.resolve())
