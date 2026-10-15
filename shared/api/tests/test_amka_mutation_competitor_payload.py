"""AMKA competitor mutation payload routing and normalization."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from api.services.marketing_cabinet.amka_mutation_service import (
    AmkaMutationService,
    _is_project_autofill_operation,
    _normalize_competitor_mutation_payload,
)


@pytest.mark.unit
def test_is_project_autofill_operation_accepts_autofill_target_without_mode() -> None:
    assert _is_project_autofill_operation({"autofill_target": "competitors"}, {}) is True
    assert _is_project_autofill_operation({}, {"autofill_target": "competitors"}) is True
    assert _is_project_autofill_operation({"mode": "project_autofill"}, {}) is True
    assert _is_project_autofill_operation({"name": "Acme"}, {}) is False


@pytest.mark.unit
def test_normalize_competitor_mutation_payload_maps_title_and_strips_meta() -> None:
    out = _normalize_competitor_mutation_payload(
        {
            "title": "Acme Corp",
            "autofill_target": "competitors",
            "project_id": str(uuid4()),
            "mode": "project_autofill",
        }
    )
    assert out["name"] == "Acme Corp"
    assert "autofill_target" not in out
    assert "project_id" not in out
    assert "title" not in out


@pytest.mark.unit
def test_normalize_competitor_mutation_payload_fallback_name_for_create() -> None:
    out = _normalize_competitor_mutation_payload({"description": "x"})
    assert out["name"] == "Конкурент (AMKA)"


@pytest.mark.asyncio
async def test_execute_operation_routes_competitor_autofill_without_mode() -> None:
    service = AmkaMutationService(MagicMock())
    project_id = uuid4()
    user_id = uuid4()

    with patch.object(
        service,
        "_execute_autofill_operation",
        new=AsyncMock(return_value={"status": "completed", "applied_entities": []}),
    ) as autofill_mock:
        result = await service._execute_operation(
            project_id=project_id,
            user_id=user_id,
            operation={
                "kind": "create",
                "entity_type": "competitor",
                "target_section": "analysis",
                "payload": {"autofill_target": "competitors", "project_id": str(project_id)},
            },
            project_context_text="ctx",
            llm_text=AsyncMock(),
        )

    assert result["status"] == "completed"
    autofill_mock.assert_awaited_once()
