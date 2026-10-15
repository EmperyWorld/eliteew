# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Regression tests for AMKA source_ref materialization (IMC run UUID and type_key fallback).
# Invariants:
# - Invalid source_ref.id must not crash execute phase with ValueError.
# Related:
# - api/services/marketing_cabinet/amka_source_resolver.py
# ---

from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from api.services.marketing_cabinet.amka_service_support import (
    normalize_amka_imc_source_type,
    parse_amka_uuid,
)
from api.services.marketing_cabinet.amka_source_resolver import AmkaSourceResolver


@pytest.mark.unit
def test_parse_amka_uuid_strips_prefix_and_whitespace() -> None:
    run_id = uuid4()
    raw = f"  imc_run:{run_id}  "
    assert parse_amka_uuid(raw) == run_id


@pytest.mark.unit
def test_parse_amka_uuid_rejects_type_key() -> None:
    assert parse_amka_uuid("deep_market_research") is None


@pytest.mark.unit
def test_normalize_amka_imc_source_type_aliases() -> None:
    assert normalize_amka_imc_source_type("imc") == "imc_run"
    assert normalize_amka_imc_source_type("imc_research_run") == "imc_run"
    assert normalize_amka_imc_source_type("unified_content") == "unified_content"


@pytest.mark.unit
def test_materialize_source_ref_invalid_id_returns_none() -> None:
    async def _run() -> None:
        conn = AsyncMock()
        conn.fetchrow = AsyncMock(return_value=None)
        acquire_cm = MagicMock()
        acquire_cm.__aenter__ = AsyncMock(return_value=conn)
        acquire_cm.__aexit__ = AsyncMock(return_value=False)
        pool = MagicMock()
        pool.acquire.return_value = acquire_cm

        resolver = AmkaSourceResolver(pool)
        pid, uid = uuid4(), uuid4()
        out = await resolver.materialize_source_ref(
            project_id=pid,
            user_id=uid,
            source_ref={"type": "imc_run", "id": "deep_market_research"},
        )
        assert out is None
        conn.fetchrow.assert_awaited_once()

    asyncio.run(_run())


@pytest.mark.unit
def test_materialize_source_ref_resolves_type_key_fallback() -> None:
    async def _run() -> None:
        run_id = uuid4()
        pid, uid = uuid4(), uuid4()
        conn = AsyncMock()
        conn.fetchrow = AsyncMock(return_value={"id": run_id})
        acquire_cm = MagicMock()
        acquire_cm.__aenter__ = AsyncMock(return_value=conn)
        acquire_cm.__aexit__ = AsyncMock(return_value=False)
        pool = MagicMock()
        pool.acquire.return_value = acquire_cm

        created = MagicMock()
        created.content_id = str(uuid4())

        with patch(
            "api.services.marketing_cabinet.amka_source_resolver.upsert_imc_run_as_project_rag_content",
            new_callable=AsyncMock,
            return_value=created,
        ) as upsert_mock:
            resolver = AmkaSourceResolver(pool)
            out = await resolver.materialize_source_ref(
                project_id=pid,
                user_id=uid,
                source_ref={"type": "imc_run", "id": "deep_market_research", "title": "Research"},
            )

        assert out is not None
        assert out["id"] == str(run_id)
        assert out["content_id"] == created.content_id
        upsert_mock.assert_awaited_once()
        upsert_call = upsert_mock.await_args
        assert upsert_call is not None
        assert upsert_call.kwargs["imc_research_run_id"] == run_id

    asyncio.run(_run())
