from __future__ import annotations

import pytest

from api.services.marketing_cabinet.amka_section_mapping import (
    AMKA_SECTION_TO_AUTOFILL_TARGET_VALUES,
    autofill_target_values_for_section,
    default_execution_mode_for_section,
)


@pytest.mark.unit
def test_value_section_maps_to_value_propositions() -> None:
    assert AMKA_SECTION_TO_AUTOFILL_TARGET_VALUES["value"] == ("value_propositions",)


@pytest.mark.unit
def test_analysis_maps_swot_and_competitors() -> None:
    assert autofill_target_values_for_section("analysis") == ["swot", "competitors"]


@pytest.mark.unit
def test_default_execution_modes() -> None:
    assert default_execution_mode_for_section("evidence") == "mutation_service"
    assert default_execution_mode_for_section("jtbd") == "project_generate_async"


@pytest.mark.unit
def test_imc_default_execution_is_imc_research() -> None:
    assert default_execution_mode_for_section("imc") == "imc_research"
