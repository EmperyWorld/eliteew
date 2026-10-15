# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Behavioural tests for upload dedup placement helpers (folder scope + metadata merge inputs).
# Invariants:
# - Explicit folder_item_id or project desktop folder triggers placement merge on hash dedup.
# Related:
# - api/services/unified_content/content_storage_service.py
# ---
"""Tests: unified content upload dedup placement helpers."""

from __future__ import annotations

from uuid import uuid4

from api.schemas.unified_content import ContentCreate, ContentType
from api.services.unified_content.content_storage_service import (
    resolve_dedup_folder_relocation,
    resolve_upload_folder_item_id,
    upload_requests_folder_placement,
)


def _base_create(**overrides: object) -> ContentCreate:
    data = {
        "user_id": "user-1",
        "name": "report.md",
        "original_filename": "report.md",
        "content_type": ContentType.DOCUMENT,
        "mime_type": "text/markdown",
    }
    data.update(overrides)
    return ContentCreate(**data)


def test_upload_requests_folder_placement_explicit_folder() -> None:
    assert upload_requests_folder_placement(_base_create(folder_item_id="documents")) is True


def test_upload_requests_folder_placement_project_auto_folder() -> None:
    pid = uuid4()
    assert (
        upload_requests_folder_placement(
            _base_create(project_id=pid, folder_item_id=None, apply_project_desktop_folder=True)
        )
        is True
    )


def test_upload_requests_folder_placement_name_only() -> None:
    assert upload_requests_folder_placement(_base_create()) is False


def test_resolve_upload_folder_item_id_project_default() -> None:
    pid = uuid4()
    resolved = resolve_upload_folder_item_id(
        _base_create(project_id=pid, folder_item_id=None, apply_project_desktop_folder=True)
    )
    assert resolved == f"eliteew-proj-{pid}"


def test_resolve_upload_folder_item_id_explicit_wins_over_project() -> None:
    pid = uuid4()
    resolved = resolve_upload_folder_item_id(
        _base_create(project_id=pid, folder_item_id="documents", apply_project_desktop_folder=True)
    )
    assert resolved == "documents"


def test_resolve_upload_folder_item_id_image_default() -> None:
    resolved = resolve_upload_folder_item_id(_base_create(content_type=ContentType.IMAGE, mime_type="image/png"))
    assert resolved == "images"


def test_resolve_dedup_folder_relocation_from_ewa_file_defaults_documents() -> None:
    resolved = resolve_dedup_folder_relocation(_base_create(), "ewa_file")
    assert resolved == "documents"


def test_resolve_dedup_folder_relocation_skips_non_ewa_folder() -> None:
    assert resolve_dedup_folder_relocation(_base_create(), "documents") is None


def test_resolve_dedup_folder_relocation_uses_project_folder() -> None:
    pid = uuid4()
    resolved = resolve_dedup_folder_relocation(
        _base_create(project_id=pid, folder_item_id=None, apply_project_desktop_folder=True),
        "ewa_file",
    )
    assert resolved == f"eliteew-proj-{pid}"


def test_build_order_by_supports_modified_field() -> None:
    from api.services.unified_content.content_storage_service import ContentStorageService

    clause = ContentStorageService._build_order_by(None, "modified", "desc")
    assert "updated_at DESC" in clause
