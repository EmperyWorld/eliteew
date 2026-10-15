# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Unit tests for user workflow validation and builder surface intents.
# Related:
# - api/ewa_platform/companion/workflows/user/user_workflow_validation.py
# - api/ewa_platform/companion/workflows/user/user_workflow_builder.py
# ---

from __future__ import annotations

from api.ewa_platform.companion.workflows.user.user_workflow_allowlist import (
    USER_WORKFLOW_ALLOWED_TOOLS,
    USER_WORKFLOW_TOOL_CATALOG,
    sanitize_user_workflow_args,
)
from api.ewa_platform.companion.workflows.user.user_workflow_builder import (
    answer_workflow_surface_intent,
    user_line_requests_workflow_builder,
)
from api.ewa_platform.companion.workflows.user.user_workflow_validation import (
    UserWorkflowCreateInV1,
    UserWorkflowStepInV1,
    UserWorkflowTriggerPhraseV1,
    analyze_user_workflow,
    build_user_workflow_definition,
    validate_user_workflow_payload,
)


def test_user_line_requests_workflow_builder_ru() -> None:
    assert user_line_requests_workflow_builder("создай цепочку действий")


def test_answer_workflow_surface_intent_builder_mode() -> None:
    out = answer_workflow_surface_intent("создай цепочку действий")
    assert out is not None
    assert out["output_surface"]["mode"] == "workflow_dag_builder"


def test_build_user_workflow_definition_phrase_trigger() -> None:
    body = UserWorkflowCreateInV1(
        name="Утро",
        trigger=UserWorkflowTriggerPhraseV1(patterns=["запиши трек"]),
        steps=[
            UserWorkflowStepInV1(
                tool_name="app_open",
                args_template={"app_component": "MusicGenerator", "evil": "x"},
            )
        ],
    )
    assert not validate_user_workflow_payload(body)
    wf = build_user_workflow_definition(
        workflow_id="user_test",
        name=body.name,
        trigger=body.trigger,
        steps=body.steps,
    )
    assert wf.triggers[0].type == "regex"
    assert wf.steps[0].tool_name == "app_open"
    assert wf.steps[0].step_kind == "tool_dispatch"
    assert wf.steps[0].args_template.get("app_component") == "MusicGenerator"
    assert "evil" not in wf.steps[0].args_template


def test_validate_rejects_forbidden_tool() -> None:
    import pytest

    with pytest.raises(ValueError):
        UserWorkflowStepInV1(tool_name="image_tool")


def test_tool_catalog_has_rich_entries() -> None:
    assert len(USER_WORKFLOW_TOOL_CATALOG) >= 20
    by_name = {entry["name"]: entry for entry in USER_WORKFLOW_TOOL_CATALOG}
    assert "music_studio_open" in by_name
    assert "catalog_list" in by_name
    assert "presentation_generation" in by_name
    assert "file_delete" in by_name
    assert "social_post_compose" in by_name
    assert "operations_status" in by_name
    assert "file_rewrite" in by_name
    assert "plan_v1" in by_name
    assert "llm_summarize" in by_name
    assert "pdf_parser" in by_name
    assert "telegram_sender" in by_name
    assert "email_dispatcher" in by_name
    assert "vision_analyze" in by_name
    assert "document_extractor" in by_name
    assert "paperless_import" in by_name
    theme_fields = by_name["theme_set"].get("fields") or []
    assert any(f.get("key") == "theme" for f in theme_fields)


def test_tool_catalog_covers_allowlist() -> None:
    catalog_names = {entry["name"] for entry in USER_WORKFLOW_TOOL_CATALOG}
    missing = USER_WORKFLOW_ALLOWED_TOOLS - catalog_names
    assert missing == set(), f"allowlisted tools missing from catalog UI: {sorted(missing)}"


def test_sanitize_user_workflow_args_strips_unknown_keys() -> None:
    out = sanitize_user_workflow_args(
        "theme_set",
        {"theme": "dark", "user_line": "ignored", "accent": "  blue  "},
    )
    assert out == {"theme": "dark", "accent": "blue"}
    assert "user_line" not in out


def test_sanitize_user_workflow_file_rewrite_and_plan_args() -> None:
    rewrite = sanitize_user_workflow_args(
        "file_rewrite",
        {
            "file_query": "notes.md",
            "rewrite_brief": " summary ",
            "open_editor": "1",
            "user_line": "drop",
        },
    )
    assert rewrite == {
        "file_query": "notes.md",
        "rewrite_brief": "summary",
        "open_editor": "1",
    }
    plan = sanitize_user_workflow_args(
        "plan_v1",
        {"plan_focus": "launch feature", "horizon": "2 недели", "evil": "x"},
    )
    assert plan == {"plan_focus": "launch feature", "horizon": "2 недели"}


