# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Regression tests for IMC provider routing invariants and legacy successor helpers.
# Guards RAG-only research flows from being routed through generic chat providers.
# Invariants:
# - Startup validation must detect legacy IMC rows on generic providers.
# - Deprecated IMC type keys keep explicit successor mappings.
# Related:
# - api.services.imc.generation_type_provider_invariant
# - api.services.imc.imc_legacy_type_successors
# ---
"""IMC provider repair helpers, legacy successor map, unified_config port validation."""

from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, MagicMock

from api.core.unified_config import get_unified_settings
from api.services.imc.generation_type_provider_invariant import validate_imc_miso_provider_assignments
from api.services.imc.imc_errors import ImcDeprecatedTypeKeyError
from api.services.imc.imc_legacy_type_successors import (
    LEGACY_IMC_TYPE_SUCCESSORS,
    successor_for_deprecated_imc_type,
)


def test_legacy_imc_successor_map_contains_gtm_channels() -> None:
    assert successor_for_deprecated_imc_type("imc_gtm_channels") == "imc_rag_channel_partner_rf"
    assert successor_for_deprecated_imc_type("imc_rag_deep_market_showcase") == "imc_rag_cabinet_analysis"
    assert successor_for_deprecated_imc_type("imc_rag_stakeholder_decision_raci") == "imc_rag_cabinet_analysis"
    assert successor_for_deprecated_imc_type("imc_rag_brand_identity_compliance") == "imc_rag_positioning_messaging"
    assert successor_for_deprecated_imc_type("unknown") is None
    assert "imc_brand_positioning" in LEGACY_IMC_TYPE_SUCCESSORS


def test_imc_deprecated_error_exposes_keys() -> None:
    err = ImcDeprecatedTypeKeyError(
        deprecated_type_key="imc_gtm_channels",
        successor_type_key="imc_rag_trends_signals",
    )
    assert err.deprecated_type_key == "imc_gtm_channels"
    assert err.successor_type_key == "imc_rag_trends_signals"
    assert "imc_gtm_channels" in str(err)


def test_validate_configuration_has_port_duplicate_fields() -> None:
    r = get_unified_settings().validate_configuration()
    assert isinstance(r.get("duplicated_external_ports"), list)
    assert "validation_passed" in r


def test_validate_imc_miso_assignments_queries_fetch() -> None:
    pool = MagicMock()
    conn = MagicMock()
    pool.acquire.return_value.__aenter__ = AsyncMock(return_value=conn)
    pool.acquire.return_value.__aexit__ = AsyncMock(return_value=None)
    conn.fetch = AsyncMock(return_value=[])

    out = asyncio.run(validate_imc_miso_provider_assignments(pool))  # type: ignore[arg-type]
    assert out == []
    conn.fetch.assert_awaited_once()


def test_validate_imc_miso_assignments_detects_generic_provider_rows() -> None:
    pool = MagicMock()
    conn = MagicMock()
    pool.acquire.return_value.__aenter__ = AsyncMock(return_value=conn)
    pool.acquire.return_value.__aexit__ = AsyncMock(return_value=None)
    conn.fetch = AsyncMock(
        return_value=[
            {"type_key": "imc_audience_deep_dive"},
            {"type_key": "imc_cabinet_filler"},
        ]
    )

    out = asyncio.run(validate_imc_miso_provider_assignments(pool))  # type: ignore[arg-type]

    assert out == ["imc_audience_deep_dive", "imc_cabinet_filler"]
    query = conn.fetch.await_args.args[0]
    assert "imc_cabinet_filler_provider" in query
