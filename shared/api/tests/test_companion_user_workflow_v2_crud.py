# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Unit tests for user workflow v2 DAG create payload (builder_meta round-trip).
# ---

from __future__ import annotations

import uuid

import pytest

from api.ewa_platform.companion.workflows.dag.context import WorkflowValidationContext
from api.ewa_platform.companion.workflows.dag.validation import validate_dag_definition_for_execution
from api.ewa_platform.companion.workflows.user.user_workflow_validation import (
    UserWorkflowCreateInV1,
    UserWorkflowDagBodyV2,
    UserWorkflowTriggerPhraseV1,
    build_user_workflow_definition_v2,
    validate_user_workflow_dag_payload,
)
from api.ewa_platform.schemas.pydantic.companion_workflow_v2 import (
    CompanionWorkflowBuilderMetaNodePositionV2,
    CompanionWorkflowBuilderMetaV2,
    CompanionWorkflowEdgeV2,
    CompanionWorkflowNodeV2,
    CompanionWorkflowOutputSpecV2,
)


def _prompt_node(node_id: str) -> CompanionWorkflowNodeV2:
    return CompanionWorkflowNodeV2(
        id=uuid.UUID(node_id),
        type="prompt_gen",
        mode="stateful",
        inputs={"prompt": "{{turn.user_line}}"},
        outputs={"reply": CompanionWorkflowOutputSpecV2(type="text")},
        title_ru="Prompt",
        title_en="Prompt",
    )


def test_build_user_workflow_definition_v2_preserves_builder_meta() -> None:
    node_id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1"
    dag = UserWorkflowDagBodyV2(
        nodes=[_prompt_node(node_id)],
        edges=[],
        builder_meta=CompanionWorkflowBuilderMetaV2(
            node_positions={
                node_id: CompanionWorkflowBuilderMetaNodePositionV2(x=120.0, y=80.0),
            },
            viewport={"x": 0.0, "y": 0.0, "zoom": 1.0},
        ),
    )
    body = UserWorkflowCreateInV1(
        name="Visual chain",
        trigger=UserWorkflowTriggerPhraseV1(patterns=["run visual chain"]),
        dag=dag,
    )
    definition = build_user_workflow_definition_v2(
        workflow_id="user_visual_chain",
        name=body.name,
        trigger=body.trigger,
        dag=dag,
        enabled=True,
    )
    assert definition.schema_version == 2
    assert definition.builder_meta is not None
    assert node_id in definition.builder_meta.node_positions
    assert definition.builder_meta.node_positions[node_id].x == pytest.approx(120.0)


def test_validate_user_workflow_dag_payload_rejects_orphan_builder_meta_positions() -> None:
    node_id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1"
    orphan_id = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1"
    dag = UserWorkflowDagBodyV2(
        nodes=[_prompt_node(node_id)],
        edges=[],
        builder_meta=CompanionWorkflowBuilderMetaV2(
            node_positions={
                node_id: CompanionWorkflowBuilderMetaNodePositionV2(x=120.0, y=80.0),
                orphan_id: CompanionWorkflowBuilderMetaNodePositionV2(x=10.0, y=10.0),
            },
        ),
    )
    body = UserWorkflowCreateInV1(
        name="Orphan layout",
        trigger=UserWorkflowTriggerPhraseV1(patterns=["orphan layout demo"]),
        dag=dag,
    )
    errors = validate_user_workflow_dag_payload(body, is_verified_user=True)
    assert len(errors) == 1
    assert "builder_meta.node_positions references unknown nodes" in errors[0]


def test_validate_user_workflow_dag_payload_linear_chain() -> None:
    n1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1"
    n2 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2"
    dag = UserWorkflowDagBodyV2(
        nodes=[
            _prompt_node(n1),
            CompanionWorkflowNodeV2(
                id=uuid.UUID(n2),
                type="print_log",
                mode="stateless",
                inputs={"text": f"{{{{{n1}.reply}}}}"},
                outputs={"reply": CompanionWorkflowOutputSpecV2(type="text")},
                title_ru="Log",
                title_en="Log",
            ),
        ],
        edges=[
            CompanionWorkflowEdgeV2(
                source_node_id=uuid.UUID(n1),
                target_node_id=uuid.UUID(n2),
            )
        ],
    )
    body = UserWorkflowCreateInV1(
        name="Two step",
        trigger=UserWorkflowTriggerPhraseV1(patterns=["two step demo"]),
        dag=dag,
    )
    errors = validate_user_workflow_dag_payload(body, is_verified_user=True)
    assert errors == []

    definition = build_user_workflow_definition_v2(
        workflow_id="user_two_step",
        name=body.name,
        trigger=body.trigger,
        dag=dag,
    )
    validation = validate_dag_definition_for_execution(
        definition,
        WorkflowValidationContext(is_verified_user=True),
    )
    assert validation.ok is True
    assert len(validation.ordered_node_ids) == 2