def test_analyze_user_workflow_warnings_async_order() -> None:
    body = UserWorkflowCreateInV1(
        name="Test",
        trigger=UserWorkflowTriggerPhraseV1(patterns=["ok"]),
        steps=[
            UserWorkflowStepInV1(tool_name="music_generation"),
            UserWorkflowStepInV1(tool_name="catalog_list"),
        ],
    )
    analysis = analyze_user_workflow(body)
    assert analysis.ok is True
    assert analysis.execution_mode == "async"
    assert "trigger_phrase_too_vague" in analysis.warnings
    assert "sync_step_after_async" in analysis.warnings
    assert len(analysis.preview_steps) == 2
    assert analysis.preview_steps[0].async_step is True


def test_analyze_user_workflow_missing_recommended_fields() -> None:
    body = UserWorkflowCreateInV1(
        name="Apps",
        trigger=UserWorkflowTriggerPhraseV1(patterns=["open my tools"]),
        steps=[UserWorkflowStepInV1(tool_name="app_open", args_template={})],
    )
    analysis = analyze_user_workflow(body)
    assert any("missing_recommended" in w for w in analysis.warnings)
    assert analysis.preview_steps[0].missing_recommended_fields == ["app_component"]


def test_analyze_user_workflow_missing_required_fields() -> None:
    body = UserWorkflowCreateInV1(
        name="Discuss",
        trigger=UserWorkflowTriggerPhraseV1(patterns=["discuss file"]),
        steps=[UserWorkflowStepInV1(tool_name="catalog_discuss", args_template={})],
    )
    analysis = analyze_user_workflow(body)
    assert analysis.ok is False
    assert analysis.errors == ["step_1_missing_required:file_query"]


def test_analyze_user_workflow_check_task_status_requires_run_id() -> None:
    body = UserWorkflowCreateInV1(
        name="Poll",
        trigger=UserWorkflowTriggerPhraseV1(patterns=["poll status"]),
        steps=[UserWorkflowStepInV1(tool_name="check_task_status", args_template={})],
    )
    analysis = analyze_user_workflow(body)
    assert analysis.ok is False
    assert analysis.errors == ["step_1_missing_required:run_id"]


def test_sanitize_user_workflow_image_edit_args() -> None:
    sanitized = sanitize_user_workflow_args(
        "image_generation",
        {
            "prompt": " add logo ",
            "image_tool_mode": "edit",
            "source_unified_content_id": "abc-123",
            "noise": "drop",
        },
    )
    assert sanitized == {
        "prompt": "add logo",
        "image_tool_mode": "edit",
        "source_unified_content_id": "abc-123",
    }


def test_build_user_workflow_definition_confirm_gate_step() -> None:
    body = UserWorkflowCreateInV1(
        name="Confirm",
        trigger=UserWorkflowTriggerPhraseV1(patterns=["confirm chain"]),
        steps=[
            UserWorkflowStepInV1(step_kind="confirm_gate"),
            UserWorkflowStepInV1(tool_name="music_studio_open"),
        ],
    )
    wf = build_user_workflow_definition(
        workflow_id="user_confirm",
        name=body.name,
        trigger=body.trigger,
        steps=body.steps,
    )
    assert wf.steps[0].kind == "confirm_gate"
    assert wf.steps[0].step_kind == "confirm_gate"
    assert wf.steps[1].tool_name == "music_studio_open"


def test_sanitize_user_workflow_file_save_text_args() -> None:
    sanitized = sanitize_user_workflow_args(
        "file_save_text",
        {"name": " notes.md ", "body": " hello ", "text": "ignored", "noise": "x"},
    )
    assert sanitized == {"name": "notes.md", "body": "hello", "text": "ignored"}


def test_analyze_user_workflow_file_save_text_requires_body() -> None:
    body = UserWorkflowCreateInV1(
        name="Save",
        trigger=UserWorkflowTriggerPhraseV1(patterns=["save notes"]),
        steps=[UserWorkflowStepInV1(tool_name="file_save_text", args_template={"name": "notes.md"})],
    )
    analysis = analyze_user_workflow(body)
    assert analysis.ok is False
    assert analysis.errors == ["step_1_missing_required:body"]
