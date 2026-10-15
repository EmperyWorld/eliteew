# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Behavioural tests for the logical catalogue-listing dedup **and** the new browse noise filter
# (``api.ewa_platform.companion.storage.catalog_listing``).
# Invariants:
# - Same ``file_hash`` + ``original_filename`` collapses to one visible row, regardless of unique ``id`` per row.
# - Different ``file_hash`` never collapses across rows.
# - Rows without enough identity (no hash, no name) fall back to id-based dedup.
# - System-imported migration stubs (``source_service`` deny-list or ``EWDesk legacy <legacy-uuid>`` name pattern)
#   are dropped by ``filter_companion_browse_noise_rows`` so the companion catalog appendix does not surface them.
# Related:
# - api/ewa_platform/companion/storage/catalog_listing.py
# ---
"""Tests for logical catalog listing dedup + noise filter used by EWA companion turn / runtime gateway."""

from __future__ import annotations

from dataclasses import dataclass

import pytest

from api.ewa_platform.companion.storage.catalog_listing import (
    dedupe_catalog_rows_by_logical_identity,
    filter_companion_browse_noise_rows,
    is_companion_browse_noise_row,
)


@dataclass
class _Row:
    id: str
    file_hash: str | None = None
    original_filename: str | None = None
    content_type: str | None = None
    name: str | None = None
    source_service: str | None = None


@pytest.mark.unit
def test_same_hash_and_name_collapses_to_one_row() -> None:
    """Three rows with identical (file_hash, original_filename) collapse to **one** row (the first)."""

    rows = [
        _Row(id="a", file_hash="HASHA", original_filename="report.md"),
        _Row(id="b", file_hash="HASHA", original_filename="report.md"),
        _Row(id="c", file_hash="HASHA", original_filename="report.md"),
    ]
    out = dedupe_catalog_rows_by_logical_identity(rows)
    assert [r.id for r in out] == ["a"], "Only the first occurrence must survive"


@pytest.mark.unit
def test_distinct_hashes_kept_separate() -> None:
    """Different ``file_hash`` values must not collapse, even if filenames match."""

    rows = [
        _Row(id="1", file_hash="H1", original_filename="diary.md"),
        _Row(id="2", file_hash="H2", original_filename="diary.md"),
    ]
    out = dedupe_catalog_rows_by_logical_identity(rows)
    assert [r.id for r in out] == ["1", "2"]


@pytest.mark.unit
def test_no_hash_falls_back_to_content_type_and_name() -> None:
    """When ``file_hash`` is missing, (content_type, name) keeps the row collapsed."""

    rows = [
        _Row(id="x", content_type="text/markdown", original_filename="note.md"),
        _Row(id="y", content_type="text/markdown", original_filename="note.md"),
        _Row(id="z", content_type="text/markdown", original_filename="other.md"),
    ]
    out = dedupe_catalog_rows_by_logical_identity(rows)
    assert [r.id for r in out] == ["x", "z"]


@pytest.mark.unit
def test_unknown_identity_falls_back_to_id_dedup() -> None:
    """Rows without enough metadata still collapse by ``id`` and keep first occurrence."""

    rows = [_Row(id="a"), _Row(id="a"), _Row(id="b")]
    out = dedupe_catalog_rows_by_logical_identity(rows)
    assert [r.id for r in out] == ["a", "b"]


@pytest.mark.unit
def test_dict_rows_are_supported() -> None:
    """Dict-shaped rows (e.g. from ``asyncpg`` records) must dedup just like attribute objects."""

    rows = [
        {"id": "1", "file_hash": "HX", "original_filename": "img.png"},
        {"id": "2", "file_hash": "HX", "original_filename": "img.png"},
    ]
    out = dedupe_catalog_rows_by_logical_identity(rows)
    assert [r["id"] for r in out] == ["1"]


