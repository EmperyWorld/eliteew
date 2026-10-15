"""Blueprint assembly cleanup tests."""

from __future__ import annotations

import pytest

pytest.importorskip("sqlalchemy")

from api.services.desktop_chat_ensemble.blueprint.assemble import assemble_document
from api.services.desktop_chat_ensemble.blueprint.catalog import (
    DocumentOutlineSection,
    PlanStep,
    PlanTemplate,
)


def test_assemble_document_strips_repeated_outline_heading_from_step_body() -> None:
    template = PlanTemplate(
        schema_version=1,
        id="demo",
        version=1,
        title="Demo",
        description="",
        slots={},
        steps=[
            PlanStep(
                step_id="bp1",
                title="Резюме проекта и ключевые допущения",
                instruction_for_model="",
                required_slots={},
            )
        ],
        document_outline=[DocumentOutlineSection(heading="Резюме", step_ids=["bp1"])],
        max_steps_per_hero=1,
        allow_mermaid=False,
    )
    assembled = assemble_document(
        template,
        {"bp1": "Резюме\n#\nКлючевая мысль без дубля заголовка."},
    )
    assert assembled == "## Резюме\n\nКлючевая мысль без дубля заголовка."


def test_assemble_document_strips_template_title_and_partial_step_heading() -> None:
    template = PlanTemplate(
        schema_version=1,
        id="demo",
        version=1,
        title="Бизнес-план",
        description="",
        slots={},
        steps=[
            PlanStep(
                step_id="bp1",
                title="Резюме проекта и ключевые допущения",
                instruction_for_model="",
                required_slots={},
            )
        ],
        document_outline=[DocumentOutlineSection(heading="Резюме", step_ids=["bp1"])],
        max_steps_per_hero=1,
        allow_mermaid=False,
    )
    assembled = assemble_document(
        template,
        {"bp1": "## Бизнес-план запуска проекта\n### Резюме проекта\nКлючевая мысль."},
    )
    assert assembled == "## Резюме\n\nКлючевая мысль."
