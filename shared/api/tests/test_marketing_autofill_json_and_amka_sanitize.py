# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Regression tests for marketing autofill JSON handling, AMKA sanitize helpers, and final-report cleanup.
# Invariants:
# - Preview parsing must preserve structured JSON while rejecting invalid model output.
# - AMKA final-report tests guard canonical facts from duplicated model echoes.
# Related:
# - api/routers/marketing_cabinet/document_autofill.py
# - api/services/marketing_cabinet/amka_phase_finalize.py
# ---
"""Regression tests: marketing JSON extract, AMKA finalize sanitize, IMC dedupe, segment link merge."""

from __future__ import annotations

import asyncio
import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException, status

from api.routers.marketing_cabinet.common import extract_json_payload
from api.routers.marketing_cabinet.document_autofill import (
    AutofillTarget,
    _build_preview_result_payload,
    _coerce_parsed_payload,
    sanitize_generated_duplicate_markers,
    sanitize_jtbd_generated_text,
)
from api.services.marketing_cabinet.amka_execute_async_helpers import _dedupe_markdown_h2_blocks
from api.services.marketing_cabinet.amka_mutation_service import (
    _merge_segment_autofill_preview_links,
    _sanitize_generated_preview_payload,
)
from api.services.marketing_cabinet.amka_phase_finalize import (
    _compose_final_summary_markdown,
    _finalize_assessment_model_markdown,
    _strip_final_model_part_echoes,
)


def test_extract_json_payload_fenced() -> None:
    raw = 'Пояснение\n```json\n{"summary": "x", "warnings": [], "items": []}\n```\nхвост'
    parsed = extract_json_payload(raw)
    assert parsed == {"summary": "x", "warnings": [], "items": []}


def test_extract_json_payload_balanced_with_trailing_noise() -> None:
    inner = '{"summary": "ok", "warnings": [], "items": [{"name": "Seg", "segment_type": "icp", "status": "draft"}]}'
    raw = f"prefix text {inner} trailing prose {{\n  broken"
    parsed = extract_json_payload(raw)
    assert isinstance(parsed, dict)
    assert parsed.get("summary") == "ok"


def test_extract_json_payload_strips_double_slash_comments_in_items() -> None:
    raw = r"""```json
{
  "summary": "s",
  "warnings": [],
  "items": [
    {
      "headline": "H",
      "value_statement": "long enough value statement here",
      "job_story_ids": ["0a711a30-f732-44b0-8e40-28b5032a05fd"],
      "job tail=les": []
    }
    // trailing comment inside array
  ]
}
```"""
    parsed = extract_json_payload(raw)
    assert isinstance(parsed, dict)
    assert parsed.get("summary") == "s"
    assert len(parsed.get("items") or []) == 1
    item = parsed["items"][0]
    assert item.get("headline") == "H"
    assert "job tail=les" in item


def test_extract_json_payload_preserves_url_slashes_inside_string() -> None:
    raw = (
        '{"summary": "x", "warnings": [], "items": [{"name": "C", "website": "https://example.com/path", '
        '"description": "d", "competitor_type": "direct", "strengths": [], "weaknesses": []}]}'
    )
    parsed = extract_json_payload(raw)
    assert isinstance(parsed, dict)
    assert parsed["items"][0]["website"] == "https://example.com/path"


def test_extract_json_payload_trailing_comma_in_items() -> None:
    raw = '{"summary": "t", "warnings": [], "items": [{"x": 1},],}'
    parsed = extract_json_payload(raw)
    assert parsed["items"] == [{"x": 1}]


def test_extract_json_payload_block_comment_outside_strings() -> None:
    raw = '{"summary": "s", /* c */ "warnings": [], "items": []}'
    parsed = extract_json_payload(raw)
    assert parsed == {"summary": "s", "warnings": [], "items": []}


def test_coerce_parsed_payload_dict() -> None:
    summary, warnings, items = _coerce_parsed_payload(
        '{"summary": "s", "warnings": ["w"], "items": [{"x": 1}]}',
        log_context={"test": True},
    )
    assert summary == "s"
    assert warnings == ["w"]
    assert items == [{"x": 1}]


def test_coerce_parsed_payload_accepts_funnel_alias_root() -> None:
    summary, warnings, items = _coerce_parsed_payload(
        '{"summary": "s", "funnels": [{"title": "Воронка", "funnel_steps": [{"title": "Lead"}]}]}',
        target_section=AutofillTarget.FUNNELS,
        log_context={"test": True},
    )
    assert summary == "s"
    assert warnings == []
    assert items == [{"title": "Воронка", "funnel_steps": [{"title": "Lead"}]}]


def test_build_preview_result_payload_normalizes_funnel_steps_alias() -> None:
    payload, _excerpt, _meta = _build_preview_result_payload(
        target_section=AutofillTarget.FUNNELS,
        content_item={"id": "synthetic"},
        raw_output='{"summary": "s", "funnel": {"title": "Воронка лидов", "funnel_steps": [{"title": "Заявка", "visitors": "10"}]}}',
        generation_type_key="test",
    )
    item = payload["preview_items"][0]["payload"]
    assert item["name"] == "Воронка лидов"
    assert item["stages"][0]["stage_name"] == "Заявка"
    assert item["stages"][0]["visitors"] == 10


def test_sanitize_jtbd_generated_text_dedupes_markers() -> None:
    assert sanitize_jtbd_generated_text("Когда Когда рынок шумит") == "Когда рынок шумит"
    assert sanitize_jtbd_generated_text("я хочу я хочу видеть факты") == "я хочу видеть факты"
    assert sanitize_jtbd_generated_text("чтобы чтобы чтобы команда решила") == "чтобы команда решила"


