# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Unit checks for AMKA mutation service: research/evidence entity_type synonyms and catalog support.
# Invariants:
# - No live DB: AmkaMutationService with MagicMock pool only where applicable.
# Related:
# - api/services/marketing_cabinet/amka_mutation_service.py
# ---
from __future__ import annotations

from unittest.mock import MagicMock

import pytest

from api.services.marketing_cabinet.amka_mutation_service import AmkaMutationService


@pytest.mark.unit
def test_supports_operation_evidence_document_alias() -> None:
    svc = AmkaMutationService(MagicMock())
    assert svc.supports_operation({"kind": "create", "entity_type": "evidence_document"})
    assert svc.supports_operation({"kind": "update", "entity_type": "evidence_document"})
    assert svc.supports_operation({"kind": "delete", "entity_type": "evidence_document"})


@pytest.mark.unit
def test_supports_operation_research_entity() -> None:
    svc = AmkaMutationService(MagicMock())
    assert svc.supports_operation({"kind": "create", "entity_type": "research"})