@pytest.mark.unit
def test_partial_metadata_keeps_row_visible() -> None:
    """Whitespace-only fields must not collapse rows (treated as unknown)."""

    rows = [
        _Row(id="a", file_hash="   ", original_filename="alpha.md"),
        _Row(id="b", file_hash="   ", original_filename="beta.md"),
    ]
    out = dedupe_catalog_rows_by_logical_identity(rows)
    # No file_hash, but (content_type, name) — both rows lack content_type; falls back to id, both unique → both kept.
    assert [r.id for r in out] == ["a", "b"]


@pytest.mark.unit
def test_noise_filter_drops_known_source_service() -> None:
    """Rows with ``source_service`` in the deny-list are removed; user rows survive."""

    rows = [
        _Row(id="usr-1", file_hash="UH", original_filename="diary.md", name="diary", source_service="user_upload"),
        _Row(
            id="leg-1",
            file_hash="LH1",
            original_filename="ewdesk-hero.jpg",
            name="EWDesk legacy legacy-aaaa1111-bbbb-cccc-dddd-eeeeeeeeeeee",
            content_type="image",
            source_service="ewdesk_legacy_regen",
        ),
        _Row(
            id="leg-2",
            file_hash="LH2",
            original_filename="ewdesk-hero.jpg",
            name="EWDesk legacy legacy-bbbb2222-cccc-dddd-eeee-ffffffffffff",
            content_type="image",
            source_service="ewdesk_legacy_regen_imgonly",
        ),
    ]
    out = filter_companion_browse_noise_rows(rows)
    assert [r.id for r in out] == ["usr-1"], "Only the user row must remain"


@pytest.mark.unit
def test_noise_filter_drops_legacy_name_pattern_even_without_source_service() -> None:
    """Old rows that pre-date ``source_service`` still get dropped via the legacy name regex."""

    rows = [
        _Row(id="ok", original_filename="my-notes.md", name="my-notes.md"),
        _Row(
            id="legacy",
            original_filename="ewdesk-hero.jpg",
            name="EWDesk legacy legacy-12345678-90ab-cdef-1234-567890abcdef",
            content_type="image",
        ),
    ]
    out = filter_companion_browse_noise_rows(rows)
    assert [r.id for r in out] == ["ok"]


@pytest.mark.unit
def test_noise_filter_respects_env_override(monkeypatch: pytest.MonkeyPatch) -> None:
    """``EWA_COMPANION_CATALOG_BROWSE_NOISE_SOURCES`` extends the deny-list when set."""

    monkeypatch.setenv("EWA_COMPANION_CATALOG_BROWSE_NOISE_SOURCES", "extra_noise,one_more")
    rows = [
        _Row(id="user", source_service="user_upload", name="report.md"),
        _Row(id="extra", source_service="extra_noise", name="garbage"),
        _Row(id="legacy_default", source_service="ewdesk_legacy_regen", name="x"),
    ]
    out = filter_companion_browse_noise_rows(rows)
    assert [r.id for r in out] == ["user"], "Extras and default deny-list both drop"


@pytest.mark.unit
def test_noise_filter_empty_env_disables_deny_list_but_name_pattern_still_applies(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """An **empty** override disables only the source-service deny-list; the legacy-name regex still wins."""

    monkeypatch.setenv("EWA_COMPANION_CATALOG_BROWSE_NOISE_SOURCES", "")
    rows = [
        _Row(id="ok", source_service="ewdesk_legacy_regen", name="user-uploaded note"),
        _Row(
            id="legacy_name",
            source_service="ewdesk_legacy_regen",
            name="EWDesk legacy legacy-deadbeef-0000-1111-2222-333344445555",
        ),
    ]
    out = filter_companion_browse_noise_rows(rows)
    assert [r.id for r in out] == ["ok"], "Only the legacy-name regex match must drop"


@pytest.mark.unit
def test_is_companion_browse_noise_row_dict_shape() -> None:
    """The helper works on ``dict``-style rows too (covers ``asyncpg.Record``-like shapes)."""

    assert is_companion_browse_noise_row({"id": "x", "source_service": "ewdesk_legacy_regen", "name": "anything"})
    assert not is_companion_browse_noise_row({"id": "y", "source_service": "user_upload", "name": "regular.md"})