def test_sanitize_generated_preview_payload_dedupes_nested_markers() -> None:
    payload = {
        "preview_items": [
            {
                "payload": {
                    "title": "я хочу я хочу проверить спрос",
                    "metadata": {"evidence": ["чтобы чтобы команда видела факты"]},
                }
            }
        ]
    }

    sanitized = _sanitize_generated_preview_payload(payload)

    assert sanitize_generated_duplicate_markers("Когда Когда рынок шумит") == "Когда рынок шумит"
    assert sanitized["preview_items"][0]["payload"]["title"] == "я хочу проверить спрос"
    assert sanitized["preview_items"][0]["payload"]["metadata"]["evidence"] == ["чтобы команда видела факты"]


def test_coerce_parsed_payload_invalid_logs_and_raises() -> None:
    with pytest.raises(HTTPException) as ei:
        _coerce_parsed_payload("not json at all {{{", log_context={"route": "test"})
    assert ei.value.status_code == status.HTTP_502_BAD_GATEWAY


def test_dedupe_markdown_h2_blocks() -> None:
    md = "## Раздел A\nbody1\n\n## Раздел B\nx\n\n## Раздел A\ndup\n\n## Раздел B\ny"
    out = _dedupe_markdown_h2_blocks(md)
    assert out.count("## Раздел A") == 1
    assert out.count("## Раздел B") == 1
    assert "dup" not in out


def test_strip_final_model_part_echoes() -> None:
    echo = "## Фактический результат по этапам выполнения\n- dup\n\n## Итог\nok"
    assert "Фактический результат" not in _strip_final_model_part_echoes(echo)
    assert _strip_final_model_part_echoes("## Итог\nтолько это") == "## Итог\nтолько это"


def test_strip_final_model_part_echoes_duplicate_h2_summary_and_bracket_garbage() -> None:
    model_tail = (
        "## Итоговая сводка\nкороткий вывод без эха\n\n"
        "---\n\n]\n\n## Сводка по данным\n- дубликат\n\n"
        "## По каждому шагу\n- ещё дубликат"
    )
    out = _strip_final_model_part_echoes(model_tail)
    assert "Сводка по данным" not in out
    assert "По каждому шагу" not in out
    assert "короткий вывод" in out


def test_strip_final_model_part_echoes_strips_italic_canonical_hint() -> None:
    blob = "## Выводы\nПроект закрыт.\n\n*Ниже — текстовая сводка модели (может обобщать); блок выше — по полям шагов и метрикам бэкенда.*\n\nмусор"
    out = _strip_final_model_part_echoes(blob)
    assert out.rstrip() == "## Выводы\nПроект закрыт."


def test_strip_final_model_part_echoes_b45626e5_orphan_h2_before_facts_echo() -> None:
    """Дубликат «## Итоговая сводка» сразу перед эхо «## Фактический результат…» — хвост заголовка снимается."""
    model = (
        "## Итоговая сводка\n\n"
        "Корректный абзац интерпретации.\n\n"
        "## Итоговая сводка\n\n"
        "## Фактический результат по этапам выполнения\n\n"
        "- шаг 1: дубликат канона\n"
        "- шаг 2: ещё строки эха\n"
    )
    out = _strip_final_model_part_echoes(model)
    assert "## Фактический результат" not in out
    assert out.endswith("Корректный абзац интерпретации.")
    assert out.count("## Итоговая сводка") == 1


def test_strip_final_model_part_echoes_preserves_summary_without_facts_echo() -> None:
    """Без эхо канона блок «## Итоговая сводка» + текст не обнуляется."""
    model = "## Итоговая сводка\n\nПараграф только интерпретации."
    assert _strip_final_model_part_echoes(model) == model


def test_finalize_assessment_model_markdown_failed_ops_note() -> None:
    summaries = [{"operations_failed": 1}]
    out = _finalize_assessment_model_markdown("## Вывод\nВсё хорошо.", summaries)
    assert "Примечание" in out
    assert "ошибк" in out.lower()


def test_compose_final_summary_markdown_separates_model_commentary() -> None:
    out = _compose_final_summary_markdown("## Факты\n- ok", "Короткий вывод")
    assert out.count("## Факты") == 1
    assert out.count("## Комментарий модели") == 1
    assert "Короткий вывод" in out


def test_merge_segment_autofill_preview_links() -> None:
    job_id = uuid.uuid4()
    conn = MagicMock()
    conn.fetchrow = AsyncMock(
        return_value={
            "linked_job_story_ids": [job_id],
            "linked_competitor_ids": [],
        }
    )
    conn.fetch = AsyncMock(
        return_value=[{"t": "Сохранённый JTBD"}],
    )

    class _Acquire:
        async def __aenter__(self) -> MagicMock:
            return conn

        async def __aexit__(self, *a: object) -> bool:
            return False

    pool = MagicMock()
    pool.acquire = MagicMock(return_value=_Acquire())

    payload: dict = {
        "preview_items": [
            {
                "payload": {
                    "linked_job_story_titles": [],
                    "linked_competitor_names": [],
                }
            }
        ]
    }

    async def _run() -> None:
        await _merge_segment_autofill_preview_links(
            pool,
            project_id=uuid.uuid4(),
            replace_entity_id=str(uuid.uuid4()),
            result_payload=payload,
        )

    asyncio.run(_run())
    pl = payload["preview_items"][0]["payload"]
    assert pl["linked_job_story_titles"] == ["Сохранённый JTBD"]
