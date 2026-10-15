# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Unit tests for Content Manager list filter normalizers (size + processing_status).
# Invariants:
# - Invalid processing_status and negative min_file_size raise ValueError.
# Related:
# - api/services/unified_content/content_list_filters.py
# ---

from __future__ import annotations

import pytest

from api.services.unified_content.content_list_filters import (
    normalize_content_list_min_file_size,
    normalize_content_list_processing_status,
)


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        (None, None),
        (0, 0),
        (1024, 1024),
    ],
)
def test_normalize_min_file_size_ok(raw: int | None, expected: int | None) -> None:
    assert normalize_content_list_min_file_size(raw) == expected


def test_normalize_min_file_size_rejects_negative() -> None:
    with pytest.raises(ValueError, match="invalid min_file_size"):
        normalize_content_list_min_file_size(-1)


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        (None, None),
        ("", None),
        ("  ", None),
        ("FAILED", "failed"),
        ("Completed", "completed"),
        ("pending", "pending"),
        ("processing", "processing"),
    ],
)
def test_normalize_processing_status_ok(raw: str | None, expected: str | None) -> None:
    assert normalize_content_list_processing_status(raw) == expected


def test_normalize_processing_status_rejects_unknown() -> None:
    with pytest.raises(ValueError, match="invalid processing_status"):
        normalize_content_list_processing_status("done")
