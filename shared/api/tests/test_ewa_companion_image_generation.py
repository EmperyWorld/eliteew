# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Contract tests for companion image generation intent and prompt extraction.
# Related:
# - api/ewa_platform/companion/orchestration/companion_image_generation.py
# ---

from __future__ import annotations

import pytest

from api.ewa_platform.companion.orchestration.companion_image_generation import (
    IMAGE_TOOL_MODE_EDIT,
    extract_image_edit_prompt,
    extract_image_prompt,
    extract_source_content_id,
    resolve_companion_image_operation_mode,
    user_line_requests_attachment_image_edit,
    user_line_requests_image_edit,
    user_line_requests_image_generation,
)


@pytest.mark.parametrize(
    ("line", "expected"),
    [
        ("нарисуй закат над морем", True),
        ("сгенерируй картинку космический корабль", True),
        ("generate an image: cute cat", True),
        ("draw me a picture of mountains", True),
        ("измени изображение uc=aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee: убери фон", True),
        ("опиши картинку на экране", False),
        ("привет", False),
    ],
)
def test_user_line_requests_image_generation(line: str, expected: bool) -> None:
    assert user_line_requests_image_generation(line) is expected


def test_extract_image_prompt_from_imperative_ru() -> None:
    prompt = extract_image_prompt("нарисуй закат над морем с парусником")
    assert "закат" in prompt.lower()


def test_extract_image_prompt_prefers_args() -> None:
    prompt = extract_image_prompt("нарисуй что-то", {"prompt": "neon city skyline"})
    assert prompt == "neon city skyline"


def test_workflow_trigger_phrase_uses_template_prompt_not_user_line() -> None:
    assert user_line_requests_image_generation("делаем дела") is False
    prompt = extract_image_prompt("делаем дела", {"prompt": "закат над городом"})
    assert prompt == "закат над городом"


def test_image_edit_mode_resolves_source_and_prompt() -> None:
    line = "измени изображение uc=aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee: убери фон"

    assert user_line_requests_image_edit(line) is True
    assert user_line_requests_attachment_image_edit("убери фон") is True
    assert resolve_companion_image_operation_mode(line) == IMAGE_TOOL_MODE_EDIT
    assert extract_source_content_id(user_line=line) == "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
    assert extract_image_edit_prompt(line) == "убери фон"


def test_image_analysis_phrase_does_not_trigger_generation_or_edit() -> None:
    line = "опиши картинку пожалуйста"

    assert user_line_requests_image_generation(line) is False
    assert user_line_requests_image_edit(line) is False
    assert user_line_requests_attachment_image_edit(line) is False
