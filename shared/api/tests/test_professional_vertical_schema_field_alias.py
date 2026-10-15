# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Lock ProfessionalVerticalSchema* wire key schema_json without shadowing BaseModel.schema_json.
# Invariants:
# - Importing the models must not emit UserWarning about schema_json field shadow.
# - JSON in/out still uses schema_json; Python attr is schema_body.
# Related:
# - api/schemas/professional_worlds.py
# - api/services/professional_worlds/admin_schemas.py
# ---
from __future__ import annotations

import warnings

import pytest

from api.schemas.professional_worlds import (
    ProfessionalVerticalSchemaCreate,
    ProfessionalVerticalSchemaUpdate,
)


def test_professional_vertical_schema_no_basemodel_schema_json_shadow() -> None:
    with warnings.catch_warnings():
        warnings.simplefilter("error", UserWarning)
        # Re-import path already loaded; constructing subclasses that used schema_json
        # as a field name used to warn at class body time. Round-trip proves aliases.
        created = ProfessionalVerticalSchemaCreate.model_validate(
            {
                "schema_key": "intake",
                "title": "Intake",
                "schema_json": {"type": "object", "properties": {}},
            }
        )
    assert created.schema_body == {"type": "object", "properties": {}}
    dumped = created.model_dump(by_alias=True)
    assert dumped["schema_json"] == {"type": "object", "properties": {}}
    assert "schema_body" not in dumped


def test_professional_vertical_schema_update_alias_merge_keys() -> None:
    patch = ProfessionalVerticalSchemaUpdate.model_validate({"schema_json": {"a": 1}})
    assert patch.schema_body == {"a": 1}
    assert patch.model_dump(exclude_unset=True, by_alias=True) == {"schema_json": {"a": 1}}


def test_professional_vertical_schema_create_rejects_short_key() -> None:
    with pytest.raises(Exception):
        ProfessionalVerticalSchemaCreate.model_validate({"schema_key": "x", "title": "T"})
