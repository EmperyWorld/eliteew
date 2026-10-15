# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Regression tests for AMKA segment mutation link resolution via project DB lookup.
# Invariants:
# - Corrupted LLM UUID strings must not reach SegmentUpdateRequest unchanged.
# - Title/name fields resolve to project entity ids; update must not wipe links on bad ids alone.
# Related:
# - api/services/marketing_cabinet/amka_mutation_service.py
# ---
"""AMKA segment mutation: DB-backed linked_job_story / competitor resolution."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4

import pytest

from api.services.marketing_cabinet.amka_mutation_service import (
    _apply_resolved_segment_link_field,
    _coerce_uuid_candidates,
    _merge_uuid_lists,
    _resolve_segment_mutation_payload,
    _try_parse_uuid,
)


@pytest.mark.unit
def test_try_parse_uuid_strips_nbsp_and_whitespace() -> None:
    raw = "c2d70e3\xa03-d2d5-480f-909c-9a365b3e7fca"
    parsed = _try_parse_uuid(raw)
    assert parsed == UUID("c2d70e33-d2d5-480f-909c-9a365b3e7fca")


@pytest.mark.unit
def test_coerce_uuid_candidates_skips_unparseable_values() -> None:
    assert _coerce_uuid_candidates(["not-a-uuid", ""]) == []
    uid = uuid4()
    assert _coerce_uuid_candidates([str(uid), f" {uid} "]) == [uid]


@pytest.mark.unit
def test_apply_resolved_segment_link_field_update_skips_corrupted_ids_only() -> None:
    cleaned: dict[str, object] = {"name": "Seg"}
    _apply_resolved_segment_link_field(
        cleaned,
        field_name="linked_job_story_ids",
        original_payload={"linked_job_story_ids": ["c2d70e3\xa03-d2d5-480f-909c-9a365b3e7fca"]},
        for_create=False,
        title_resolved=[],
        verified_ids=[],
        titles_provided=False,
        raw_ids_provided=True,
    )
    assert "linked_job_story_ids" not in cleaned


@pytest.mark.unit
def test_apply_resolved_segment_link_field_create_clears_when_only_corrupted_ids() -> None:
    cleaned: dict[str, object] = {"name": "Seg"}
    _apply_resolved_segment_link_field(
        cleaned,
        field_name="linked_job_story_ids",
        original_payload={"linked_job_story_ids": ["broken"]},
        for_create=True,
        title_resolved=[],
        verified_ids=[],
        titles_provided=False,
        raw_ids_provided=True,
    )
    assert cleaned["linked_job_story_ids"] == []


@pytest.mark.asyncio
async def test_resolve_segment_mutation_payload_resolves_titles_via_db() -> None:
    job_id = uuid4()
    pool = MagicMock()
    pool.acquire.return_value.__aenter__ = AsyncMock(return_value=MagicMock())
    pool.acquire.return_value.__aexit__ = AsyncMock(return_value=False)

    with (
        patch(
            "api.services.marketing_cabinet.amka_mutation_service._build_lookup_indexes",
            new=AsyncMock(
                return_value={
                    "jobs": {"saved jtbd": str(job_id)},
                    "segments": {},
                    "competitors": {},
                    "value_props": {},
                }
            ),
        ),
        patch(
            "api.services.marketing_cabinet.amka_mutation_service._filter_ids_for_project",
            new=AsyncMock(return_value=[]),
        ),
    ):
        out = await _resolve_segment_mutation_payload(
            pool,
            project_id=uuid4(),
            payload={"linked_job_story_titles": ["Saved JTBD"]},
            for_create=True,
        )

    assert out["linked_job_story_ids"] == [job_id]


@pytest.mark.asyncio
async def test_resolve_segment_mutation_payload_merges_titles_and_verified_ids() -> None:
    title_job_id = uuid4()
    verified_job_id = uuid4()
    pool = MagicMock()
    pool.acquire.return_value.__aenter__ = AsyncMock(return_value=MagicMock())
    pool.acquire.return_value.__aexit__ = AsyncMock(return_value=False)

    with (
        patch(
            "api.services.marketing_cabinet.amka_mutation_service._build_lookup_indexes",
            new=AsyncMock(
                return_value={
                    "jobs": {"jtbd a": str(title_job_id)},
                    "segments": {},
                    "competitors": {},
                    "value_props": {},
                }
            ),
        ),
        patch(
            "api.services.marketing_cabinet.amka_mutation_service._filter_ids_for_project",
            new=AsyncMock(return_value=[verified_job_id]),
        ),
    ):
        out = await _resolve_segment_mutation_payload(
            pool,
            project_id=uuid4(),
            payload={
                "linked_job_story_titles": ["JTBD A"],
                "linked_job_story_ids": [str(verified_job_id)],
            },
            for_create=True,
        )

    assert _merge_uuid_lists([title_job_id], [verified_job_id]) == out["linked_job_story_ids"]


@pytest.mark.asyncio
async def test_resolve_segment_mutation_payload_update_omits_corrupted_job_ids() -> None:
    pool = MagicMock()
    pool.acquire.return_value.__aenter__ = AsyncMock(return_value=MagicMock())
    pool.acquire.return_value.__aexit__ = AsyncMock(return_value=False)

    with (
        patch(
            "api.services.marketing_cabinet.amka_mutation_service._build_lookup_indexes",
            new=AsyncMock(return_value={"jobs": {}, "segments": {}, "competitors": {}, "value_props": {}}),
        ),
        patch(
            "api.services.marketing_cabinet.amka_mutation_service._filter_ids_for_project",
            new=AsyncMock(return_value=[]),
        ),
    ):
        out = await _resolve_segment_mutation_payload(
            pool,
            project_id=uuid4(),
            payload={"linked_job_story_ids": ["c2d70e3\xa03-d2d5-480f-909c-9a365b3e7fca"], "name": "Seg"},
            for_create=False,
        )

    assert out["name"] == "Seg"
    assert "linked_job_story_ids" not in out
