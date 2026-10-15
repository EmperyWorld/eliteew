# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Lock AMKA ``_mutation_result`` against Pydantic ``*Out`` models from cabinet routers.
# Invariants:
# - Funnel-shaped BaseModel must not raise AttributeError on ``.get``.
# Related:
# - api/services/marketing_cabinet/amka_mutation_service.py
# ---
from __future__ import annotations

from unittest.mock import MagicMock
from uuid import uuid4

import pytest
from pydantic import BaseModel, Field

from api.services.marketing_cabinet.amka_mutation_service import AmkaMutationService, _as_mutation_snapshot


class _FunnelOutStub(BaseModel):
    id: str
    title: str = "Funnel"
    status: str | None = "draft"
    primary_goal: str | None = None
    stages: list[dict[str, object]] = Field(default_factory=list)


@pytest.mark.unit
def test_as_mutation_snapshot_accepts_dict_and_pydantic() -> None:
    d = {"id": "a", "title": "t"}
    assert _as_mutation_snapshot(d) is d
    model = _FunnelOutStub(id=str(uuid4()), title="Sales")
    snap = _as_mutation_snapshot(model)
    assert snap["id"] == model.id
    assert snap["title"] == "Sales"


@pytest.mark.unit
def test_mutation_result_with_funnel_out_model() -> None:
    svc = AmkaMutationService(MagicMock())
    funnel_id = str(uuid4())
    item = _FunnelOutStub(id=funnel_id, title="Main funnel", status="active")
    result = svc._mutation_result("funnel", item)
    assert result["status"] == "completed"
    assert result["mutated_entity_ids"] == [funnel_id]
    assert result["applied_entities"][0]["entity_id"] == funnel_id
    assert result["applied_entities"][0]["title"] == "Main funnel"


@pytest.mark.unit
def test_as_mutation_snapshot_rejects_unknown_type() -> None:
    with pytest.raises(TypeError, match="expected dict or pydantic"):
        _as_mutation_snapshot(object())
