# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# OpenAPI guard tests for the UGS typed-contract boundary consumed by the frontend pilot.
# Invariants:
# - Critical UGS JSON endpoints must expose a concrete schema instead of schema:{} / bare arbitrary object.
# - GenerationTypeListResponse.types must $ref GenerationTypeResponse (Wave 6); admin twin is AdminGenerationTypeResponse.
# - Tests inspect OpenAPI only; no auth, Postgres, Redis, RabbitMQ, or provider I/O.
# Related:
# - api/schemas/ugs.py
# - api/schemas/ugs_admin.py
# - shared/web/frontend/openapi/pilot/ugs.openapi.json
# - documentation/api/FRONTEND-BACKEND-HTTP.md §UGS typed contracts
# ---
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, FastAPI  # type: ignore[import-untyped]

from api.routers.ugs import router as ugs_router
from api.schemas.ugs import UGSQueueOpsSnapshotResponse
from api.schemas.ugs_admin import (
    AdminGenerationTypeResponse,
    UgsAdminV2BulkApplyResult,
    UgsAdminV2SnapshotResponse,
)


def _ugs_openapi() -> dict[str, Any]:
    app = FastAPI()
    app.include_router(ugs_router)
    admin_contract_router = APIRouter(prefix="/api/v1/ugs/admin")

    async def queue_ops_contract() -> dict[str, Any]:
        return {}

    async def v2_snapshot_contract() -> dict[str, Any]:
        return {}

    async def v2_bulk_contract() -> dict[str, Any]:
        return {}

    async def admin_types_contract() -> list[AdminGenerationTypeResponse]:
        return []

    # add_api_route keeps handlers referenced (basedpyright reportUnusedFunction on @router nested defs).
    admin_contract_router.add_api_route(
        "/queue-ops",
        queue_ops_contract,
        methods=["GET"],
        response_model=UGSQueueOpsSnapshotResponse,
    )
    admin_contract_router.add_api_route(
        "/v2/snapshot",
        v2_snapshot_contract,
        methods=["GET"],
        response_model=UgsAdminV2SnapshotResponse,
    )
    admin_contract_router.add_api_route(
        "/v2/bulk",
        v2_bulk_contract,
        methods=["POST"],
        response_model=UgsAdminV2BulkApplyResult,
    )
    admin_contract_router.add_api_route(
        "/types",
        admin_types_contract,
        methods=["GET"],
        response_model=list[AdminGenerationTypeResponse],
    )

    app.include_router(admin_contract_router)
    return app.openapi()


def _json_response_schema(spec: dict[str, Any], path: str, method: str) -> dict[str, Any]:
    operation = spec["paths"][path][method]
    response = operation["responses"].get("200") or operation["responses"].get("201")
    assert response, f"{method.upper()} {path} has no 200/201 response"
    content = response.get("content") or {}
    json_content = content.get("application/json")
    assert json_content, f"{method.upper()} {path} has no application/json response"
    schema = json_content.get("schema")
    assert isinstance(schema, dict), f"{method.upper()} {path} response schema is missing"
    return schema


def _schema_is_bare_arbitrary_object(schema: dict[str, Any]) -> bool:
    if schema == {}:
        return True
    if "$ref" in schema or "properties" in schema or "items" in schema or "anyOf" in schema or "oneOf" in schema:
        return False
    return schema.get("type") == "object" and schema.get("additionalProperties") is True


def test_ugs_critical_paths_have_concrete_json_response_schemas() -> None:
    spec = _ugs_openapi()
    critical_paths = [
        ("post", "/api/v1/ugs/generate"),
        ("get", "/api/v1/ugs/status/{request_id}"),
        ("get", "/api/v1/ugs/result/{request_id}"),
        ("get", "/api/v1/ugs/tasks"),
        ("get", "/api/v1/ugs/tasks/tray-summary"),
        ("get", "/api/v1/ugs/stats"),
        ("get", "/api/v1/ugs/metrics"),
        ("get", "/api/v1/ugs/analytics"),
        ("get", "/api/v1/ugs/providers/status"),
        ("get", "/api/v1/ugs/admin/tasks"),
        ("get", "/api/v1/ugs/admin/queue-ops"),
        ("get", "/api/v1/ugs/workflows"),
        ("get", "/api/v1/ugs/workflows/{workflow_id}"),
        ("post", "/api/v1/ugs/workflows/{workflow_id}/execute"),
        ("get", "/api/v1/ugs/workflows/{workflow_id}/executions"),
        ("get", "/api/v1/ugs/workflows/{workflow_id}/executions/{execution_id}"),
        ("get", "/api/v1/ugs/admin/v2/snapshot"),
        ("post", "/api/v1/ugs/admin/v2/bulk"),
    ]

    for method, path in critical_paths:
        schema = _json_response_schema(spec, path, method)
        assert not _schema_is_bare_arbitrary_object(schema), f"{method.upper()} {path} has weak schema: {schema}"


def test_ugs_openapi_exports_new_contract_components() -> None:
    spec = _ugs_openapi()
    schemas = spec["components"]["schemas"]

    for schema_name in [
        "UGSTaskResponse",
        "UGSTraySummaryResponse",
        "UGSMetricsResponse",
        "UGSProvidersStatusResponse",
        "UGSQueueOpsSnapshotResponse",
        "UGSQueueOpsOperatorSlo",
        "UGSWorkflowListResponse",
        "UGSWorkflowExecuteResponse",
        "UGSWorkflowExecutionsResponse",
        "GenerationTypeResponse",
        "GenerationTypeListResponse",
        "AdminGenerationTypeResponse",
    ]:
        assert schema_name in schemas, f"missing schema {schema_name}"

    queue_ops = schemas["UGSQueueOpsSnapshotResponse"]
    props = queue_ops.get("properties") or {}
    assert "operator_slo" in props


def test_ugs_generation_type_list_items_ref_generation_type_response() -> None:
    """Wave 6: GET /types list items must $ref GenerationTypeResponse (not loose object)."""
    spec = _ugs_openapi()
    schemas = spec["components"]["schemas"]
    list_schema = schemas["GenerationTypeListResponse"]
    types_prop = (list_schema.get("properties") or {}).get("types") or {}
    items = types_prop.get("items") or {}
    assert items.get("$ref") == "#/components/schemas/GenerationTypeResponse", items

    # Mangling must not win for the public response name when admin twin is renamed.
    assert "api__schemas__ugs__GenerationTypeResponse" not in schemas
    assert "GenerationTypeResponse" in schemas

    path_schema = _json_response_schema(spec, "/api/v1/ugs/types", "get")
    assert path_schema.get("$ref") == "#/components/schemas/GenerationTypeListResponse"
