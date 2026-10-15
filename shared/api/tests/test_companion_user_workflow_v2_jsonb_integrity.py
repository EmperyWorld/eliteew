# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Verify definition_json JSONB contract accepts builder_meta and expanded node config.
# Related:
# - ewa_platform/migrations/applied/015_ewa_companion_user_workflows.sql
# ---

from __future__ import annotations

import json
import uuid

import pytest

from api.ewa_platform.schemas.pydantic.companion_workflow import (
    CompanionWorkflowTriggerV1,
)
from api.ewa_platform.schemas.pydantic.companion_workflow_v2 import (
    CompanionWorkflowBuilderMetaNodePositionV2,
    CompanionWorkflowBuilderMetaV2,
    CompanionWorkflowDefinitionV2,
    CompanionWorkflowEdgeV2,
    CompanionWorkflowNodeConfigV2,
    CompanionWorkflowNodeV2,
    CompanionWorkflowOutputSpecV2,
)


def test_definition_json_round_trip_with_builder_meta_and_node_config() -> None:
    node_id = uuid.UUID("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1")
    node_id_2 = uuid.UUID("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2")
    definition = CompanionWorkflowDefinitionV2(
        workflow_id="user_jsonb_check",
        version=1,
        title_ru="JSONB",
        title_en="JSONB",
        enabled=True,
        triggers=[CompanionWorkflowTriggerV1(type="regex", pattern="(?i)demo")],
        nodes=[
            CompanionWorkflowNodeV2(
                id=node_id,
                type="prompt_gen",
                mode="stateful",
                inputs={"prompt": "{{turn.user_line}}"},
                outputs={"reply": CompanionWorkflowOutputSpecV2(type="text")},
                title_ru="Prompt",
                title_en="Prompt",
            ),
            CompanionWorkflowNodeV2(
                id=node_id_2,
                type="data_transformer",
                mode="stateless",
                config=CompanionWorkflowNodeConfigV2(
                    transform_op="string_trim",
                    transform_args={"field": "text"},
                ),
                inputs={"text": f"{{{{{node_id}.reply}}}}"},
                outputs={"result": CompanionWorkflowOutputSpecV2(type="json")},
                title_ru="Transform",
                title_en="Transform",
            ),
        ],
        edges=[
            CompanionWorkflowEdgeV2(
                source_node_id=node_id,
                target_node_id=node_id_2,
                mapping_rules={"text": f"{{{{{node_id}.reply}}}}"},
            )
        ],
        builder_meta=CompanionWorkflowBuilderMetaV2(
            node_positions={
                str(node_id): CompanionWorkflowBuilderMetaNodePositionV2(x=100.0, y=50.0),
                str(node_id_2): CompanionWorkflowBuilderMetaNodePositionV2(x=420.0, y=50.0),
            },
            viewport={"x": -10.0, "y": 5.0, "zoom": 0.9},
        ),
    )

    raw_json = json.dumps(definition.model_dump(mode="json"))
    assert len(raw_json) < 1_000_000
    parsed = json.loads(raw_json)
    restored = CompanionWorkflowDefinitionV2.model_validate(parsed)

    assert restored.builder_meta is not None
    assert str(node_id) in restored.builder_meta.node_positions
    assert restored.builder_meta.viewport is not None
    assert restored.builder_meta.viewport["zoom"] == pytest.approx(0.9)
    transform_node = restored.nodes[1]
    assert transform_node.config.transform_op == "string_trim"
    assert transform_node.config.transform_args == {"field": "text"}
