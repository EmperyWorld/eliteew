# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Синхронизация kb-*.md из documentation/product/handbook-kb-articles в assistant KB.
# Invariants:
# - Идемпотентность по source_filename; dry_run не пишет в БД/Qdrant и не открывает Postgres.
# - Каталог статей: env ASSISTANT_HANDBOOK_KB_ARTICLES_DIR → /app/documentation/… (stack0 mount) →
#   repo scan → seeded fallback внутри `api/data/handbook-kb-articles` (для immutable test-runner).
# Related:
# - api/services/product_assistant_kb_store.py
# - api/scripts/sync_handbook_kb_articles.py
# ---

from __future__ import annotations

import logging
import os
import re
from dataclasses import dataclass
from pathlib import Path

logger = logging.getLogger(__name__)

_MD_TITLE_RE = re.compile(r"^#\s+(.+)$")

_ENV_HANDBOOK_DIR = "ASSISTANT_HANDBOOK_KB_ARTICLES_DIR"
_CONTAINER_HANDBOOK_DIR = Path("/app/documentation/product/handbook-kb-articles")
_SEEDED_HANDBOOK_DIR = Path(__file__).resolve().parents[1] / "data" / "handbook-kb-articles"


def resolve_handbook_kb_articles_dir() -> Path:
    """Каталог kb-*.md: env → stack0 mount → поиск вверх от модуля."""
    raw = os.environ.get(_ENV_HANDBOOK_DIR, "").strip()
    if raw:
        explicit = Path(raw).expanduser().resolve()
        if explicit.is_dir():
            return explicit
        msg = f"{_ENV_HANDBOOK_DIR} is not a directory: {explicit}"
        raise FileNotFoundError(msg)
    if _CONTAINER_HANDBOOK_DIR.is_dir():
        return _CONTAINER_HANDBOOK_DIR
    here = Path(__file__).resolve()
    cwd = Path.cwd().resolve()
    roots: list[Path] = []
    for base in (cwd, *cwd.parents, here.parent, *here.parents):
        if base not in roots:
            roots.append(base)
    for base in roots:
        candidate = base / "documentation" / "product" / "handbook-kb-articles"
        if candidate.is_dir():
            return candidate
    if _SEEDED_HANDBOOK_DIR.is_dir():
        logger.warning(
            "Handbook KB articles dir not found via env/mount/repo scan, using seeded fallback: %s",
            _SEEDED_HANDBOOK_DIR,
        )
        return _SEEDED_HANDBOOK_DIR
    return here.parent / "documentation" / "product" / "handbook-kb-articles"


def _markdown_title_from_body(body: str, fallback: str) -> str:
    """Первая строка «# …» или fallback (имя файла без kb-); без импорта kb_store."""
    for line in (body or "").splitlines():
        m = _MD_TITLE_RE.match(line.strip())
        if m:
            return m.group(1).strip()[:500]
    fb = (fallback or "").strip()
    if fb.startswith("kb-"):
        fb = fb[3:].replace("-", " ")
    return fb[:500] or "Document"


@dataclass(frozen=True)
class HandbookKbSyncResult:
    files: int
    ok: int
    fail: int
    dry_run: bool
    handbook_dir: str = ""


async def sync_handbook_kb_articles(
    *,
    dry_run: bool = False,
    limit: int | None = None,
) -> HandbookKbSyncResult:
    """Upsert всех kb-*.md в assistant_kb_documents и проиндексировать в Qdrant."""
    handbook_dir = resolve_handbook_kb_articles_dir()
    if not handbook_dir.is_dir():
        msg = f"Handbook dir not found: {handbook_dir}"
        raise FileNotFoundError(msg)

    paths = sorted(handbook_dir.glob("kb-*.md"))
    if limit is not None:
        paths = paths[:limit]
    if not paths:
        logger.warning("No kb-*.md files in %s", handbook_dir)
        return HandbookKbSyncResult(files=0, ok=0, fail=0, dry_run=dry_run, handbook_dir=str(handbook_dir))

    if dry_run:
        ok = 0
        for path in paths:
            body = path.read_text(encoding="utf-8")
            title = _markdown_title_from_body(body, path.stem)
            logger.info(
                "dry-run: would upsert %s title=%r chars=%d",
                path.name,
                title,
                len(body),
            )
            ok += 1
        logger.info(
            "sync_handbook_kb_articles done files=%s ok=%s fail=%s dry_run=%s",
            len(paths),
            ok,
            0,
            dry_run,
        )
        return HandbookKbSyncResult(
            files=len(paths),
            ok=ok,
            fail=0,
            dry_run=True,
            handbook_dir=str(handbook_dir),
        )

    from api.core.database_manager import get_database_manager
    from api.services.product_assistant_kb_store import (
        title_from_markdown_body,
        upsert_assistant_kb_markdown_document,
    )

    db_manager = await get_database_manager()
    ok = 0
    fail = 0
    async with db_manager.get_postgres_session() as db:
        for path in paths:
            body = path.read_text(encoding="utf-8")
            title = title_from_markdown_body(body, path.stem)
            try:
                doc_id, st, chunks = await upsert_assistant_kb_markdown_document(
                    db,
                    source_filename=path.name,
                    title=title,
                    body=body,
                )
                logger.info(
                    "synced %s id=%s status=%s chunks=%d",
                    path.name,
                    doc_id,
                    st,
                    chunks,
                )
                if st == "indexed":
                    ok += 1
                else:
                    fail += 1
            except Exception:
                logger.exception("sync failed for %s", path.name)
                fail += 1

    logger.info(
        "sync_handbook_kb_articles done files=%s ok=%s fail=%s dry_run=%s",
        len(paths),
        ok,
        fail,
        dry_run,
    )
    return HandbookKbSyncResult(
        files=len(paths),
        ok=ok,
        fail=fail,
        dry_run=dry_run,
        handbook_dir=str(handbook_dir),
    )
